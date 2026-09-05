import { getStore } from "@netlify/blobs";
import {
  getAuthConfig, createAdmin, passwordHash, safeEqualHex, signToken,
  requireAdmin, updateAdminPassword, adminSessionCookie,
  clearAdminSessionCookie, json
} from "../lib/auth.mjs";
import { timingSafeEqual, createHash } from "node:crypto";

const SETUP_KEY_HASH = "883540d41a7bbf7654e7103e702f9a088bef14606b50907e8b2e9ffe47e4ad21";
const LIMIT_STORE = "fruto-admin-login-limit";
const LIMIT_WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 8;

function safeTextEqual(a, b) {
  const aa = Buffer.from(String(a)); const bb = Buffer.from(String(b));
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}
function validSetupKey(value) {
  const digest = createHash("sha256").update(String(value || "")).digest("hex");
  return safeTextEqual(digest, SETUP_KEY_HASH);
}
function responseJson(data, status = 200, headers = {}) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store", ...headers } });
}
function clientKey(req) {
  const ip = req.headers.get("x-nf-client-connection-ip") || req.headers.get("x-forwarded-for") || "unknown";
  const ua = req.headers.get("user-agent") || "";
  return createHash("sha256").update(`${ip}|${ua}`).digest("hex");
}
async function rateState(req) {
  const key = clientKey(req);
  const store = getStore(LIMIT_STORE);
  const state = await store.get(key, { type: "json", consistency: "strong" }) || { attempts: 0, firstAt: Date.now(), lockedUntil: 0 };
  const now = Date.now();
  if (state.lockedUntil > now) return { key, store, state, blocked: true };
  if (now - Number(state.firstAt || 0) > LIMIT_WINDOW_MS) return { key, store, state: { attempts: 0, firstAt: now, lockedUntil: 0 }, blocked: false };
  return { key, store, state, blocked: false };
}
async function registerFailure(info) {
  const now = Date.now();
  const next = { ...info.state, attempts: Number(info.state.attempts || 0) + 1 };
  if (next.attempts >= MAX_ATTEMPTS) next.lockedUntil = now + LIMIT_WINDOW_MS;
  await info.store.setJSON(info.key, next);
}
async function clearFailures(info) {
  await info.store.setJSON(info.key, { attempts: 0, firstAt: Date.now(), lockedUntil: 0 });
}
function sessionResponse(config, extra = {}) {
  const token = signToken(config);
  return responseJson({ ok: true, token: "cookie", ...extra }, 200, { "Set-Cookie": adminSessionCookie(token) });
}

export default async (req, context) => {
  const action = context.params.action;

  if (req.method === "GET" && action === "status") {
    const config = await getAuthConfig();
    return json({ configured: Boolean(config) });
  }
  if (req.method === "GET" && action === "verify") {
    if (!(await requireAdmin(req))) return json({ error: "Sessão inválida ou expirada." }, 401);
    return json({ ok: true });
  }
  if (req.method === "POST" && action === "logout") {
    return responseJson({ ok: true }, 200, { "Set-Cookie": clearAdminSessionCookie() });
  }
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  let body;
  try { body = await req.json(); } catch { return json({ error: "Dados inválidos." }, 400); }

  if (["login", "reset", "setup"].includes(action)) {
    const rl = await rateState(req);
    if (rl.blocked) return json({ error: "Muitas tentativas. Aguarde alguns minutos e tente novamente." }, 429);

    if (action === "setup") {
      const existing = await getAuthConfig();
      if (existing) return json({ error: "O administrador já foi configurado." }, 409);
      if (!validSetupKey(body.setupKey)) { await registerFailure(rl); return json({ error: "Chave inicial incorreta." }, 401); }
      const password = String(body.password || "");
      if (password.length < 10) return json({ error: "A senha deve ter pelo menos 10 caracteres." }, 400);
      try {
        const config = await createAdmin(password); await clearFailures(rl); return sessionResponse(config);
      } catch { return json({ error: "Não foi possível configurar. Tente entrar com sua senha se o cadastro já tiver sido concluído." }, 409); }
    }

    if (action === "reset") {
      const existing = await getAuthConfig();
      if (!existing) return json({ error: "O administrador ainda não foi configurado." }, 409);
      if (!validSetupKey(body.setupKey)) { await registerFailure(rl); return json({ error: "Chave de recuperação incorreta." }, 401); }
      const password = String(body.password || "");
      if (password.length < 10) return json({ error: "A senha deve ter pelo menos 10 caracteres." }, 400);
      const config = await updateAdminPassword(password); await clearFailures(rl); return sessionResponse(config);
    }

    const config = await getAuthConfig();
    if (!config) return json({ error: "O administrador ainda não foi configurado." }, 409);
    const candidate = passwordHash(String(body.password || ""), config.salt);
    if (!safeEqualHex(candidate, config.passwordHash)) { await registerFailure(rl); return json({ error: "Senha incorreta." }, 401); }
    await clearFailures(rl); return sessionResponse(config);
  }

  if (action === "change-password") {
    if (!(await requireAdmin(req))) return json({ error: "Sessão inválida ou expirada." }, 401);
    const password = String(body.password || "");
    if (password.length < 10) return json({ error: "A nova senha deve ter pelo menos 10 caracteres." }, 400);
    const config = await updateAdminPassword(password);
    return sessionResponse(config);
  }

  return json({ error: "Ação não encontrada." }, 404);
};

export const config = { path: "/api/admin/:action", method: ["GET", "POST"] };
