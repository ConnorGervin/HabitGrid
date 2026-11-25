// The local, offline-first copy of the habit document.
// Every change is written to localStorage immediately; sync.js pushes it when online.
import { emptyDoc, mergeDocs, normalizeDoc, serializeDoc } from '../../shared/doc.js';

const KEY = 'habitgrid.doc.v1';
const listeners = new Set();

const newId = () =>
  globalThis.crypto?.randomUUID?.() ??
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });

const nowIso = () => new Date().toISOString();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? normalizeDoc(JSON.parse(raw)) : emptyDoc();
  } catch {
    return emptyDoc();
  }
}

let doc = load();

export const getDoc = () => doc;

// `info.remote` is true when the change came from the server (so sync won't echo it back).
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function commit(next, info = {}) {
  doc = normalizeDoc(next);
  try {
    localStorage.setItem(KEY, JSON.stringify(doc));
  } catch {
    // Storage full or blocked: keep working in memory.
  }
  listeners.forEach((fn) => fn(info));
}

export const activeHabits = (d = doc) =>
  d.habits.filter((h) => !h.deleted).sort((a, b) => a.position - b.position);

export function addHabit({ name, color, reminder }) {
  const position = activeHabits().reduce((max, h) => Math.max(max, h.position + 1), 0);
  const t = nowIso();
  const habit = {
    id: newId(),
    name: name.trim(),
    color,
    position,
    reminder: { enabled: Boolean(reminder?.enabled), time: reminder?.time || '08:00' },
    createdAt: t,
    updatedAt: t,
    deleted: false,
  };
  commit({ ...doc, habits: [...doc.habits, habit] });
  return habit;
}

export function updateHabit(id, patch) {
  const t = nowIso();
  commit({
    ...doc,
    habits: doc.habits.map((h) => (h.id === id ? { ...h, ...patch, updatedAt: t } : h)),
  });
}

// Deletes are tombstones so the deletion also reaches other devices.
export function deleteHabit(id) {
  updateHabit(id, { deleted: true });
}

export function toggleCheck(habitId, date) {
  const current = doc.checks.find((c) => c.habit === habitId && c.date === date);
  const done = !current?.done;
  const rest = doc.checks.filter((c) => !(c.habit === habitId && c.date === date));
  commit({
    ...doc,
    checks: [...rest, { habit: habitId, date, done, updatedAt: nowIso() }],
  });
}

export function mergeRemote(remote) {
  commit(mergeDocs(doc, remote), { remote: true });
}

export function importJson(text) {
  const parsed = JSON.parse(text);
  if (parsed?.format !== 'habitgrid' || !Array.isArray(parsed.habits)) {
    throw new Error('This file is not a HabitGrid export.');
  }
  commit(mergeDocs(doc, parsed));
}

export const exportText = () => serializeDoc(doc);
