import { requireAdmin, json } from "../lib/auth.mjs";
import { getPortalState, clientFromRequest, clientPublic } from "../lib/client-portal.mjs";

const SUPABASE_URL = Netlify.env.get("SUPABASE_URL") || "https://scwrzdwxnkjqkiawvdve.supabase.co";
const SUPABASE_KEY = Netlify.env.get("SUPABASE_PUBLISHABLE_KEY") || "";
const SUPABASE_ANON_KEY = Netlify.env.get("SUPABASE_ANON_KEY") || "";

async function publicCatalog() {
  const key = SUPABASE_KEY || SUPABASE_ANON_KEY;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_public_catalog`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: "{}"
  });
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${(await r.text()).slice(0,180)}`);
  return await r.json();
}

function edgeToken(req) {
  const h = req.headers.get("authorization") || "";
  return h.startsWith("Bearer ") ? h.slice(7) : "";
}

async function callWriteEdge(req, payload) {
  const adminToken = edgeToken(req);
  const r = await fetch(`${SUPABASE_URL}/functions/v1/fruto-admin-products`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      "x-fruto-admin-token": adminToken
    },
    body: JSON.stringify(payload)
  });
  let data = {};
  try { data = await r.json(); } catch {}
  if (!r.ok) return json({ error: data?.error || "Não foi possível salvar no Supabase." }, r.status);
  return json(data, r.status);
}

export default async (req, context) => {
  const code = context.params.code ? decodeURIComponent(context.params.code) : "";

  if (req.method === "GET") {
    try {
      const data = await publicCatalog();
      // O ADM continua consultando o catálogo normalmente mesmo com o portal privado ativo.
      if (await requireAdmin(req)) return json(data);

      const portal = await getPortalState();
      if (!portal.enabled) return json(data);

      const client = await clientFromRequest(req, portal);
      if (!client) return json({ error: "Faça login para acessar o catálogo.", portalRequired: true }, 401);

      const products = Array.isArray(data) ? data : (Array.isArray(data?.products) ? data.products : []);
      const mapped = products.map(product => ({ ...product, clientDiscountPercent: client.discountPercent || 0 }));
      const base = Array.isArray(data) ? {} : data;
      return json({ ...base, products: mapped, portalEnabled: true, client: clientPublic(client), portalRevision: portal.updatedAt });
    }
    catch (e) { console.error(e); return json({ error: "Não foi possível carregar o catálogo." }, 502); }
  }

  if (!(await requireAdmin(req))) return json({ error: "Acesso não autorizado." }, 401);

  if (req.method === "DELETE") return await callWriteEdge(req, { action: "delete", code });

  let body;
  try { body = await req.json(); } catch { return json({ error: "Dados inválidos." }, 400); }

  if (req.method === "PUT" && code === "bulk-price") {
    return await callWriteEdge(req, { action: "bulk-price", ...body });
  }
  if (req.method === "PUT" && code === "bulk-organize") {
    return await callWriteEdge(req, { action: "bulk-organize", ...body });
  }
  if (req.method === "POST") return await callWriteEdge(req, { action: "create", product: body });
  if (req.method === "PUT") return await callWriteEdge(req, { action: "update", oldCode: code, product: body });
  return json({ error: "Método não permitido." }, 405);
};

export const config = {
  path: ["/api/products", "/api/products/:code"],
  method: ["GET", "POST", "PUT", "DELETE"]
};
