import { getStore } from "@netlify/blobs";
import { getAuthConfig, signToken, requireAdmin, json } from "../lib/auth.mjs";

const SUPABASE_URL = Netlify.env.get("SUPABASE_URL") || "https://scwrzdwxnkjqkiawvdve.supabase.co";
const SUPABASE_ANON_KEY = Netlify.env.get("SUPABASE_ANON_KEY") || "";
const STORE = "fruto-import-images";
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

async function internalAdminToken() {
  const config = await getAuthConfig();
  if (!config) throw new Error("Administrador não configurado.");
  return signToken(config);
}

async function edge(method, body) {
  const headers = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    "x-fruto-admin-token": await internalAdminToken()
  };
  const r = await fetch(`${SUPABASE_URL}/functions/v1/fruto-admin-images`, { method, headers, body });
  let data = {};
  try { data = await r.json(); } catch {}
  if (!r.ok) return json({ error: data?.error || "Não foi possível concluir a operação da imagem." }, r.status);
  return json(data, r.status);
}

export default async (req, context) => {
  const id = context.params.id;

  // Compatibilidade com imagens legadas ainda existentes no Netlify Blobs.
  if (req.method === "GET") {
    if (!id) return new Response("Imagem não encontrada", { status: 404 });
    const entry = await getStore(STORE).getWithMetadata(id, { type: "blob" });
    if (!entry?.data) return new Response("Imagem não encontrada", { status: 404 });
    const type = entry.metadata?.contentType || entry.data.type || "image/jpeg";
    return new Response(entry.data, { headers: { "Content-Type": type, "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" } });
  }

  if (!(await requireAdmin(req))) return json({ error: "Acesso não autorizado." }, 401);

  if (req.method === "POST") {
    let form;
    try { form = await req.formData(); } catch { return json({ error: "Upload inválido." }, 400); }
    const file = form.get("file");
    if (!(file instanceof Blob)) return json({ error: "Selecione uma foto." }, 400);
    if (!ALLOWED.has(file.type)) return json({ error: "Use uma imagem JPG, PNG ou WebP." }, 400);
    const out = new FormData(); out.append("file", file, file.name || "imagem");
    return await edge("POST", out);
  }

  if (req.method === "DELETE") {
    if (id) {
      await getStore(STORE).delete(id);
      return json({ ok: true });
    }
    let body = {};
    try { body = await req.json(); } catch {}
    const storageId = String(body?.id || "");
    return await edge("DELETE", JSON.stringify({ id: storageId }));
  }
  return json({ error: "Método não permitido." }, 405);
};

export const config = {
  path: ["/api/images", "/api/images/:id"],
  method: ["GET", "POST", "DELETE"]
};
