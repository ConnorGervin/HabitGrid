// Stores JSON files in a PRIVATE GitHub repo (the "data repo").
// Every change is a git commit, so you get history and backups for free.
// Writes use the file's blob sha for optimistic concurrency: on a conflict
// (409) we re-read, re-merge and retry.

const API = 'https://api.github.com';

function config() {
  const repo = process.env.GITHUB_DATA_REPO; // e.g. "your-name/habitgrid-data"
  const token = process.env.GITHUB_TOKEN;    // fine-grained PAT: Contents read/write on that repo only
  if (!repo || !token) {
    console.error('GITHUB_DATA_REPO and GITHUB_TOKEN must be set');
    throw httpError(500, GENERIC_FAILURE);
  }
  return { repo, token };
}

const headers = (token) => ({
  Authorization: `Bearer ${token}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'habitgrid',
});

const GENERIC_FAILURE = 'Could not reach your data store. Your changes are saved on this device and will sync automatically.';

// Retries any failed call, with backoff. 404 (no file yet), 409/422 (stale copy, handled by the
// caller) and 401 (bad credentials) are answers rather than failures, so they are returned as-is.
async function fetchWithRetry(url, options, attempts = 7) {
  let lastError;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, options);
      if (res.ok || [401, 404, 409, 422].includes(res.status)) return res;
      lastError = `status ${res.status}`;
    } catch (err) {
      lastError = err.message;
    }
    console.error('GitHub call failed, retrying:', lastError);
    // Backoff with jitter: 0.5s, 1s, 2s, 4s, 4s, 4s (about 15s in total).
    if (i < attempts - 1) await new Promise((r) => setTimeout(r, Math.min(4000, 500 * 2 ** i) * (0.8 + Math.random() * 0.4)));
  }
  throw httpError(500, GENERIC_FAILURE);
}

export async function readJson(path, fallback) {
  const { repo, token } = config();
  const res = await fetchWithRetry(`${API}/repos/${repo}/contents/${path}`, { headers: headers(token) });
  if (res.status === 404) return { data: structuredClone(fallback), sha: null };
  if (!res.ok) throw httpError(500, GENERIC_FAILURE);
  const file = await res.json();
  const text = Buffer.from(file.content, 'base64').toString('utf8');
  return { data: JSON.parse(text), sha: file.sha };
}

async function writeJson(path, data, sha, message) {
  const { repo, token } = config();
  const body = {
    message,
    content: Buffer.from(JSON.stringify(data, null, 2) + '\n', 'utf8').toString('base64'),
    ...(sha ? { sha } : {}),
  };
  const res = await fetchWithRetry(`${API}/repos/${repo}/contents/${path}`, {
    method: 'PUT',
    headers: { ...headers(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (res.status === 409 || res.status === 422) return false; // stale sha: caller retries
  if (!res.ok) throw httpError(500, GENERIC_FAILURE);
  return true;
}

// Read-modify-write with retries. `transform(current)` returns the new data.
// If the result is unchanged, nothing is committed.
export async function updateJson(path, fallback, transform, message, attempts = 4) {
  for (let i = 0; i < attempts; i++) {
    const { data, sha } = await readJson(path, fallback);
    const next = transform(data);
    if (JSON.stringify(next) === JSON.stringify(data) && sha) return next;
    if (await writeJson(path, next, sha, message)) return next;
  }
  throw httpError(500, GENERIC_FAILURE);
}

export function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}
