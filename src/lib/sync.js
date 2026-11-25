// Pushes the local document to the server and merges the server's copy back.
// The server merges too, so the order devices sync in doesn't matter.
import { subscribe as subscribeStore, getDoc, mergeRemote } from './store';

const SETTINGS_KEY = 'habitgrid.settings.v1';

export function getSettings() {
  try {
    return { token: '', ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') };
  } catch {
    return { token: '' };
  }
}

export function saveSettings(patch) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...getSettings(), ...patch }));
}

// ---- status (shown in the header) ----
let status = { state: 'idle', message: '', at: null };
const statusListeners = new Set();
export const getStatus = () => status;
export function subscribeStatus(fn) {
  statusListeners.add(fn);
  return () => statusListeners.delete(fn);
}
function setStatus(state, message = '') {
  status = { state, message, at: new Date() };
  statusListeners.forEach((fn) => fn(status));
}

// ---- scheduling ----
let timer = null;
let inFlight = false;
let queued = false;

export function scheduleSync(delay = 1500) {
  clearTimeout(timer);
  timer = setTimeout(syncNow, delay);
}

export async function syncNow() {
  const { token } = getSettings();
  if (!token) return setStatus('off', 'Sync is not set up on this device');
  if (!navigator.onLine) return setStatus('offline', 'Offline – changes are saved and will sync later');
  if (inFlight) {
    queued = true;
    return;
  }

  inFlight = true;
  setStatus('syncing', 'Syncing…');
  try {
    const res = await fetch('/api/data', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(getDoc()),
    });
    if (res.status === 401) throw new Error('Sync token was rejected – check it in Settings');
    if (!res.ok) throw new Error(`Server error ${res.status}`);
    mergeRemote(await res.json());
    saveSettings({ lastSyncedAt: new Date().toISOString() });
    setStatus('synced', 'All changes synced');
  } catch (err) {
    const offline = !navigator.onLine || err instanceof TypeError;
    setStatus(offline ? 'offline' : 'error', offline ? 'Offline – changes will sync later' : err.message);
    // Server-side hiccups (5xx) are usually temporary: try again shortly. Changes stay saved locally.
    if (!offline && !/token|Server error 4/.test(err.message)) {
      clearTimeout(timer);
      timer = setTimeout(syncNow, 30000);
    }
  } finally {
    inFlight = false;
    if (queued) {
      queued = false;
      scheduleSync(0);
    }
  }
}

// Start listening: local edits schedule a sync; coming online or returning to the app syncs too.
export function startSync() {
  subscribeStore((info) => {
    if (!info.remote) scheduleSync();
  });
  window.addEventListener('online', () => syncNow());
  window.addEventListener('offline', () => setStatus('offline', 'Offline – changes will sync later'));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') syncNow();
  });
  syncNow();
}
