import { getAuthConfig, signToken, requireAdmin, json } from "../lib/auth.mjs";

const SUPABASE_URL = Netlify.env.get("SUPABASE_URL") || "https://scwrzdwxnkjqkiawvdve.supabase.co";
const SUPABASE_ANON_KEY = Netlify.env.get("SUPABASE_ANON_KEY") || Netlify.env.get("SUPABASE_PUBLISHABLE_KEY") || "";

async function internalAdminToken() {
  const config = await getAuthConfig();
  if (!config) throw new Error("Administrador não configurado.");
  return signToken(config);
}

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);
  if (!(await requireAdmin(req))) return json({ error: "Acesso não autorizado." }, 401);

  let body;
  try { body = await req.json(); } catch { return json({ error: "Dados inválidos." }, 400); }

  const token = await internalAdminToken();
  const r = await fetch(`${SUPABASE_URL}/functions/v1/fruto-product-sale-pack`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      "x-fruto-admin-token": token
    },
    body: JSON.stringify({ code: body?.code, salePack: body?.salePack }),
    cache: "no-store"
  });
  let data = {};
  try { data = await r.json(); } catch {}
  if (!r.ok) return json({ error: data?.error || "Não foi possível salvar a venda por caixa." }, r.status);
  return json(data, 200);
};

export const config = { path: "/api/product-sale-pack", method: ["POST"] };
