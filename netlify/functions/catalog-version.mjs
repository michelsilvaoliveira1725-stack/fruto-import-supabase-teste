const SUPABASE_URL = Netlify.env.get("SUPABASE_URL") || "https://scwrzdwxnkjqkiawvdve.supabase.co";
const SUPABASE_KEY = Netlify.env.get("SUPABASE_PUBLISHABLE_KEY") || Netlify.env.get("SUPABASE_ANON_KEY") || "";

function json(data, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export default async (req) => {
  if (req.method !== "GET") return json({ error: "Método não permitido." }, 405);
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_catalog_version`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json"
      },
      body: "{}",
      cache: "no-store"
    });
    if (!r.ok) throw new Error(`Supabase ${r.status}`);
    return json(await r.json());
  } catch (e) {
    console.error(e);
    return json({ error: "Não foi possível verificar a versão do catálogo." }, 502);
  }
};

export const config = { path: "/api/catalog-version", method: ["GET"] };
