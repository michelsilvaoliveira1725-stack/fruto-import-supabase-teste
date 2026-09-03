import { getAuthConfig, signToken, requireAdmin, json } from "../lib/auth.mjs";

const SUPABASE_URL = Netlify.env.get("SUPABASE_URL") || "https://scwrzdwxnkjqkiawvdve.supabase.co";
const SUPABASE_ANON_KEY = Netlify.env.get("SUPABASE_ANON_KEY") || Netlify.env.get("SUPABASE_PUBLISHABLE_KEY") || "";

async function internalAdminToken() {
  const config = await getAuthConfig();
  if (!config) throw new Error("Administrador não configurado.");
  return signToken(config);
}

async function callEdge(payload) {
  const token = await internalAdminToken();
  const r = await fetch(`${SUPABASE_URL}/functions/v1/fruto-quote-requests`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      "x-fruto-admin-token": token
    },
    body: JSON.stringify(payload),
    cache: "no-store"
  });
  let data = {};
  try { data = await r.json(); } catch {}
  if (!r.ok) throw Object.assign(new Error(data?.error || "Não foi possível concluir a operação."), { status: r.status });
  return data;
}

export default async (req) => {
  try {
    if (req.method === "POST") {
      let body;
      try { body = await req.json(); } catch { return json({ error: "Dados inválidos." }, 400); }
      // A criação é pública, mas só é aceita no Supabase se o quote_id já tiver sido
      // finalizado pelo controle de estoque.
      const data = await callEdge({ action: "save", ...body });
      return json(data, 200);
    }

    if (!(await requireAdmin(req))) return json({ error: "Sessão inválida ou expirada." }, 401);

    if (req.method === "GET") {
      const url = new URL(req.url);
      const quoteId = String(url.searchParams.get("quoteId") || "").trim();
      if (quoteId) return json(await callEdge({ action: "pdf", quoteId }), 200);
      return json(await callEdge({ action: "list" }), 200);
    }

    if (req.method === "PATCH") {
      let body;
      try { body = await req.json(); } catch { return json({ error: "Dados inválidos." }, 400); }
      return json(await callEdge({ action: "check", quoteId: body?.quoteId, checked: body?.checked === true }), 200);
    }

    return json({ error: "Método não permitido." }, 405);
  } catch (e) {
    console.error(e);
    return json({ error: e.message || "Não foi possível concluir a operação." }, Number(e.status) || 502);
  }
};

export const config = { path: "/api/quote-requests", method: ["GET", "POST", "PATCH"] };
