import { createHash } from "node:crypto";
import { getAuthConfig, signToken } from "../lib/auth.mjs";

const SUPABASE_URL = Netlify.env.get("SUPABASE_URL") || "https://scwrzdwxnkjqkiawvdve.supabase.co";
const SUPABASE_ANON_KEY = Netlify.env.get("SUPABASE_ANON_KEY") || Netlify.env.get("SUPABASE_PUBLISHABLE_KEY") || "";

function json(data, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}
function clean(value, max = 160) { return String(value ?? "").trim().slice(0, max); }
function clientKey(req) {
  const ip = req.headers.get("x-nf-client-connection-ip") || req.headers.get("x-forwarded-for") || "";
  const ua = req.headers.get("user-agent") || "";
  return createHash("sha256").update(`${ip}|${ua}`).digest("hex");
}

async function internalAdminToken() {
  const config = await getAuthConfig();
  if (!config) throw new Error("Administrador não configurado.");
  return signToken(config);
}

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  let body;
  try { body = await req.json(); } catch { return json({ error: "Dados inválidos." }, 400); }

  const items = Array.isArray(body?.items) ? body.items.slice(0, 100).map(item => ({
    code: clean(item?.code, 60),
    qty: Math.max(0, Math.min(9999, Number.parseInt(String(item?.qty ?? 0), 10) || 0))
  })).filter(item => item.code && item.qty > 0) : [];
  const quoteId = clean(body?.quoteId, 80);

  if (!items.length) return json({ error: "O orçamento está vazio." }, 400);

  try {
    const adminToken = await internalAdminToken();

    const r = await fetch(`${SUPABASE_URL}/functions/v1/fruto-finalize-quote`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
        "x-fruto-admin-token": adminToken
      },
      body: JSON.stringify({
        quoteId,
        items,
        customer: clean(body?.customer, 120),
        clientKey: clientKey(req)
      }),
      cache: "no-store"
    });

    let data = {};
    try { data = await r.json(); } catch {}

    if (!r.ok) {
      return json({ error: data?.error || "Não foi possível atualizar o estoque.", ...data }, r.status);
    }

    return json(data, 200);
  } catch (e) {
    console.error(e);
    return json({ error: "Não foi possível atualizar o estoque. Tente novamente." }, 502);
  }
};

export const config = { path: "/api/quote-stock", method: ["POST"] };
