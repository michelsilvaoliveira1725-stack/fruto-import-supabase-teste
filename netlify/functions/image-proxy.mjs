function allowedImageUrl(raw) {
  const allowedHosts = new Set([
    "scwrzdwxnkjqkiawvdve.supabase.co",
    "cdn.shopify.com",
    "img2.activant-inet.com",
    "cdn.abicart.com"
  ]);
  try {
    const url = new URL(String(raw || ""));
    if (url.protocol !== "https:") return null;
    if (url.username || url.password) return null;
    if (!allowedHosts.has(url.hostname.toLowerCase())) return null;
    return url;
  } catch {
    return null;
  }
}

export default async (req) => {
  if (req.method !== "GET") return new Response("Método não permitido.", { status: 405 });

  const source = allowedImageUrl(new URL(req.url).searchParams.get("url"));
  if (!source) return new Response("Imagem inválida.", { status: 400 });

  try {
    const upstream = await fetch(source, {
      headers: {
        Accept: "image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8,*/*;q=0.5",
        "User-Agent": "FrutoImportImageProxy/1.0"
      },
      redirect: "follow"
    });

    if (!upstream.ok) {
      return new Response("Imagem não encontrada.", { status: upstream.status === 404 ? 404 : 502 });
    }

    const type = String(upstream.headers.get("content-type") || "").toLowerCase();
    if (!type.startsWith("image/")) return new Response("Conteúdo inválido.", { status: 415 });

    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": type.split(";")[0] || "image/jpeg",
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch (error) {
    console.error("image-proxy", error);
    return new Response("Não foi possível carregar a imagem.", { status: 502 });
  }
};

export const config = {
  path: "/api/image-proxy"
};
