import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runReminders, localParts } from './reminders.js';
import { emptyDoc } from '../shared/doc.js';

const habit = { id: 'h1', name: 'Read', color: '#000', position: 0, reminder: { enabled: true, time: '08:00' }, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', deleted: false };
const sub = { endpoint: 'https://push.example/abc', keys: { p256dh: 'x', auth: 'y' }, timeZone: 'Europe/London' };
// 2026-11-25 08:30 in London (GMT in November)
const now = new Date('2026-11-25T08:30:00Z');

test('localParts uses the device time zone', () => {
  assert.deepEqual(localParts(now, 'Europe/London'), { date: '2026-11-25', minutes: 510 });
});

test('sends a due reminder once', async () => {
  const sent = [];
  const send = async (s, p) => sent.push(p);
  const doc = { ...emptyDoc(), habits: [habit] };
  const first = await runReminders({ doc, pushState: { subscriptions: [sub], sent: {} }, now, send });
  assert.equal(first.count, 1);
  assert.equal(sent[0].body, 'Time for: Read');
  const second = await runReminders({ doc, pushState: { subscriptions: [sub], sent: first.sent }, now, send });
  assert.equal(second.count, 0);
});

test('skips a habit already ticked today', async () => {
  const doc = { ...emptyDoc(), habits: [habit], checks: [{ habit: 'h1', date: '2026-11-25', done: true, updatedAt: '2026-11-25T07:00:00Z' }] };
  const r = await runReminders({ doc, pushState: { subscriptions: [sub], sent: {} }, now, send: async () => assert.fail('should not send') });
  assert.equal(r.count, 0);
});

test('not due before the time, and not after the window', async () => {
  const doc = { ...emptyDoc(), habits: [habit] };
  const early = await runReminders({ doc, pushState: { subscriptions: [sub], sent: {} }, now: new Date('2026-11-25T07:59:00Z'), send: async () => assert.fail() });
  const late = await runReminders({ doc, pushState: { subscriptions: [sub], sent: {} }, now: new Date('2026-11-25T09:05:00Z'), send: async () => assert.fail() });
  assert.equal(early.count + late.count, 0);
});

test('a gone device (410) is dropped', async () => {
  const doc = { ...emptyDoc(), habits: [habit] };
  const r = await runReminders({ doc, pushState: { subscriptions: [sub], sent: {} }, now, send: async () => { const e = new Error('gone'); e.statusCode = 410; throw e; } });
  assert.equal(r.dropped.has(sub.endpoint), true);
});
