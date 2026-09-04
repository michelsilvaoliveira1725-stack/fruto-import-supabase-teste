import { requireAdmin, json } from "../lib/auth.mjs";
import {
  getPortalState, savePortalState, clientPublic, publicPortalState,
  makeClient, passwordMatches, signClientSession, clientFromRequest,
  sessionCookie, clearSessionCookie
} from "../lib/client-portal.mjs";

function responseJson(data, status = 200, headers = {}) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store", ...headers } });
}
function clean(value, max = 160) { return String(value ?? "").trim().slice(0, max); }

export default async (req, context) => {
  const action = clean(context?.params?.action || new URL(req.url).pathname.split("/").pop(), 30).toLowerCase();
  const state = await getPortalState();

  if (action === "status" && req.method === "GET") {
    const client = state.enabled ? await clientFromRequest(req, state) : null;
    return json(publicPortalState(state, client));
  }

  if (action === "login" && req.method === "POST") {
    if (!state.enabled) return json({ error: "O acesso exclusivo está desativado no momento." }, 409);
    let body;
    try { body = await req.json(); } catch { return json({ error: "Dados inválidos." }, 400); }
    const login = clean(body?.login, 160).normalize("NFKC").toLowerCase();
    const client = state.clients.find(c => c.login === login && c.active !== false);
    if (!client || !passwordMatches(body?.password || "", client)) {
      return json({ error: "Login ou senha inválidos." }, 401);
    }
    const token = signClientSession(state, client);
    return responseJson({ ok: true, client: clientPublic(client), revision: state.updatedAt }, 200, { "Set-Cookie": sessionCookie(token) });
  }

  if (action === "logout" && req.method === "POST") {
    return responseJson({ ok: true }, 200, { "Set-Cookie": clearSessionCookie() });
  }

  if (action !== "admin") return json({ error: "Ação não encontrada." }, 404);
  if (!(await requireAdmin(req))) return json({ error: "Acesso não autorizado." }, 401);

  if (req.method === "GET") {
    return json({
      ok: true,
      enabled: state.enabled,
      revision: state.updatedAt,
      clients: state.clients.map(clientPublic)
    });
  }

  if (req.method === "PUT") {
    let body;
    try { body = await req.json(); } catch { return json({ error: "Dados inválidos." }, 400); }
    const enabled = body?.enabled === true;
    if (enabled && !state.clients.some(c => c.active !== false)) {
      return json({ error: "Cadastre e ative pelo menos um cliente antes de fechar o site." }, 400);
    }
    state.enabled = enabled;
    const saved = await savePortalState(state);
    return json({ ok: true, enabled: saved.enabled, revision: saved.updatedAt, clients: saved.clients.map(clientPublic) });
  }

  if (req.method === "POST") {
    let body;
    try { body = await req.json(); } catch { return json({ error: "Dados inválidos." }, 400); }
    const id = clean(body?.id, 80);
    const existingIndex = id ? state.clients.findIndex(c => c.id === id) : -1;
    const existing = existingIndex >= 0 ? state.clients[existingIndex] : null;
    let next;
    try {
      next = makeClient({
        id,
        name: body?.name,
        login: body?.login,
        password: body?.password,
        discountPercent: body?.discountPercent,
        active: body?.active !== false
      }, existing);
    } catch (e) {
      return json({ error: e.message || "Dados do cliente inválidos." }, 400);
    }
    const duplicate = state.clients.find(c => c.login === next.login && c.id !== next.id);
    if (duplicate) return json({ error: "Já existe outro cliente com esse login." }, 409);

    if (state.enabled && existing && existing.active !== false && next.active === false) {
      const otherActive = state.clients.some(c => c.id !== existing.id && c.active !== false);
      if (!otherActive) return json({ error: "Desative primeiro o portal geral ou mantenha pelo menos um cliente ativo." }, 409);
    }

    if (existingIndex >= 0) state.clients[existingIndex] = next;
    else state.clients.push(next);
    const saved = await savePortalState(state);
    return json({ ok: true, client: clientPublic(next), enabled: saved.enabled, revision: saved.updatedAt, clients: saved.clients.map(clientPublic) });
  }

  if (req.method === "DELETE") {
    const id = clean(new URL(req.url).searchParams.get("id"), 80);
    const existing = state.clients.find(c => c.id === id);
    if (!existing) return json({ ok: true, deleted: false, clients: state.clients.map(clientPublic) });
    if (state.enabled && existing.active !== false) {
      const otherActive = state.clients.some(c => c.id !== id && c.active !== false);
      if (!otherActive) return json({ error: "Desative primeiro o portal geral ou mantenha pelo menos um cliente ativo." }, 409);
    }
    state.clients = state.clients.filter(c => c.id !== id);
    const saved = await savePortalState(state);
    return json({ ok: true, deleted: true, enabled: saved.enabled, revision: saved.updatedAt, clients: saved.clients.map(clientPublic) });
  }

  return json({ error: "Método não permitido." }, 405);
};

export const config = {
  path: "/api/client-access/:action",
  method: ["GET", "POST", "PUT", "DELETE"]
};
