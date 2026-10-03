import { getStore } from "@netlify/blobs";

const FALLBACK_PASSCODE = "ECD-Elite2026";
const TYPES = ["sim", "quiz"];
const TRACKS = ["sales", "module1", "module2", "module3"];

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

const str = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.min(1000, Math.round(n))) : 0;
};

function validTime(v) {
  const t = new Date(v).getTime();
  const now = Date.now();
  if (Number.isFinite(t) && t >= Date.parse("2026-01-01") && t <= now + 60000) return new Date(t).toISOString();
  return new Date(now).toISOString();
}

export function cleanPayload(body) {
  if (!body || typeof body !== "object") return null;
  const name = str(body.name, 80);
  if (!name) return null;
  const type = TYPES.includes(body.type) ? body.type : "sim";
  const track = TRACKS.includes(body.track) ? body.track : "sales";
  const total = num(body.total);
  if (!total) return null;
  return {
    type,
    track,
    name,
    scenarioId: str(body.scenarioId, 60),
    scenarioTitle: str(body.scenarioTitle, 200),
    good: Math.min(num(body.good), total),
    risky: num(body.risky),
    poor: num(body.poor),
    total,
    timestamp: validTime(body.timestamp),
  };
}

export function makeHandler(getStoreFn, getPasscode) {
  return async (req) => {
    const store = getStoreFn("results");

    if (req.method === "POST") {
      let body;
      try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
      const clean = cleanPayload(body);
      if (!clean) return json({ error: "Invalid result" }, 400);
      const key = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      await store.setJSON(key, clean);
      return json({ ok: true });
    }

    if (req.method === "GET") {
      if (req.headers.get("x-admin-passcode") !== getPasscode()) {
        return json({ error: "Unauthorized" }, 401);
      }
      const { blobs } = await store.list();
      const items = (
        await Promise.all(blobs.map((b) => store.get(b.key, { type: "json" }).catch(() => null)))
      ).filter(Boolean);
      items.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      return json({ items });
    }

    return json({ error: "Method not allowed" }, 405);
  };
}

export default makeHandler(
  getStore,
  () => (globalThis.Netlify && Netlify.env.get("ADMIN_PASSCODE")) || FALLBACK_PASSCODE
);

export const config = { path: "/api/results" };
