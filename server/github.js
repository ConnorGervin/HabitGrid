// Stores JSON files in a PRIVATE GitHub repo (the "data repo").
// Every change is a git commit, so you get history and backups for free.
// Writes use the file's blob sha for optimistic concurrency: on a conflict
// (409) we re-read, re-merge and retry.

const API = 'https://api.github.com';

function config() {
  const repo = process.env.GITHUB_DATA_REPO; // e.g. "your-name/habitgrid-data"
  const token = process.env.GITHUB_TOKEN;    // fine-grained PAT: Contents read/write on that repo only
  if (!repo || !token) {
    const err = new Error('GITHUB_DATA_REPO and GITHUB_TOKEN must be set');
    err.status = 500;
    throw err;
  }
  return { repo, token };
}

const headers = (token) => ({
  Authorization: `Bearer ${token}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'habitgrid',
});

// Retries transient GitHub failures (5xx, 429, network errors) with short backoff.
async function fetchWithRetry(url, options, attempts = 4) {
  let lastStatus = 'network error';
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, options);
      // 5xx, 429, and GitHub's rate limits (403 with Retry-After) are worth retrying.
      const rateLimited = res.status === 403 && res.headers.get('retry-after');
      if (res.status < 500 && res.status !== 429 && !rateLimited) return res;
      lastStatus = res.status;
    } catch (err) {
      lastStatus = err.message;
    }
    if (i < attempts - 1) await new Promise((r) => setTimeout(r, 500 * 2 ** i));
  }
  throw httpError(503, `GitHub is temporarily unavailable (last status: ${lastStatus}). Your changes are saved on this device and will sync automatically.`);
}

export async function readJson(path, fallback) {
  const { repo, token } = config();
  const res = await fetchWithRetry(`${API}/repos/${repo}/contents/${path}`, { headers: headers(token) });
  if (res.status === 404) return { data: structuredClone(fallback), sha: null };
  if (!res.ok) throw httpError(502, `GitHub read ${path} failed: HTTP ${res.status}`);
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
  if (!res.ok) throw httpError(502, `GitHub write ${path} failed: HTTP ${res.status}`);
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
  throw httpError(409, `could not update ${path} after ${attempts} attempts`);
}

export function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}
