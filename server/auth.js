import { timingSafeEqual } from 'node:crypto';

// Constant-time check of "Authorization: Bearer <secret>" against an env var.
export function requireBearer(req, res, envName) {
  const expected = process.env[envName];
  if (!expected) {
    res.status(500).json({ error: `${envName} is not set on the server` });
    return false;
  }
  const header = req.headers.authorization || '';
  const given = header.startsWith('Bearer ') ? header.slice(7) : '';
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    res.status(401).json({ error: 'unauthorized' });
    return false;
  }
  return true;
}

export function readBody(req) {
  if (req.body == null) return {};
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return req.body;
}
