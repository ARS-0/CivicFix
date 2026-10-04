import pg from 'pg';
import fs from 'fs';

const ssl = process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined;
export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl });
export const query = (text, params) => pool.query(text, params);

export async function migrate() {
  const sql = fs.readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');
  for (let i = 0; i < 20; i++) {
    try { await pool.query(sql); return; }
    catch (e) {
      if (i === 19) throw e;
      console.log('waiting for database...', e.code || e.message);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}
