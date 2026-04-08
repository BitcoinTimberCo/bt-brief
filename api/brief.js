import { kv } from '@vercel/kv';

const API_KEY = process.env.BT_API_KEY || 'bt-2026-canje-river';
const PREFIX = 'brief:';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Api-Key');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'POST') {
    const apiKey = req.headers['x-api-key'];
    if (apiKey !== API_KEY) return res.status(401).json({ error: 'Unauthorized' });

    const { brief, date } = req.body;
    if (!brief || !date) return res.status(400).json({ error: 'Missing brief or date' });

    const data = { brief, date, stored_at: new Date().toISOString() };

    try {
      await kv.set(`${PREFIX}${date}`, JSON.stringify(data));
      // Maintain a sorted set of dates for quick listing
      await kv.zadd('brief:dates', { score: Date.parse(date + 'T00:00:00Z'), member: date });
    } catch (e) {
      console.error('[bt-brief] KV write error:', e.message);
      return res.status(500).json({ error: 'Storage write failed', detail: e.message });
    }

    return res.status(200).json({ ok: true, date, stored_at: data.stored_at });
  }

  if (req.method === 'GET') {
    const { date, list: listMode } = req.query;

    try {
      // List all available brief dates
      if (listMode === 'true') {
        const dates = await kv.zrange('brief:dates', 0, -1, { rev: true });
        return res.json({ dates: dates || [] });
      }

      // Fetch specific date
      if (date) {
        const raw = await kv.get(`${PREFIX}${date}`);
        if (raw) {
          const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
          return res.json(data);
        }
        return res.json({ brief: null, date });
      }

      // No date specified — return latest
      const dates = await kv.zrange('brief:dates', 0, 0, { rev: true });
      if (dates && dates.length > 0) {
        const latest = dates[0];
        const raw = await kv.get(`${PREFIX}${latest}`);
        if (raw) {
          const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
          return res.json(data);
        }
      }

      return res.json({ brief: null, date: null });
    } catch (e) {
      console.error('[bt-brief] KV read error:', e.message);
      return res.status(500).json({ error: 'Storage read failed', detail: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
