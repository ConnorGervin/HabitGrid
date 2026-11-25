import { createHash } from 'node:crypto';
import * as webpush from 'web-push';
import { isDone } from '../shared/doc.js';

// A reminder is due for `time` (HH:MM, in the device's time zone) for the next hour.
// The scheduler runs every 15 minutes, so each habit is sent at most once per day
// per device (tracked in `sent`), and never if the habit is already ticked.
export const REMINDER_WINDOW_MIN = 60;

export function localParts(now, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now);
  const get = (t) => parts.find((p) => p.type === t)?.value;
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    minutes: Number(get('hour')) * 60 + Number(get('minute')),
  };
}

const toMinutes = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

export const endpointId = (endpoint) =>
  createHash('sha256').update(endpoint).digest('hex').slice(0, 16);

export function configureWebPush() {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:set-VAPID_SUBJECT@example.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
}

// Works out which reminders are due right now. Pure apart from `send`, so it can be tested.
export async function runReminders({ doc, pushState, now, send }) {
  const sent = { ...(pushState.sent || {}) };
  const dropped = new Set();
  let count = 0;

  for (const sub of pushState.subscriptions || []) {
    const { date, minutes } = localParts(now, sub.timeZone || 'UTC');
    for (const habit of doc.habits) {
      if (habit.deleted || !habit.reminder?.enabled) continue;
      const due = toMinutes(habit.reminder.time);
      if (minutes < due || minutes >= due + REMINDER_WINDOW_MIN) continue;
      if (isDone(doc, habit.id, date)) continue;
      const key = `${date}|${habit.id}|${endpointId(sub.endpoint)}`;
      if (sent[key]) continue;
      try {
        await send(sub, {
          title: 'HabitGrid',
          body: `Time for: ${habit.name}`,
          tag: `${date}-${habit.id}`,
          url: '/',
        });
        sent[key] = now.toISOString();
        count++;
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) dropped.add(sub.endpoint);
        else console.error('push failed', err.statusCode || err.message);
      }
    }
  }

  // Forget dedup keys older than 3 days so the file stays small.
  const cutoff = new Date(now.getTime() - 3 * 864e5).toISOString().slice(0, 10);
  for (const k of Object.keys(sent)) if (k.slice(0, 10) < cutoff) delete sent[k];

  return { count, sent, dropped };
}
