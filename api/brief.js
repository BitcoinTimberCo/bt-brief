const briefs = {};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Api-Key');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const API_KEY = process.env.BT_API_KEY || 'bt-2026-canje-river';

  if (req.method === 'POST') {
    const apiKey = req.headers['x-api-key'];
    if (apiKey !== API_KEY) return res.status(401).json({ error: 'Unauthorized' });

    const { brief, date } = req.body;
    if (!brief || !date) return res.status(400).json({ error: 'Missing brief or date' });

    const data = { brief, date, stored_at: new Date().toISOString() };

    // Store in Vercel Blob if available, otherwise memory
    try {
      const { put } = await import('@vercel/blob');
      await put(`briefs/${date}.json`, JSON.stringify(data), {
        access: 'public',
        addRandomSuffix: false,
      });
    } catch (e) {
      console.log('[bt-brief] Blob unavailable, memory only:', e.message);
      briefs[date] = data;
    }

    return res.status(200).json({ ok: true, date, stored_at: data.stored_at });
  }

  if (req.method === 'GET') {
    const { date, list: listMode } = req.query;

    // Try Blob first
    try {
      const { list: blobList } = await import('@vercel/blob');
      const { blobs } = await blobList({ prefix: 'briefs/' });

      if (listMode === 'true') {
        const dates = (blobs || [])
          .map(b => b.pathname.replace('briefs/', '').replace('.json', ''))
          .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d))
          .sort()
          .reverse();
        return res.json({ dates });
      }

      if (blobs && blobs.length > 0) {
        let target;
        if (date) {
          target = blobs.find(b => b.pathname === `briefs/${date}.json`);
        }
        if (!target) {
          const sorted = [...blobs].sort((a, b) => b.pathname.localeCompare(a.pathname));
          target = sorted[0];
        }
        if (target) {
          const r = await fetch(target.url);
          const data = await r.json();
          return res.json(data);
        }
      }
    } catch (e) {
      console.log('[bt-brief] Blob read failed:', e.message);
    }

    // Fallback to memory
    if (listMode === 'true') {
      return res.json({ dates: Object.keys(briefs).sort().reverse() });
    }

    if (date && briefs[date]) return res.json(briefs[date]);
    const keys = Object.keys(briefs).sort().reverse();
    if (keys.length > 0) return res.json(briefs[keys[0]]);

    return res.json({ brief: null, date: date || null });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
