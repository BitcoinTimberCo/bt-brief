import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Api-Key");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method === "GET") {
    try {
      const latest = await redis.get("bt-brief:latest");
      if (!latest) {
        return res.status(200).json({ error: "No brief found yet" });
      }
      return res.status(200).json(latest);
    } catch (err) {
      return res.status(500).json({ error: "Failed to fetch brief", detail: err.message });
    }
  }

  if (req.method === "POST") {
    const apiKey = req.headers["x-api-key"];
    const expectedKey = process.env.BRIEF_API_KEY;

    if (!expectedKey) {
      return res.status(500).json({ error: "BRIEF_API_KEY not configured" });
    }

    if (apiKey !== expectedKey) {
      return res.status(401).json({ error: "Invalid API key" });
    }

    try {
      const { brief, date } = req.body;

      if (!brief || !date) {
        return res.status(400).json({ error: "Missing required fields: brief, date" });
      }

      const payload = {
        brief,
        date,
        stored_at: new Date().toISOString(),
      };

      await redis.set("bt-brief:latest", payload);
      await redis.set("bt-brief:" + date, payload);

      return res.status(200).json({ success: true, date });
    } catch (err) {
      return res.status(500).json({ error: "Failed to store brief", detail: err.message });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
