import type { DayEvent, User } from "./types";
import { fromRow, toRow } from "./serialize";

/**
 * Client for the app's own API (app/api). The server keeps everything in CSV files in
 * Google Drive and scopes events to the signed-in user via an httpOnly session cookie.
 */

export class ApiError extends Error {}
/** The session is missing or expired. */
export class AuthError extends ApiError {}

interface ApiResponse {
  ok: boolean;
  error?: string;
  rows?: Record<string, unknown>[];
  user?: User;
}

async function call(path: string, body?: Record<string, unknown>): Promise<ApiResponse> {
  const res = await fetch(path, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
    credentials: "same-origin",
  });
  const data = (await res.json().catch(() => null)) as ApiResponse | null;
  if (res.status === 401 && !path.startsWith("/api/auth/login")) throw new AuthError(data?.error || "Not signed in");
  if (!res.ok || !data?.ok) throw new ApiError(data?.error || `Server answered ${res.status}`);
  return data;
}

function rowsToEvents(rows: Record<string, unknown>[] = []): DayEvent[] {
  return rows.map(fromRow).filter((e): e is DayEvent => e !== null && !e.deleted);
}

export async function listEvents(): Promise<DayEvent[]> {
  return rowsToEvents((await call("/api/events")).rows);
}

/** Send changed events (tombstones delete their row) and get the full, updated list back. */
export async function pushEvents(changed: DayEvent[]): Promise<DayEvent[]> {
  return rowsToEvents((await call("/api/events", { action: "upsert", rows: changed.map(toRow) })).rows);
}

/** Overwrite all of this user's events. */
export async function replaceAll(events: DayEvent[]): Promise<DayEvent[]> {
  return rowsToEvents((await call("/api/events", { action: "replace", rows: events.map(toRow) })).rows);
}

export async function me(): Promise<User> {
  return (await call("/api/auth/me")).user!;
}

export async function login(email: string, password: string): Promise<User> {
  return (await call("/api/auth/login", { email, password })).user!;
}

export async function signup(name: string, email: string, password: string): Promise<User> {
  return (await call("/api/auth/signup", { name, email, password })).user!;
}

export async function logout(): Promise<void> {
  await call("/api/auth/logout", {});
}
