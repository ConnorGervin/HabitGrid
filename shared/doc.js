// The whole habit database is ONE human-readable JSON document.
// This module is shared by the browser app and the Vercel API routes.
//
//  {
//    "format": "habitgrid",
//    "version": 1,
//    "habits": [
//      { "id": "…", "name": "Read", "color": "#16a34a", "position": 0,
//        "reminder": { "enabled": true, "time": "08:00" },
//        "createdAt": "…", "updatedAt": "…", "deleted": false }
//    ],
//    "checks": [
//      { "habit": "…", "date": "2026-11-24", "done": true, "updatedAt": "…" }
//    ]
//  }
//
// Merging is last-writer-wins per record: habits by id, checks by (habit, date).
// Deletions are tombstones (deleted: true), so they also sync.

export const FORMAT = 'habitgrid';
export const VERSION = 1;

export const DEFAULT_COLOR = '#16a34a';

export function emptyDoc() {
  return { format: FORMAT, version: VERSION, habits: [], checks: [] };
}

const isStr = (v) => typeof v === 'string';
const ts = (s) => {
  const n = Date.parse(s);
  return Number.isNaN(n) ? 0 : n;
};

// Keep only well-formed records; tolerate hand-edited or older files.
export function normalizeDoc(input) {
  const out = emptyDoc();
  if (!input || typeof input !== 'object') return out;
  for (const h of Array.isArray(input.habits) ? input.habits : []) {
    if (!h || !isStr(h.id) || !h.id) continue;
    out.habits.push({
      id: h.id,
      name: isStr(h.name) ? h.name.trim().slice(0, 120) : '',
      color: isStr(h.color) ? h.color : DEFAULT_COLOR,
      position: Number.isFinite(h.position) ? h.position : 0,
      reminder: {
        enabled: Boolean(h.reminder?.enabled),
        time: /^([01]\d|2[0-3]):[0-5]\d$/.test(h.reminder?.time) ? h.reminder.time : '08:00',
      },
      createdAt: isStr(h.createdAt) ? h.createdAt : new Date(0).toISOString(),
      updatedAt: isStr(h.updatedAt) ? h.updatedAt : new Date(0).toISOString(),
      deleted: Boolean(h.deleted),
    });
  }
  for (const c of Array.isArray(input.checks) ? input.checks : []) {
    if (!c || !isStr(c.habit) || !/^\d{4}-\d{2}-\d{2}$/.test(c.date ?? '')) continue;
    out.checks.push({
      habit: c.habit,
      date: c.date,
      done: Boolean(c.done),
      updatedAt: isStr(c.updatedAt) ? c.updatedAt : new Date(0).toISOString(),
    });
  }
  return out;
}

// Newer updatedAt wins; ties keep `a` so merge is deterministic.
const newer = (a, b) => (ts(b.updatedAt) > ts(a.updatedAt) ? b : a);

export function mergeDocs(a, b) {
  const A = normalizeDoc(a);
  const B = normalizeDoc(b);

  const habits = new Map();
  for (const h of [...A.habits, ...B.habits]) {
    const prev = habits.get(h.id);
    habits.set(h.id, prev ? newer(prev, h) : h);
  }

  const checks = new Map();
  for (const c of [...A.checks, ...B.checks]) {
    const key = `${c.habit}|${c.date}`;
    const prev = checks.get(key);
    checks.set(key, prev ? newer(prev, c) : c);
  }

  const sortedHabits = [...habits.values()].sort(
    (x, y) => x.position - y.position || x.createdAt.localeCompare(y.createdAt) || x.id.localeCompare(y.id),
  );
  const sortedChecks = [...checks.values()].sort(
    (x, y) => x.date.localeCompare(y.date) || x.habit.localeCompare(y.habit),
  );
  return { format: FORMAT, version: VERSION, habits: sortedHabits, checks: sortedChecks };
}

// Stable JSON text for storage in git / download. Two-space indent, trailing newline.
export function serializeDoc(doc) {
  return JSON.stringify(normalizeDoc(doc), null, 2) + '\n';
}

export function isDone(doc, habitId, date) {
  const c = doc.checks.find((x) => x.habit === habitId && x.date === date);
  return Boolean(c?.done);
}
