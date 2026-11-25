// GET  /api/data  -> the full habit document (habits.json in the data repo)
// PUT  /api/data  -> body: a habit document from a device; the server merges it
//                    into what is stored and returns the merged result.
import { requireBearer, readBody } from '../server/auth.js';
import { readJson, updateJson } from '../server/github.js';
import { emptyDoc, mergeDocs, normalizeDoc } from '../shared/doc.js';

export default async function handler(req, res) {
  if (!requireBearer(req, res, 'SYNC_TOKEN')) return;
  try {
    if (req.method === 'GET') {
      const { data } = await readJson('habits.json', emptyDoc());
      return res.status(200).json(normalizeDoc(data));
    }
    if (req.method === 'PUT') {
      const incoming = normalizeDoc(readBody(req));
      const merged = await updateJson(
        'habits.json',
        emptyDoc(),
        (current) => mergeDocs(current, incoming),
        'Sync habits',
      );
      return res.status(200).json(normalizeDoc(merged));
    }
    res.setHeader('Allow', 'GET, PUT');
    return res.status(405).json({ error: 'method not allowed' });
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
}
