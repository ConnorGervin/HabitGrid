import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

// In-memory stand-in for the GitHub Contents API.
let files, writes, conflictNext, flakyNext, realFetch;
beforeEach(() => {
  files = {}; writes = 0; conflictNext = 0; flakyNext = 0;
  process.env.GITHUB_DATA_REPO = 'me/data';
  process.env.GITHUB_TOKEN = 'gh';
  process.env.SYNC_TOKEN = 'sync-secret';
  realFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts = {}) => {
    const path = new URL(url).pathname.replace('/repos/me/data/contents/', '');
    const method = opts.method || 'GET';
    if (flakyNext > 0) { flakyNext--; return new Response('unavailable', { status: 503 }); }
    if (method === 'GET') {
      if (!files[path]) return new Response('{}', { status: 404 });
      return Response.json({ sha: files[path].sha, content: Buffer.from(files[path].text).toString('base64') });
    }
    const body = JSON.parse(opts.body);
    if (conflictNext > 0) { conflictNext--; return new Response('conflict', { status: 409 }); }
    const current = files[path]?.sha;
    if ((body.sha ?? null) !== (current ?? null)) return new Response('stale', { status: 409 });
    writes++;
    files[path] = { sha: `sha${writes}`, text: Buffer.from(body.content, 'base64').toString('utf8') };
    return Response.json({ content: {} });
  };
});
afterEach(() => { globalThis.fetch = realFetch; });

function fakeRes() {
  const r = { statusCode: 200, body: null, headers: {} };
  r.status = (c) => { r.statusCode = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  r.setHeader = (k, v) => { r.headers[k] = v; };
  r.end = () => r;
  return r;
}
const req = (method, body, token = 'sync-secret') => ({
  method, body, headers: { authorization: `Bearer ${token}` },
});

const habit = (id, extra = {}) => ({ id, name: id, color: '#000', position: 0, reminder: { enabled: false, time: '08:00' }, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', deleted: false, ...extra });

test('rejects a wrong sync token', async () => {
  const { default: handler } = await import('../api/data.js');
  const res = fakeRes();
  await handler(req('GET', null, 'nope'), res);
  assert.equal(res.statusCode, 401);
});

test('GET on an empty repo returns an empty document', async () => {
  const { default: handler } = await import('../api/data.js');
  const res = fakeRes();
  await handler(req('GET'), res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.habits, []);
});

test('PUT merges with stored data and writes habits.json', async () => {
  const { default: handler } = await import('../api/data.js');
  const phone = { format: 'habitgrid', version: 1, habits: [habit('a')], checks: [] };
  let res = fakeRes();
  await handler(req('PUT', phone), res);
  assert.equal(res.statusCode, 200);
  const desk = { format: 'habitgrid', version: 1, habits: [habit('b')], checks: [{ habit: 'a', date: '2026-11-25', done: true, updatedAt: '2026-11-25T09:00:00Z' }] };
  res = fakeRes();
  await handler(req('PUT', desk), res);
  assert.deepEqual(res.body.habits.map((h) => h.id).sort(), ['a', 'b']);
  assert.equal(res.body.checks.length, 1);
  const stored = JSON.parse(files['habits.json'].text);
  assert.equal(stored.habits.length, 2);
  assert.ok(files['habits.json'].text.includes('\n  "habits"'), 'file is pretty-printed');
});

test('retries after a 409 conflict', async () => {
  const { default: handler } = await import('../api/data.js');
  conflictNext = 1;
  const res = fakeRes();
  await handler(req('PUT', { format: 'habitgrid', version: 1, habits: [habit('a')], checks: [] }), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.habits.length, 1);
});

test('unchanged data is not committed again', async () => {
  const { default: handler } = await import('../api/data.js');
  const doc = { format: 'habitgrid', version: 1, habits: [habit('a')], checks: [] };
  await handler(req('PUT', doc), fakeRes());
  const before = writes;
  await handler(req('PUT', doc), fakeRes());
  assert.equal(writes, before);
});

test('retries a transient GitHub 503 and still succeeds', async () => {
  const { default: handler } = await import('../api/data.js');
  flakyNext = 1;
  const res = fakeRes();
  await handler(req('GET'), res);
  assert.equal(res.statusCode, 200);
});

test('reports GitHub status when GitHub keeps failing', async () => {
  const { default: handler } = await import('../api/data.js');
  flakyNext = 10;
  const res = fakeRes();
  await handler(req('GET'), res);
  assert.equal(res.statusCode, 503);
  assert.match(res.body.error, /GitHub unavailable.*503/);
});
