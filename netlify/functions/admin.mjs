import {
  getAuthConfig,
  createAdmin,
  passwordHash,
  safeEqualHex,
  signToken,
  requireAdmin,
  updateAdminPassword,
  json
} from "../lib/auth.mjs";
import { timingSafeEqual, createHash } from "node:crypto";

const SETUP_KEY_HASH = "883540d41a7bbf7654e7103e702f9a088bef14606b50907e8b2e9ffe47e4ad21";

function safeTextEqual(a, b) {
  const aa = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}

function validSetupKey(value) {
  const digest = createHash("sha256").update(String(value || "")).digest("hex");
  return safeTextEqual(digest, SETUP_KEY_HASH);
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

  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  let body;
  try { body = await req.json(); } catch { return json({ error: "Dados inválidos." }, 400); }

  if (action === "setup") {
    const existing = await getAuthConfig();
    if (existing) return json({ error: "O administrador já foi configurado." }, 409);
    if (!validSetupKey(body.setupKey)) return json({ error: "Chave inicial incorreta." }, 401);
    const password = String(body.password || "");
    if (password.length < 8) return json({ error: "A senha deve ter pelo menos 8 caracteres." }, 400);
    try {
      const config = await createAdmin(password);
      return json({ ok: true, token: signToken(config) });
    } catch {
      return json({ error: "Não foi possível configurar. Tente entrar com sua senha se o cadastro já tiver sido concluído." }, 409);
    }
  }

  if (action === "reset") {
    const existing = await getAuthConfig();
    if (!existing) return json({ error: "O administrador ainda não foi configurado." }, 409);
    if (!validSetupKey(body.setupKey)) return json({ error: "Chave de recuperação incorreta." }, 401);
    const password = String(body.password || "");
    if (password.length < 8) return json({ error: "A senha deve ter pelo menos 8 caracteres." }, 400);
    const config = await updateAdminPassword(password);
    return json({ ok: true, token: signToken(config) });
  }

  if (action === "change-password") {
    if (!(await requireAdmin(req))) return json({ error: "Sessão inválida ou expirada." }, 401);
    const password = String(body.password || "");
    if (password.length < 8) return json({ error: "A senha deve ter pelo menos 8 caracteres." }, 400);
    const config = await updateAdminPassword(password);
    return json({ ok: true, token: signToken(config) });
  }

  if (action === "login") {
    const config = await getAuthConfig();
    if (!config) return json({ error: "O administrador ainda não foi configurado." }, 409);
    const candidate = passwordHash(String(body.password || ""), config.salt);
    if (!safeEqualHex(candidate, config.passwordHash)) return json({ error: "Senha incorreta." }, 401);
    return json({ ok: true, token: signToken(config) });
  }

  return json({ error: "Ação não encontrada." }, 404);
};

export const config = {
  path: "/api/admin/:action",
  method: ["GET", "POST"]
};
