import bcrypt from 'bcryptjs';
import { query } from './db.js';
import { computePriority, DEPARTMENTS } from './priority.js';

export async function ensureAdmin() {
  const email = (process.env.ADMIN_EMAIL || 'admin@civicfix.dev').toLowerCase();
  const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'Admin#12345', 10);
  await query(`INSERT INTO users (name,email,password_hash,role) VALUES ('City Admin',$1,$2,'admin') ON CONFLICT (email) DO NOTHING`, [email, hash]);
}

// Demo data so judges see a living dashboard on first launch. Disable with SEED_DEMO=false.
export async function seedDemo() {
  if (process.env.SEED_DEMO === 'false') return;
  if ((await query('SELECT 1 FROM reports LIMIT 1')).rowCount) return;
  const [clat, clng] = (process.env.DEMO_CENTER || '40.7128,-74.0060').split(',').map(Number);
  const hash = await bcrypt.hash('demo-user-pass', 10);
  const u = (await query(`INSERT INTO users (name,email,password_hash) VALUES ('Demo Resident','resident@civicfix.dev',$1)
     ON CONFLICT (email) DO UPDATE SET name=users.name RETURNING id`, [hash])).rows[0].id;
  const items = [
    ['Deep pothole in left lane', 'pothole', 9, true, 'In Progress', 0.004, 0.002, 3],
    ['Streetlight out near bus stop', 'streetlight', 6, true, 'Assigned', -0.006, 0.008, 6],
    ['Burst pipe flooding the sidewalk', 'water_leak', 9, false, 'Verified', 0.011, -0.004, 1],
    ['Overflowing bins behind market', 'garbage', 5, true, 'Reported', -0.012, -0.009, 2],
    ['Cracked pavement outside school', 'road_damage', 7, true, 'Reported', 0.008, 0.012, 4],
    ['Illegal dumping on vacant lot', 'garbage', 4, false, 'Resolved', -0.003, -0.014, 9],
    ['Pothole cluster after rain', 'pothole', 7, false, 'Reported', 0.015, 0.006, 1],
    ['Broken streetlight on footbridge', 'streetlight', 7, true, 'Verified', -0.009, 0.003, 5],
    ['Slow water leak at hydrant', 'water_leak', 5, false, 'Resolved', 0.002, -0.011, 12],
    ['Sunken road patch', 'road_damage', 6, false, 'In Progress', -0.015, 0.012, 7],
  ];
  for (const [title, cat, sev, near, status, dla, dlo, daysAgo] of items) {
    const created = new Date(Date.now() - daysAgo * 864e5);
    const resolved = status === 'Resolved' ? new Date(created.getTime() + (20 + sev * 5) * 36e5) : null;
    const { rows } = await query(
      `INSERT INTO reports (user_id,title,description,category,severity_score,priority_score,location,status,department,near_public_zone,ai_confidence,created_at,updated_at,resolved_at)
       VALUES ($1,$2,$3,$4,$5,$6,ST_SetSRID(ST_MakePoint($7,$8),4326),$9,$10,$11,0.9,$12,$12,$13) RETURNING id`,
      [u, title, 'Demo report generated for first launch.', cat, sev, computePriority({ severity: sev, category: cat, near }), clng + dlo, clat + dla, status, DEPARTMENTS[cat], near, created, resolved]);
    await query('INSERT INTO status_history (report_id,old_status,new_status,timestamp) VALUES ($1,NULL,$2,$3)', [rows[0].id, 'Reported', created]);
  }
  console.log('Seeded demo reports');
}
