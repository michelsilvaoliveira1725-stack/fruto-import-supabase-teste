import { getAuthConfig, signToken, json } from "../lib/auth.mjs";

const SUPABASE_URL = Netlify.env.get("SUPABASE_URL") || "https://scwrzdwxnkjqkiawvdve.supabase.co";
const SUPABASE_ANON_KEY = Netlify.env.get("SUPABASE_ANON_KEY") || Netlify.env.get("SUPABASE_PUBLISHABLE_KEY") || "";

function validUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
}

async function internalAdminToken() {
  const config = await getAuthConfig();
  if (!config) throw new Error("Administrador não configurado.");
  return signToken(config);
}

async function signedPdfUrl(quoteId) {
  const token = await internalAdminToken();
  const r = await fetch(`${SUPABASE_URL}/functions/v1/fruto-quote-requests`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      "x-fruto-admin-token": token
    },
    body: JSON.stringify({ action: "pdf", quoteId }),
    cache: "no-store"
  });
  let data = {};
  try { data = await r.json(); } catch {}
  if (!r.ok || !data?.url) {
    const err = new Error(data?.error || "PDF não encontrado.");
    err.status = r.status || 404;
    throw err;
  }
  return data.url;
}

export default async (req) => {
  if (req.method !== "GET") return json({ error: "Método não permitido." }, 405);

  try {
    const url = new URL(req.url);
    const quoteId = String(url.searchParams.get("quoteId") || "").trim();
    if (!validUuid(quoteId)) return json({ error: "Orçamento inválido." }, 400);

    const signedUrl = await signedPdfUrl(quoteId);
    const pdf = await fetch(signedUrl, { cache: "no-store" });
    if (!pdf.ok) return json({ error: "PDF não encontrado ou indisponível." }, 404);

    const bytes = await pdf.arrayBuffer();
    return new Response(bytes, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="fruto-importadora-orcamento-${quoteId.slice(0, 8)}.pdf"`,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch (e) {
    console.error("quote-file", e);
    return json({ error: e?.message || "Não foi possível abrir o PDF." }, Number(e?.status) || 502);
  }
};

export const config = { path: "/api/quote-file", method: ["GET"] };
