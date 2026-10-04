import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../db.js';
import { auth, signToken } from '../auth.js';

const r = Router();
const pub = (u) => ({ id: u.id, name: u.name, email: u.email, phone_number: u.phone_number, role: u.role });

r.post('/register', async (req, res, next) => {
  try {
    const { name, email, password, phone_number } = req.body || {};
    if (!name?.trim() || !/^\S+@\S+\.\S+$/.test(email || '')) return res.status(400).json({ error: 'Enter your name and a valid email' });
    if ((password || '').length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await query(
      `INSERT INTO users (name,email,phone_number,password_hash) VALUES ($1,lower($2),$3,$4)
       ON CONFLICT (email) DO NOTHING RETURNING *`, [name.trim(), email, phone_number?.trim() || null, hash]);
    if (!rows[0]) return res.status(409).json({ error: 'An account with this email already exists' });
    res.status(201).json({ token: signToken(rows[0]), user: pub(rows[0]) });
  } catch (e) { next(e); }
});

r.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    const { rows } = await query('SELECT * FROM users WHERE email=lower($1)', [email || '']);
    if (!rows[0] || !(await bcrypt.compare(password || '', rows[0].password_hash)))
      return res.status(401).json({ error: 'Email or password is incorrect' });
    res.json({ token: signToken(rows[0]), user: pub(rows[0]) });
  } catch (e) { next(e); }
});

r.get('/me', auth(), async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM users WHERE id=$1', [req.user.id]);
    rows[0] ? res.json({ user: pub(rows[0]) }) : res.status(401).json({ error: 'Account not found' });
  } catch (e) { next(e); }
});

r.patch('/me', auth(), async (req, res, next) => {
  try {
    const { rows } = await query('UPDATE users SET phone_number=$1 WHERE id=$2 RETURNING *', [req.body?.phone_number?.trim() || null, req.user.id]);
    res.json({ user: pub(rows[0]) });
  } catch (e) { next(e); }
});

export default r;
