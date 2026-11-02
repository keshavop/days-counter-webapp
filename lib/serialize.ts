import { COLUMNS, COVERS, FONTS, REPEATS, UNITS, type DayEvent, type SheetRow, type Unit } from "./types";
import { parseDate, toISODate, today } from "./dates";

export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function blankEvent(partial: Partial<DayEvent> = {}): DayEvent {
  const now = new Date().toISOString();
  return {
    id: newId(),
    title: "",
    date: toISODate(today()),
    description: "",
    reminder_at: "",
    notify_text: "",
    repeat: "once",
    format: ["days"],
    cover: COVERS[1].hex,
    image: "",
    dim: 30,
    font: "display",
    counter_size: 72,
    title_size: 20,
    color: "#ffffff",
    divider: true,
    created_at: now,
    updated_at: now,
    ...partial,
  };
}

export function toRow(e: DayEvent): SheetRow {
  return {
    id: e.id,
    title: e.title,
    date: e.date,
    description: e.description,
    reminder_at: e.reminder_at,
    notify_text: e.notify_text,
    repeat: e.repeat,
    format: e.format.join(","),
    cover: e.cover,
    image: e.image,
    dim: String(e.dim),
    font: e.font,
    counter_size: String(e.counter_size),
    title_size: String(e.title_size),
    color: e.color,
    divider: e.divider ? "TRUE" : "FALSE",
    created_at: e.created_at,
    updated_at: e.updated_at,
    deleted: e.deleted ? "TRUE" : "",
  };
}

const HEX = /^#[0-9a-f]{6}$/i;

function num(v: unknown, fallback: number, min: number, max: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
}

/** Turn a loosely-typed row (sheet, CSV) into a valid event, or null if it has no usable date. */
export function fromRow(raw: Partial<Record<string, unknown>>): DayEvent | null {
  const s = (k: string) => (raw[k] == null ? "" : String(raw[k]).trim());
  const date = s("date");
  if (!parseDate(date)) return null;
  const base = blankEvent();
  const repeat = REPEATS.some((r) => r.value === s("repeat")) ? (s("repeat") as DayEvent["repeat"]) : "once";
  const format = s("format")
    .split(/[,;| ]+/)
    .map((u) => u.toLowerCase())
    .filter((u): u is Unit => (UNITS as string[]).includes(u));
  const font = FONTS.some((f) => f.value === s("font")) ? (s("font") as DayEvent["font"]) : "display";
  const bool = (v: string, d: boolean) => (v === "" ? d : /^(true|1|yes)$/i.test(v));
  return {
    id: s("id") || base.id,
    title: s("title") || "Untitled event",
    date,
    description: s("description"),
    reminder_at: s("reminder_at"),
    notify_text: s("notify_text"),
    repeat,
    format: format.length ? UNITS.filter((u) => format.includes(u)) : ["days"],
    cover: HEX.test(s("cover")) ? s("cover") : base.cover,
    image: s("image"),
    dim: num(s("dim"), 30, 0, 80),
    font,
    counter_size: num(s("counter_size"), 72, 32, 140),
    title_size: num(s("title_size"), 20, 12, 40),
    color: HEX.test(s("color")) ? s("color") : "#ffffff",
    divider: bool(s("divider"), true),
    created_at: s("created_at") || base.created_at,
    updated_at: s("updated_at") || base.updated_at,
    deleted: bool(s("deleted"), false) || undefined,
  };
}

/* ---------- CSV (RFC 4180) ---------- */

function escapeCell(v: string): string {
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function toCSV(events: DayEvent[]): string {
  const cols = COLUMNS.filter((c) => c !== "deleted");
  const lines = [cols.join(",")];
  for (const e of events) {
    const row = toRow(e);
    lines.push(cols.map((c) => escapeCell(row[c])).join(","));
  }
  return lines.join("\r\n") + "\r\n";
}

export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

/** Parse a CSV file into events. Unknown columns are ignored; rows without a valid date are skipped. */
export function eventsFromCSV(text: string): { events: DayEvent[]; skipped: number } {
  const [header, ...body] = parseCSV(text);
  if (!header) return { events: [], skipped: 0 };
  const keys = header.map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  const events: DayEvent[] = [];
  let skipped = 0;
  for (const cells of body) {
    const raw: Record<string, string> = {};
    keys.forEach((k, i) => (raw[k] = cells[i] ?? ""));
    const ev = fromRow(raw);
    if (ev) events.push(ev);
    else skipped++;
  }
  return { events, skipped };
}
