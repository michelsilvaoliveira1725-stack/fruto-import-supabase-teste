import { getStore } from "@netlify/blobs";
import { randomBytes, scryptSync, timingSafeEqual, createHmac } from "node:crypto";

const STORE = "fruto-import-auth";
const KEY = "admin";

export async function getAuthConfig() {
  return await getStore(STORE).get(KEY, { type: "json", consistency: "strong" });
}

export function passwordHash(password, salt) {
  return scryptSync(password, salt, 64).toString("hex");
}

export function safeEqualHex(a, b) {
  try {
    const aa = Buffer.from(a, "hex");
    const bb = Buffer.from(b, "hex");
    return aa.length === bb.length && timingSafeEqual(aa, bb);
  } catch {
    return false;
  }
}

export async function createAdmin(password) {
  const salt = randomBytes(16).toString("hex");
  const signingSecret = randomBytes(32).toString("hex");
  const config = {
    salt,
    passwordHash: passwordHash(password, salt),
    signingSecret,
    createdAt: new Date().toISOString()
  };
  await getStore(STORE).setJSON(KEY, config, { onlyIfNew: true });
  return config;
}

export async function updateAdminPassword(password) {
  const existing = await getAuthConfig();
  if (!existing) throw new Error("Administrador não configurado.");
  const salt = randomBytes(16).toString("hex");
  const signingSecret = randomBytes(32).toString("hex");
  const config = {
    ...existing,
    salt,
    passwordHash: passwordHash(password, salt),
    signingSecret,
    updatedAt: new Date().toISOString()
  };
  await getStore(STORE).setJSON(KEY, config);
  return config;
}

function b64url(input) {
  return Buffer.from(input).toString("base64url");
}

export function signToken(config) {
  const payload = JSON.stringify({ role: "admin", exp: Date.now() + 12 * 60 * 60 * 1000 });
  const body = b64url(payload);
  const sig = createHmac("sha256", config.signingSecret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyTokenValue(token, config) {
  try {
    const [body, sig] = token.split(".");
    if (!body || !sig) return false;
    const expected = createHmac("sha256", config.signingSecret).update(body).digest("base64url");
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    return payload.role === "admin" && Number(payload.exp) > Date.now();
  } catch {
    return false;
  }
}

export async function requireAdmin(req) {
  const config = await getAuthConfig();
  if (!config) return false;
  const header = req.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  return verifyTokenValue(token, config);
}

export function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" }
  });
}
