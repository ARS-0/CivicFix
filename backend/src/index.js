import 'dotenv/config';
import http from 'http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { migrate, query } from './db.js';
import { initSocket } from './socket.js';
import { ensureAdmin, seedDemo } from './seed.js';
import authRoutes from './routes/auth.js';
import path from 'path';
import { fileURLToPath } from 'url';
import reportRoutes, { imageRoute } from './routes/reports.js';
import misc from './routes/misc.js';

if (!process.env.JWT_SECRET) { console.error('JWT_SECRET is required'); process.exit(1); }

const app = express();
const origins = (process.env.FRONTEND_URL || 'http://localhost:3000').split(',').map((s) => s.trim());
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false, referrerPolicy: { policy: 'strict-origin-when-cross-origin' }, crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: origins }));
app.use(express.json({ limit: '100kb' }));
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 60, standardHeaders: true }));
app.use('/api', rateLimit({ windowMs: 60 * 1000, limit: 900, standardHeaders: true }));
app.get('/api/images/:id', imageRoute);

app.get('/health', async (_req, res) => { await query('SELECT 1'); res.json({ ok: true }); });
app.use('/api/auth', authRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api', misc);

// Serve the exported Next.js frontend from the same origin (no CORS, no URLs to configure).
const pub = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
app.use(express.static(pub, { extensions: ['html'] }));
app.use((req, res, next) => (req.method === 'GET' && !req.path.startsWith('/api') ? res.status(404).sendFile(path.join(pub, '404.html'), (e) => e && next()) : next()));

app.use((err, _req, res, _next) => {
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'Photo is larger than 10 MB' });
  if (err.message?.startsWith('Please upload')) return res.status(400).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on our side. Try again.' });
});

const server = http.createServer(app);
initSocket(server, origins);
await migrate();
await ensureAdmin();
await seedDemo();
const port = process.env.PORT || 4000;
server.listen(port, () => console.log(`CivicFix API on :${port}`));
