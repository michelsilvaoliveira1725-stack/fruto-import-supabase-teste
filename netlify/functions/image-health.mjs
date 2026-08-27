import { requireAdmin, json } from "../lib/auth.mjs";

const MANAGED_HOST = "scwrzdwxnkjqkiawvdve.supabase.co";
const MANAGED_PREFIX = "/storage/v1/object/public/product-images/uploads/";
const MAX_URLS = 400;
const CONCURRENCY = 12;

function managedUrl(raw) {
  try {
    const u = new URL(String(raw || "").trim());
    if (u.protocol !== "https:") return null;
    if (u.hostname.toLowerCase() !== MANAGED_HOST) return null;
    if (!u.pathname.startsWith(MANAGED_PREFIX)) return null;
    if (u.username || u.password) return null;
    return u;
  } catch {
    return null;
  }
}

async function exists(url) {
  try {
    let r = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      cache: "no-store",
      headers: { "Cache-Control": "no-cache", "Pragma": "no-cache" }
    });
    if (r.status === 405) {
      r = await fetch(url, {
        method: "GET",
        redirect: "follow",
        cache: "no-store",
        headers: { "Range": "bytes=0-0", "Cache-Control": "no-cache", "Pragma": "no-cache" }
      });
    }
    return { ok: r.ok, status: r.status };
  } catch {
    return { ok: false, status: 0 };
  }
}

async function mapLimit(items, limit, worker) {
  const out = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      out[index] = await worker(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return out;
}

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);
  if (!(await requireAdmin(req))) return json({ error: "Acesso não autorizado." }, 401);

  let body = {};
  try { body = await req.json(); } catch { return json({ error: "Dados inválidos." }, 400); }

  const urls = [...new Set((Array.isArray(body?.urls) ? body.urls : [])
    .map(v => String(v || "").trim())
    .filter(Boolean))]
    .slice(0, MAX_URLS);

  const managed = urls.map(value => ({ value, url: managedUrl(value) })).filter(item => item.url);
  const results = await mapLimit(managed, CONCURRENCY, async item => {
    const checked = await exists(item.url);
    return { url: item.value, ok: checked.ok, status: checked.status };
  });

  return json({
    ok: true,
    checked: results.length,
    broken: results.filter(item => !item.ok).map(item => item.url),
    results
  });
};

export const config = {
  path: "/api/image-health",
  method: ["POST"]
};
