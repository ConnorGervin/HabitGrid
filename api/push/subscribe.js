// POST   /api/push/subscribe  body: { subscription, timeZone }  -> store this device for reminders
// DELETE /api/push/subscribe  body: { endpoint }                -> stop reminders for this device
import { requireBearer, readBody } from '../../server/auth.js';
import { updateJson } from '../../server/github.js';

const FALLBACK = { subscriptions: [], sent: {} };

const validTimeZone = (tz) => {
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; } catch { return false; }
};

export default async function handler(req, res) {
  if (!requireBearer(req, res, 'SYNC_TOKEN')) return;
  const body = readBody(req);
  try {
    if (req.method === 'POST') {
      const sub = body.subscription;
      if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
        return res.status(400).json({ error: 'invalid subscription' });
      }
      const timeZone = validTimeZone(body.timeZone) ? body.timeZone : 'UTC';
      await updateJson('push.json', FALLBACK, (cur) => {
        const subs = (cur.subscriptions || []).filter((s) => s.endpoint !== sub.endpoint);
        subs.push({
          endpoint: sub.endpoint,
          keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
          timeZone,
          createdAt: new Date().toISOString(),
        });
        return { ...cur, subscriptions: subs, sent: cur.sent || {} };
      }, 'Update reminder devices');
      return res.status(200).json({ ok: true });
    }
    if (req.method === 'DELETE') {
      if (!body.endpoint) return res.status(400).json({ error: 'endpoint required' });
      await updateJson('push.json', FALLBACK, (cur) => ({
        ...cur,
        subscriptions: (cur.subscriptions || []).filter((s) => s.endpoint !== body.endpoint),
        sent: cur.sent || {},
      }), 'Update reminder devices');
      return res.status(200).json({ ok: true });
    }
    res.setHeader('Allow', 'POST, DELETE');
    return res.status(405).json({ error: 'method not allowed' });
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
}
