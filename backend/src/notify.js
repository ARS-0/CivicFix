import { query } from './db.js';
import { emitTo } from './socket.js';

async function whatsapp(to, body) {
  const { TWILIO_ACCOUNT_SID: sid, TWILIO_AUTH_TOKEN: token, TWILIO_WHATSAPP_FROM: from } = process.env;
  if (!sid || !token || !from || !to) return;
  try {
    await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: { Authorization: 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ From: from, To: `whatsapp:${to.replace(/^whatsapp:/, '')}`, Body: body }),
    });
  } catch (e) { console.error('WhatsApp failed:', e.message); }
}

/** In-app row + live WebSocket push + optional WhatsApp message. */
export async function notifyUser(userId, reportId, message) {
  if (!userId) return;
  const { rows } = await query(
    'INSERT INTO notifications (user_id, report_id, message) VALUES ($1,$2,$3) RETURNING *', [userId, reportId, message]);
  emitTo(`user:${userId}`, 'notification', rows[0]);
  const u = await query('SELECT phone_number FROM users WHERE id=$1', [userId]);
  whatsapp(u.rows[0]?.phone_number, `CivicFix: ${message}`);
}
