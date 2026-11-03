// Signed session cookie: `<userId>.<expiry ms>.<HMAC-SHA256>`, keyed by AUTH_SECRET.
// Web Crypto only, so proxy.ts and the route handlers share it.

export const SESSION_COOKIE = "dc_session";
export const SESSION_DAYS = 30;

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === "production") throw new Error("AUTH_SECRET is not set");
  return "dev-only-secret-set-AUTH_SECRET-in-production";
}

const enc = new TextEncoder();

async function sign(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(payload)));
  let bin = "";
  for (const b of mac) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function createSession(userId: string): Promise<{ token: string; expires: Date }> {
  const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  const payload = `${userId}.${expires.getTime()}`;
  return { token: `${payload}.${await sign(payload)}`, expires };
}

/** The user id in a valid, unexpired token, else null. */
export async function readSession(token: string | undefined): Promise<string | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [userId, exp, sig] = parts;
  if (!userId || !(Number(exp) > Date.now())) return null;
  const expected = await sign(`${userId}.${exp}`);
  // Constant-time compare.
  if (expected.length !== sig.length) return null;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0 ? userId : null;
}
