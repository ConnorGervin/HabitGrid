import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyDoc, mergeDocs, normalizeDoc, serializeDoc } from './doc.js';

const H = (id, extra = {}) => ({
  id, name: id, color: '#000000', position: 0,
  reminder: { enabled: false, time: '08:00' },
  createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', deleted: false, ...extra,
});
const C = (habit, date, done, updatedAt) => ({ habit, date, done, updatedAt });

test('merge keeps habits from both sides', () => {
  const a = { ...emptyDoc(), habits: [H('a')] };
  const b = { ...emptyDoc(), habits: [H('b')] };
  assert.deepEqual(mergeDocs(a, b).habits.map((h) => h.id).sort(), ['a', 'b']);
});

test('newer habit edit wins', () => {
  const a = { ...emptyDoc(), habits: [H('a', { name: 'old', updatedAt: '2026-02-01T00:00:00Z' })] };
  const b = { ...emptyDoc(), habits: [H('a', { name: 'new', updatedAt: '2026-03-01T00:00:00Z' })] };
  assert.equal(mergeDocs(a, b).habits[0].name, 'new');
  assert.equal(mergeDocs(b, a).habits[0].name, 'new');
});

test('tombstone deletion syncs and is not resurrected by an older copy', () => {
  const alive = { ...emptyDoc(), habits: [H('a')] };
  const dead = { ...emptyDoc(), habits: [H('a', { deleted: true, updatedAt: '2026-05-01T00:00:00Z' })] };
  assert.equal(mergeDocs(alive, dead).habits[0].deleted, true);
  assert.equal(mergeDocs(dead, alive).habits[0].deleted, true);
});

test('offline checks on two devices merge per (habit, date)', () => {
  const phone = { ...emptyDoc(), checks: [C('a', '2026-11-24', true, '2026-11-24T10:00:00Z')] };
  const desk = { ...emptyDoc(), checks: [C('a', '2026-11-25', true, '2026-11-25T10:00:00Z')] };
  const m = mergeDocs(phone, desk);
  assert.equal(m.checks.length, 2);
});

test('later un-check beats earlier check for the same day', () => {
  const phone = { ...emptyDoc(), checks: [C('a', '2026-11-24', true, '2026-11-24T10:00:00Z')] };
  const desk = { ...emptyDoc(), checks: [C('a', '2026-11-24', false, '2026-11-24T12:00:00Z')] };
  assert.equal(mergeDocs(phone, desk).checks[0].done, false);
});

test('merge is idempotent and order-independent', () => {
  const a = { ...emptyDoc(), habits: [H('a'), H('b', { position: 1 })], checks: [C('a', '2026-11-20', true, '2026-11-20T01:00:00Z')] };
  const b = { ...emptyDoc(), habits: [H('c', { position: 2 })], checks: [C('a', '2026-11-21', true, '2026-11-21T01:00:00Z')] };
  const ab = mergeDocs(a, b);
  assert.deepEqual(mergeDocs(ab, a), ab);
  assert.deepEqual(mergeDocs(b, a), ab);
});

test('normalize drops malformed records and bad times', () => {
  const d = normalizeDoc({
    habits: [null, { id: '' }, { id: 'x', reminder: { time: '25:99' } }],
    checks: [{ habit: 'x', date: 'nope', done: true }, { habit: 'x', date: '2026-01-02', done: true }],
  });
  assert.equal(d.habits.length, 1);
  assert.equal(d.habits[0].reminder.time, '08:00');
  assert.equal(d.checks.length, 1);
});

test('serialize is pretty, human-readable JSON with trailing newline', () => {
  const text = serializeDoc({ ...emptyDoc(), habits: [H('a')] });
  assert.ok(text.endsWith('\n'));
  assert.ok(text.includes('\n  "habits"'));
  assert.equal(JSON.parse(text).format, 'habitgrid');
});
