const PRODUCTION_SETTINGS_URL = "https://fascinating-semolina-24494c.netlify.app/api/settings";

const DEFAULTS = {
  businessName: "Fruto Import",
  whatsapp: "5511996576368",
  home: {},
  quote: {}
};

function json(data, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export default async (req) => {
  if (req.method !== "GET") return json({ error: "Ambiente de teste somente leitura." }, 405);
  try {
    const response = await fetch(PRODUCTION_SETTINGS_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`Produção ${response.status}`);
    return json(await response.json());
  } catch (err) {
    console.warn("Não foi possível copiar configurações do site principal", err);
    return json(DEFAULTS);
  }
};

export const config = {
  path: "/api/settings",
  method: ["GET"]
};
