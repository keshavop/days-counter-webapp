import type { DayEvent } from "./types";
import { fromRow, toRow } from "./serialize";

/**
 * Client for the Google Apps Script web app in public/apps-script/Code.gs.
 *
 * Requests go straight from the browser to script.google.com:
 *  - GET  ?action=list|ping&key=…            → { ok, rows } / { ok, sheetName, sheetUrl }
 *  - POST text/plain JSON { action, key, … } → { ok, rows }
 * POST uses text/plain so the browser sends a "simple" request with no CORS preflight,
 * which Apps Script cannot answer.
 */

interface ApiResponse {
  ok: boolean;
  error?: string;
  rows?: Record<string, unknown>[];
  sheetName?: string;
  sheetUrl?: string;
}

export class SheetError extends Error {}

function assertUrl(url: string) {
  if (!/^https:\/\/script\.google(usercontent)?\.com\//.test(url)) {
    throw new SheetError("The web app URL should start with https://script.google.com/macros/s/…");
  }
}

async function parse(res: Response): Promise<ApiResponse> {
  if (!res.ok) throw new SheetError(`Apps Script answered ${res.status}`);
  const text = await res.text();
  let data: ApiResponse;
  try {
    data = JSON.parse(text);
  } catch {
    // A sign-in page instead of JSON means the deployment isn't shared with "Anyone".
    throw new SheetError('Got a web page instead of data. Deploy the script with "Who has access: Anyone".');
  }
  if (!data.ok) throw new SheetError(data.error || "Apps Script returned an error");
  return data;
}

function rowsToEvents(rows: Record<string, unknown>[] = []): DayEvent[] {
  return rows.map(fromRow).filter((e): e is DayEvent => e !== null && !e.deleted);
}

async function get(url: string, params: Record<string, string>): Promise<ApiResponse> {
  assertUrl(url);
  const u = new URL(url);
  for (const [k, v] of Object.entries(params)) if (v) u.searchParams.set(k, v);
  return parse(await fetch(u.toString(), { method: "GET", redirect: "follow", cache: "no-store" }));
}

async function post(url: string, body: Record<string, unknown>): Promise<ApiResponse> {
  assertUrl(url);
  return parse(
    await fetch(url, {
      method: "POST",
      redirect: "follow",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(body),
    }),
  );
}

export async function ping(url: string, key: string) {
  const r = await get(url, { action: "ping", key });
  return { sheetName: r.sheetName ?? "", sheetUrl: r.sheetUrl ?? "" };
}

export async function listEvents(url: string, key: string): Promise<DayEvent[]> {
  return rowsToEvents((await get(url, { action: "list", key })).rows);
}

/** Send changed events (tombstones delete their row) and get the full, updated list back. */
export async function pushEvents(url: string, key: string, changed: DayEvent[]): Promise<DayEvent[]> {
  return rowsToEvents((await post(url, { action: "upsert", key, rows: changed.map(toRow) })).rows);
}

/** Overwrite the whole sheet with these events. */
export async function replaceAll(url: string, key: string, events: DayEvent[]): Promise<DayEvent[]> {
  return rowsToEvents((await post(url, { action: "replace", key, rows: events.map(toRow) })).rows);
}
