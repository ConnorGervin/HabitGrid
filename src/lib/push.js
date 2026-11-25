// Web Push reminders. Works on Android Chrome and desktop Chrome/Edge over HTTPS.
import { getSettings } from './sync';

const VAPID_PUBLIC = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

export const pushSupported = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

function keyBytes(base64) {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function api(path, method, body) {
  const { token } = getSettings();
  const res = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Reminder server error ${res.status}`);
}

const timeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

export async function getSubscription() {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

export async function enableReminders() {
  if (!pushSupported()) throw new Error('This browser does not support notifications');
  if (!VAPID_PUBLIC) throw new Error('Reminders are not configured for this deployment');
  if (!getSettings().token) throw new Error('Set up sync first – reminders are sent from the server');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notifications are blocked for this site');

  const reg = await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ||
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC) }));
  await api('/api/push/subscribe', 'POST', { subscription: sub.toJSON(), timeZone: timeZone() });
}

// Called on start-up so a device that already opted in keeps its time zone current.
export async function refreshReminderDevice() {
  const sub = await getSubscription().catch(() => null);
  if (sub && getSettings().token) {
    await api('/api/push/subscribe', 'POST', { subscription: sub.toJSON(), timeZone: timeZone() }).catch(() => {});
  }
}

export async function disableReminders() {
  const sub = await getSubscription();
  if (!sub) return;
  await api('/api/push/subscribe', 'DELETE', { endpoint: sub.endpoint }).catch(() => {});
  await sub.unsubscribe();
}
