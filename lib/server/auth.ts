import { randomBytes, randomUUID, scrypt, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, createSession, readSession, sessionNeedsRenewal } from "../session";
import type { User } from "../types";
import { tables, withLock, type Row } from "./tables";

function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => scrypt(password, salt, 64, (err, key) => (err ? reject(err) : resolve(key))));
}

/** `scrypt$<salt>$<hash>`, both base64url. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  return `scrypt$${salt.toString("base64url")}$${(await derive(password, salt)).toString("base64url")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [kind, salt, hash] = stored.split("$");
  if (kind !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64url");
  const actual = await derive(password, Buffer.from(salt, "base64url"));
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

const toUser = (r: Row): User => ({ id: r.id, name: r.name, email: r.email });
export const normalizeEmail = (e: string) => e.trim().toLowerCase();

export async function findUserByEmail(email: string): Promise<Row | undefined> {
  const wanted = normalizeEmail(email);
  return (await tables().read("users")).find((u) => normalizeEmail(u.email) === wanted);
}

/** Adds the user, or returns null if the email is taken. */
export function createUser(name: string, email: string, password: string): Promise<User | null> {
  return withLock(async () => {
    const users = await tables().read("users");
    const wanted = normalizeEmail(email);
    if (users.some((u) => normalizeEmail(u.email) === wanted)) return null;
    const row: Row = {
      id: randomUUID(),
      email: wanted,
      name: name.trim(),
      password_hash: await hashPassword(password),
      created_at: new Date().toISOString(),
    };
    await tables().write("users", [...users, row]);
    return toUser(row);
  });
}

/** The signed-in user, from the session cookie. */
export async function currentUser(): Promise<User | null> {
  const id = await readSession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!id) return null;
  const row = (await tables().read("users")).find((u) => u.id === id);
  return row ? toUser(row) : null;
}

/** Re-issues the session cookie on `res` when the current one is due for renewal. */
export async function renewSession(res: NextResponse, userId: string): Promise<NextResponse> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return sessionNeedsRenewal(token) ? withSession(res, userId) : res;
}

export async function withSession(res: NextResponse, userId: string): Promise<NextResponse> {
  const { token, expires } = await createSession(userId);
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  });
  return res;
}

export function json(body: Record<string, unknown>, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

/** Turns storage failures into a JSON error instead of an HTML 500 page. */
export async function handle(fn: () => Promise<NextResponse>): Promise<NextResponse> {
  try {
    return await fn();
  } catch (err) {
    console.error(err);
    return json({ ok: false, error: err instanceof Error ? err.message : "Server error" }, 500);
  }
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    return body && typeof body === "object" ? body : {};
  } catch {
    return {};
  }
}
