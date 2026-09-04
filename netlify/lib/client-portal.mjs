import { getStore } from "@netlify/blobs";
import { randomBytes, randomUUID, scryptSync, timingSafeEqual, createHmac } from "node:crypto";

const STORE = "fruto-client-portal";
const KEY = "config";
const COOKIE = "fruto_client_session";

function nowIso() { return new Date().toISOString(); }
function clean(value, max = 160) { return String(value ?? "").trim().slice(0, max); }
function loginKey(value) { return clean(value, 160).normalize("NFKC").toLowerCase(); }
function clampDiscount(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n * 10) / 10)) : 0;
}
function hashPassword(password, salt) { return scryptSync(String(password), salt, 64).toString("hex"); }
function safeEqualHex(a, b) {
  try {
    const aa = Buffer.from(String(a || ""), "hex");
    const bb = Buffer.from(String(b || ""), "hex");
    return aa.length === bb.length && timingSafeEqual(aa, bb);
  } catch { return false; }
}
function b64url(input) { return Buffer.from(input).toString("base64url"); }

function normalizeClient(client = {}) {
  return {
    id: clean(client.id, 80) || randomUUID(),
    name: clean(client.name, 120),
    login: loginKey(client.login),
    salt: clean(client.salt, 200),
    passwordHash: clean(client.passwordHash, 300),
    discountPercent: clampDiscount(client.discountPercent),
    active: client.active !== false,
    createdAt: clean(client.createdAt, 40) || nowIso(),
    updatedAt: clean(client.updatedAt, 40) || nowIso()
  };
}

function normalizeState(raw = {}) {
  return {
    enabled: raw?.enabled === true,
    signingSecret: clean(raw?.signingSecret, 200),
    clients: Array.isArray(raw?.clients) ? raw.clients.map(normalizeClient).filter(c => c.id && c.login) : [],
    updatedAt: clean(raw?.updatedAt, 40) || nowIso()
  };
}

export async function getPortalState() {
  const store = getStore(STORE);
  let state = normalizeState(await store.get(KEY, { type: "json", consistency: "strong" }) || {});
  if (!state.signingSecret) {
    state.signingSecret = randomBytes(32).toString("hex");
    state.updatedAt = nowIso();
    await store.setJSON(KEY, state);
  }
  return state;
}

export async function savePortalState(next) {
  const state = normalizeState(next);
  if (!state.signingSecret) state.signingSecret = randomBytes(32).toString("hex");
  state.updatedAt = nowIso();
  await getStore(STORE).setJSON(KEY, state);
  return state;
}

export function clientPublic(client) {
  if (!client) return null;
  return {
    id: client.id,
    name: client.name,
    login: client.login,
    discountPercent: clampDiscount(client.discountPercent),
    active: client.active !== false,
    createdAt: client.createdAt,
    updatedAt: client.updatedAt
  };
}

export function publicPortalState(state, client = null) {
  return {
    enabled: state?.enabled === true,
    revision: String(state?.updatedAt || ""),
    authenticated: Boolean(client),
    client: clientPublic(client)
  };
}

export function makeClient({ id = "", name, login, password = "", discountPercent = 0, active = true }, existing = null) {
  const next = normalizeClient({
    ...(existing || {}),
    id: existing?.id || id || randomUUID(),
    name,
    login,
    discountPercent,
    active,
    createdAt: existing?.createdAt || nowIso(),
    updatedAt: nowIso()
  });
  const newPassword = String(password || "");
  if (newPassword) {
    if (newPassword.length < 6) throw new Error("A senha do cliente deve ter pelo menos 6 caracteres.");
    next.salt = randomBytes(16).toString("hex");
    next.passwordHash = hashPassword(newPassword, next.salt);
  }
  if (!next.name) throw new Error("Informe o nome do cliente.");
  if (!next.login) throw new Error("Informe o login do cliente.");
  if (!next.passwordHash || !next.salt) throw new Error("Informe uma senha para o cliente.");
  return next;
}

export function passwordMatches(password, client) {
  if (!client?.salt || !client?.passwordHash) return false;
  return safeEqualHex(hashPassword(password, client.salt), client.passwordHash);
}

export function signClientSession(state, client) {
  const payload = JSON.stringify({ role: "client", clientId: client.id, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 });
  const body = b64url(payload);
  const sig = createHmac("sha256", state.signingSecret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function parseCookie(req) {
  const raw = req.headers.get("cookie") || "";
  const parts = raw.split(";").map(x => x.trim());
  for (const part of parts) {
    const [name, ...rest] = part.split("=");
    if (name === COOKIE) return decodeURIComponent(rest.join("=") || "");
  }
  return "";
}

function verifySessionToken(token, state) {
  try {
    const [body, sig] = String(token || "").split(".");
    if (!body || !sig || !state?.signingSecret) return null;
    const expected = createHmac("sha256", state.signingSecret).update(body).digest("base64url");
    const aa = Buffer.from(sig);
    const bb = Buffer.from(expected);
    if (aa.length !== bb.length || !timingSafeEqual(aa, bb)) return null;
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (payload?.role !== "client" || Number(payload?.exp) <= Date.now() || !payload?.clientId) return null;
    return payload;
  } catch { return null; }
}

export async function clientFromRequest(req, stateOverride = null) {
  const state = stateOverride || await getPortalState();
  const payload = verifySessionToken(parseCookie(req), state);
  if (!payload) return null;
  const client = state.clients.find(c => c.id === payload.clientId && c.active !== false);
  return client || null;
}

export function sessionCookie(token) {
  return `${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}`;
}
export function clearSessionCookie() {
  return `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export function clientDiscount(value) { return clampDiscount(value); }
export function applyClientDiscount(price, discountPercent) {
  const n = Number(price);
  if (!Number.isFinite(n)) return price;
  const d = clampDiscount(discountPercent);
  return Math.round(n * (1 - d / 100) * 100) / 100;
}
