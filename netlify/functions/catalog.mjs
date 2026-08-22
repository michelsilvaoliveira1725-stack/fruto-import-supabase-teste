const SUPABASE_URL = "https://scwrzdwxnkjqkiawvdve.supabase.co";
const SUPABASE_KEY = "sb_publishable_f821-OWArHB9RaagXwsDCw_L9oEF1mO";

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" }
  });
}

async function readSupabaseCatalog() {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_public_catalog`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json"
    },
    body: "{}"
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase ${response.status}: ${text.slice(0, 180)}`);
  }
  const data = await response.json();
  return data && typeof data === "object" ? data : { products: [] };
}

export default async (req) => {
  if (req.method !== "GET") return json({ error: "Ambiente de teste somente leitura." }, 405);
  try {
    const data = await readSupabaseCatalog();
    return json(data);
  } catch (err) {
    console.error("Falha ao ler catálogo do Supabase", err);
    return json({ error: "Não foi possível carregar o catálogo de teste." }, 502);
  }
};

export const config = {
  path: "/api/products",
  method: ["GET"]
};
