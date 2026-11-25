// GET /api/cron/remind  (header: Authorization: Bearer <CRON_SECRET>)
// Called every 15 minutes by a free external scheduler (e.g. cron-job.org).
import { requireBearer } from '../../server/auth.js';
import { readJson, updateJson } from '../../server/github.js';
import { configureWebPush, runReminders } from '../../server/reminders.js';
import { emptyDoc, normalizeDoc } from '../../shared/doc.js';
import * as webpush from 'web-push';

export default async function handler(req, res) {
  if (!requireBearer(req, res, 'CRON_SECRET')) return;
  try {
    configureWebPush();
    const { data: doc } = await readJson('habits.json', emptyDoc());
    const { data: pushState } = await readJson('push.json', { subscriptions: [], sent: {} });

    const result = await runReminders({
      doc: normalizeDoc(doc),
      pushState,
      now: new Date(),
      send: (sub, payload) => webpush.sendNotification(sub, JSON.stringify(payload), { TTL: 3600 }),
    });

    if (result.count || result.dropped.size) {
      await updateJson('push.json', { subscriptions: [], sent: {} }, (cur) => ({
        subscriptions: (cur.subscriptions || []).filter((s) => !result.dropped.has(s.endpoint)),
        sent: { ...(cur.sent || {}), ...result.sent },
      }), 'Record reminders sent');
    }
    return res.status(200).json({ sent: result.count, removedDevices: result.dropped.size });
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
}
