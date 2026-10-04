import { Router } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import crypto from 'crypto';
import path from 'path';
import { query } from '../db.js';
import { auth, adminOnly } from '../auth.js';
import { analyzeImage } from '../ai.js';
import { computePriority, CATEGORIES, STATUSES, DEPARTMENTS } from '../priority.js';
import { notifyUser } from '../notify.js';
import { emitTo } from '../socket.js';

export const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || 'uploads');
const DUP_RADIUS_M = Number(process.env.DUP_RADIUS_M || 20);
const DUP_WINDOW_DAYS = Number(process.env.DUP_WINDOW_DAYS || 14);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => cb(/^image\/(jpe?g|png|webp|heic|heif)$/i.test(file.mimetype) ? null : new Error('Please upload a JPG, PNG or WebP photo'), true),
});

// Re-encoding with sharp proves the file is a real image, strips EXIF/embedded payloads and shrinks it.
const sanitize = (buf) => sharp(buf, { failOn: 'error' }).rotate().resize(1600, 1600, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();

const COLS = `r.id, r.title, r.description, r.category, r.severity_score, r.priority_score, r.status, r.image_url, r.address,
  r.department, r.ai_confidence, r.ai_summary, r.near_public_zone, r.master_ticket_id, r.created_at, r.updated_at, r.resolved_at,
  ST_Y(r.location) AS lat, ST_X(r.location) AS lng,
  (SELECT count(*)::int FROM reports d WHERE d.master_ticket_id = r.id) AS duplicate_count`;

const router = Router();
export const imageRoute = async (req, res, next) => {
  try {
    const { rows } = await query('SELECT data FROM images WHERE id=$1', [req.params.id]);
    if (!rows[0]) return res.status(404).end();
    res.set({ 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=604800, immutable' }).send(rows[0].data);
  } catch (e) { next(e); }
};
const wrap = (fn) => (req, res, next) => fn(req, res).catch(next);

// Public map data: master tickets only, no personal info.
router.get('/public', wrap(async (_req, res) => {
  const { rows } = await query(`SELECT ${COLS} FROM reports r WHERE r.master_ticket_id IS NULL ORDER BY r.created_at DESC LIMIT 500`);
  res.json(rows.map(({ description, ai_summary, ...r }) => r));
}));

// Photo -> AI draft (nothing is saved).
router.post('/analyze', auth(), upload.single('image'), wrap(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Attach a photo' });
  let clean;
  try { clean = await sanitize(req.file.buffer); } catch { return res.status(400).json({ error: 'That file is not a valid image' }); }
  res.json(await analyzeImage(clean));
}));

router.post('/', auth(), upload.single('image'), wrap(async (req, res) => {
  const b = req.body;
  const lat = Number(b.lat), lng = Number(b.lng);
  if (!req.file) return res.status(400).json({ error: 'Attach a photo of the problem' });
  if (!b.title?.trim()) return res.status(400).json({ error: 'Add a short title' });
  if (!CATEGORIES.includes(b.category)) return res.status(400).json({ error: 'Choose a category' });
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180)
    return res.status(400).json({ error: 'Set the location on the map' });

  let clean;
  try { clean = await sanitize(req.file.buffer); } catch { return res.status(400).json({ error: 'That file is not a valid image' }); }
  const filename = crypto.randomUUID();
  await query('INSERT INTO images (id, data) VALUES ($1,$2)', [filename, clean]); // stored in Postgres: survives restarts, no disk needed

  const severity = Math.max(1, Math.min(10, parseInt(b.severity) || 5));
  const near = b.near_public_zone === 'true';

  // Duplicate detection: same category, open, recent, within DUP_RADIUS_M (PostGIS geography index).
  const dup = await query(
    `SELECT id, user_id FROM reports
      WHERE master_ticket_id IS NULL AND category = $1 AND status <> 'Resolved'
        AND created_at > now() - ($4 || ' days')::interval
        AND ST_DWithin(location::geography, ST_SetSRID(ST_MakePoint($2,$3),4326)::geography, $5)
      ORDER BY location::geography <-> ST_SetSRID(ST_MakePoint($2,$3),4326)::geography LIMIT 1`,
    [b.category, lng, lat, String(DUP_WINDOW_DAYS), DUP_RADIUS_M]);
  const master = dup.rows[0] || null;

  const priority = computePriority({ severity, category: b.category, near });
  const ins = await query(
    `INSERT INTO reports (user_id,title,description,category,severity_score,priority_score,location,address,image_url,
       master_ticket_id,department,ai_confidence,ai_summary,near_public_zone)
     VALUES ($1,$2,$3,$4,$5,$6,ST_SetSRID(ST_MakePoint($7,$8),4326),$9,$10,$11,$12,$13,$14,$15) RETURNING id`,
    [req.user.id, b.title.trim().slice(0, 120), (b.description || '').slice(0, 1500), b.category, severity, priority, lng, lat,
     b.address?.slice(0, 200) || null, `/api/images/${filename}`, master?.id || null, DEPARTMENTS[b.category],
     b.ai_confidence ? Math.max(0, Math.min(1, Number(b.ai_confidence))) : null, b.ai_summary?.slice(0, 1500) || null, near]);
  const id = ins.rows[0].id;
  await query('INSERT INTO status_history (report_id,old_status,new_status,changed_by) VALUES ($1,NULL,$2,$3)', [id, 'Reported', req.user.id]);

  if (master) {
    // Re-score the master: more citizens reporting the same spot raises its priority.
    const m = (await query('SELECT severity_score, category, near_public_zone, (SELECT count(*)::int FROM reports d WHERE d.master_ticket_id=$1) AS n FROM reports WHERE id=$1', [master.id])).rows[0];
    await query('UPDATE reports SET priority_score=$2, updated_at=now() WHERE id=$1',
      [master.id, computePriority({ severity: Math.max(m.severity_score, severity), category: m.category, near: m.near_public_zone || near, duplicates: m.n })]);
    await notifyUser(req.user.id, id, `Your report was linked to existing ticket #${master.id} nearby. You will get its updates.`);
    if (master.user_id && master.user_id !== req.user.id) await notifyUser(master.user_id, master.id, `Another resident confirmed your report #${master.id}. Priority raised.`);
  } else {
    await notifyUser(req.user.id, id, `Report #${id} received. Our team will verify it soon.`);
  }

  const report = (await query(`SELECT ${COLS} FROM reports r WHERE r.id=$1`, [id])).rows[0];
  emitTo('admins', 'report:new', report);
  res.status(201).json({ ...report, merged_into: master?.id || null });
}));

// My reports (admin: full queue with filters).
router.get('/', auth(), wrap(async (req, res) => {
  const where = [], params = [];
  if (req.user.role === 'admin' && req.query.scope !== 'mine') {
    where.push('r.master_ticket_id IS NULL');
    if (STATUSES.includes(req.query.status)) { params.push(req.query.status); where.push(`r.status = $${params.length}`); }
    if (CATEGORIES.includes(req.query.category)) { params.push(req.query.category); where.push(`r.category = $${params.length}`); }
  } else { params.push(req.user.id); where.push(`r.user_id = $${params.length}`); }
  const order = req.user.role === 'admin' && req.query.scope !== 'mine' ? 'r.priority_score DESC, r.created_at DESC' : 'r.created_at DESC';
  const { rows } = await query(`SELECT ${COLS}, m.status AS master_status FROM reports r LEFT JOIN reports m ON m.id = r.master_ticket_id
     WHERE ${where.join(' AND ')} ORDER BY ${order} LIMIT 300`, params);
  res.json(rows);
}));

router.get('/:id(\\d+)', auth(false), wrap(async (req, res) => {
  const { rows } = await query(`SELECT ${COLS}, u.name AS reporter_name FROM reports r LEFT JOIN users u ON u.id=r.user_id WHERE r.id=$1`, [req.params.id]);
  const r = rows[0];
  if (!r) return res.status(404).json({ error: 'Report not found' });
  const history = (await query(`SELECT new_status, old_status, note, timestamp FROM status_history WHERE report_id=$1 OR report_id=$2 ORDER BY timestamp`, [r.id, r.master_ticket_id || r.id])).rows;
  const isStaffOrOwner = req.user && (req.user.role === 'admin' || rows[0].user_id === req.user.id);
  if (!isStaffOrOwner) { delete r.reporter_name; delete r.ai_summary; }
  res.json({ ...r, history });
}));

router.patch('/:id(\\d+)/status', auth(), adminOnly, wrap(async (req, res) => {
  const { status, note, department } = req.body || {};
  if (!STATUSES.includes(status)) return res.status(400).json({ error: 'Unknown status' });
  const r = (await query('SELECT * FROM reports WHERE id=$1', [req.params.id])).rows[0];
  if (!r) return res.status(404).json({ error: 'Report not found' });
  if (r.master_ticket_id) return res.status(400).json({ error: `This is a duplicate. Update master ticket #${r.master_ticket_id}.` });

  // A master ticket and all its linked duplicates move together, and every reporter is notified.
  const group = (await query('SELECT id, user_id, title, status FROM reports WHERE id=$1 OR master_ticket_id=$1', [r.id])).rows;
  for (const g of group) {
    await query(`UPDATE reports SET status=$2, department=COALESCE($3, department), updated_at=now(),
                 resolved_at = CASE WHEN $2='Resolved' THEN now() ELSE NULL END WHERE id=$1`, [g.id, status, department || null]);
    if (g.status !== status) {
      await query('INSERT INTO status_history (report_id,old_status,new_status,note,changed_by) VALUES ($1,$2,$3,$4,$5)', [g.id, g.status, status, note?.slice(0, 300) || null, req.user.id]);
      await notifyUser(g.user_id, g.id, `"${g.title}" is now ${status}.${note ? ' ' + note.slice(0, 200) : ''}`);
    }
  }
  const updated = (await query(`SELECT ${COLS} FROM reports r WHERE r.id=$1`, [r.id])).rows[0];
  emitTo('admins', 'report:updated', updated);
  res.json(updated);
}));

export default router;
