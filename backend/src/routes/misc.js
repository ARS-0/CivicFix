import { Router } from 'express';
import { query } from '../db.js';
import { auth, adminOnly } from '../auth.js';

const r = Router();
const wrap = (fn) => (req, res, next) => fn(req, res).catch(next);

r.get('/notifications', auth(), wrap(async (req, res) => {
  const { rows } = await query('SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 30', [req.user.id]);
  res.json(rows);
}));
r.post('/notifications/read', auth(), wrap(async (req, res) => {
  await query('UPDATE notifications SET read=true WHERE user_id=$1', [req.user.id]);
  res.json({ ok: true });
}));

r.get('/stats', wrap(async (_req, res) => {
  const { rows } = await query(`SELECT count(*) FILTER (WHERE master_ticket_id IS NULL)::int AS total,
    count(*) FILTER (WHERE master_ticket_id IS NULL AND status='Resolved')::int AS resolved,
    count(*) FILTER (WHERE master_ticket_id IS NOT NULL)::int AS duplicates_merged FROM reports`);
  res.json(rows[0]);
}));

r.get('/analytics', auth(), adminOnly, wrap(async (_req, res) => {
  const [byStatus, byCategory, resolution, daily, heat, depts, totals] = await Promise.all([
    query(`SELECT status, count(*)::int AS n FROM reports WHERE master_ticket_id IS NULL GROUP BY status`),
    query(`SELECT category, count(*)::int AS n FROM reports WHERE master_ticket_id IS NULL GROUP BY category ORDER BY n DESC`),
    query(`SELECT category, round((avg(extract(epoch FROM resolved_at - created_at))/3600)::numeric,1)::float AS hours
           FROM reports WHERE resolved_at IS NOT NULL AND master_ticket_id IS NULL GROUP BY category`),
    query(`SELECT to_char(d::date,'YYYY-MM-DD') AS day, coalesce(c.n,0)::int AS n FROM generate_series(now()-interval '29 days', now(), '1 day') d
           LEFT JOIN (SELECT created_at::date AS day, count(*) AS n FROM reports GROUP BY 1) c ON c.day = d::date ORDER BY d`),
    query(`SELECT ST_Y(location) AS lat, ST_X(location) AS lng, priority_score::float/100 AS weight FROM reports WHERE status <> 'Resolved'`),
    query(`SELECT coalesce(department,'Unassigned') AS department, count(*)::int AS total, count(*) FILTER (WHERE status='Resolved')::int AS resolved,
           round((avg(extract(epoch FROM resolved_at - created_at)) FILTER (WHERE resolved_at IS NOT NULL) / 3600)::numeric,1)::float AS avg_hours
           FROM reports WHERE master_ticket_id IS NULL GROUP BY 1 ORDER BY total DESC`),
    query(`SELECT count(*) FILTER (WHERE master_ticket_id IS NULL)::int AS tickets, count(*) FILTER (WHERE master_ticket_id IS NOT NULL)::int AS duplicates,
           round(avg(priority_score) FILTER (WHERE master_ticket_id IS NULL))::int AS avg_priority FROM reports`),
  ]);
  res.json({ byStatus: byStatus.rows, byCategory: byCategory.rows, resolution: resolution.rows, daily: daily.rows, heat: heat.rows, departments: depts.rows, totals: totals.rows[0] });
}));

export default r;
