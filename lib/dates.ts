import type { Repeat, Unit } from "./types";

const DAY = 86_400_000;

/** Parse YYYY-MM-DD as a local calendar date (midnight). */
export function parseDate(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function today(): Date {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

/** Add calendar months, clamping to the end of shorter months (31 Jan + 1 → 28/29 Feb). */
export function addMonths(d: Date, n: number): Date {
  const target = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(d.getDate(), lastDay));
  return target;
}

/** Whole days from a to b (negative if b is earlier). DST-safe. */
export function daysBetween(a: Date, b: Date): number {
  const ua = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const ub = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((ub - ua) / DAY);
}

/** The date a repeating event next falls on, on or after `from`. */
export function nextOccurrence(date: Date, repeat: Repeat, from: Date = today()): Date {
  if (repeat === "once" || daysBetween(from, date) >= 0) return date;
  if (repeat === "weekly") {
    const behind = daysBetween(date, from);
    return addDays(date, Math.ceil(behind / 7) * 7);
  }
  const step = repeat === "monthly" ? 1 : 12;
  let k = Math.max(0, Math.floor(monthsBetween(date, from) / step) * step);
  let next = addMonths(date, k);
  while (daysBetween(from, next) < 0) {
    k += step;
    next = addMonths(date, k);
  }
  return next;
}

/** Largest n such that addMonths(from, n) <= to (from <= to). */
function monthsBetween(from: Date, to: Date): number {
  let n = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
  while (n > 0 && daysBetween(addMonths(from, n), to) < 0) n--;
  return Math.max(0, n);
}

export interface Part {
  unit: Unit;
  value: number;
}

/**
 * Break the span between two dates into the chosen units, largest first.
 * Order of arguments does not matter; the span is always positive.
 */
export function breakdown(a: Date, b: Date, units: Unit[]): Part[] {
  const [from, to] = daysBetween(a, b) >= 0 ? [a, b] : [b, a];
  const use = new Set<Unit>(units.length ? units : ["days"]);
  const parts: Part[] = [];
  let cursor = from;

  if (use.has("years") || use.has("months")) {
    const n = monthsBetween(from, to);
    if (use.has("years") && use.has("months")) {
      parts.push({ unit: "years", value: Math.floor(n / 12) });
      parts.push({ unit: "months", value: n % 12 });
      cursor = addMonths(from, n);
    } else if (use.has("years")) {
      const y = Math.floor(n / 12);
      parts.push({ unit: "years", value: y });
      cursor = addMonths(from, y * 12);
    } else {
      parts.push({ unit: "months", value: n });
      cursor = addMonths(from, n);
    }
  }

  let rest = daysBetween(cursor, to);
  if (use.has("weeks")) {
    parts.push({ unit: "weeks", value: Math.floor(rest / 7) });
    rest = rest % 7;
  }
  if (use.has("days")) parts.push({ unit: "days", value: rest });
  return parts;
}

const SHORT: Record<Unit, string> = { years: "y", months: "m", weeks: "w", days: "d" };

function label(unit: Unit, value: number): string {
  return value === 1 ? unit.slice(0, -1) : unit;
}

/** Drop leading zero parts but always keep at least one. */
function trim(parts: Part[]): Part[] {
  const nonZero = parts.filter((p) => p.value > 0);
  return nonZero.length ? nonZero : parts.slice(-1);
}

export function formatLong(parts: Part[]): string {
  return trim(parts)
    .map((p) => `${p.value.toLocaleString()} ${label(p.unit, p.value)}`)
    .join(", ");
}

/** The big number on a counter, plus the small unit line under it. */
export function counterText(parts: Part[]): { num: string; unit: string } {
  const t = trim(parts);
  if (t.length === 1) return { num: t[0].value.toLocaleString(), unit: label(t[0].unit, t[0].value) };
  return { num: t.map((p) => `${p.value}${SHORT[p.unit]}`).join(" "), unit: "" };
}

export interface Countdown {
  /** The date being counted to (next occurrence for repeating events). */
  target: Date;
  /** Signed days: positive = in the future, 0 = today, negative = past. */
  days: number;
  num: string;
  unit: string;
  /** e.g. "days to go", "days since", "Today!" */
  caption: string;
  isPast: boolean;
}

export function countdown(dateStr: string, repeat: Repeat, units: Unit[], now: Date = today()): Countdown | null {
  const base = parseDate(dateStr);
  if (!base) return null;
  const target = nextOccurrence(base, repeat, now);
  const days = daysBetween(now, target);
  if (days === 0) return { target, days, num: "Today!", unit: "", caption: "", isPast: false };
  const { num, unit } = counterText(breakdown(now, target, units));
  const isPast = days < 0;
  const caption = `${unit ? unit + " " : ""}${isPast ? "since" : "to go"}`;
  return { target, days, num, unit, caption, isPast };
}

const longFmt = new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
const fullFmt = new Intl.DateTimeFormat(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" });

export function formatDate(d: Date, full = false): string {
  return (full ? fullFmt : longFmt).format(d);
}

export function formatDateTime(s: string): string {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(d);
}

/** Monday–Friday days in [from, to) — the end date itself is excluded. */
export function weekdaysBetween(a: Date, b: Date): number {
  const [from, to] = daysBetween(a, b) >= 0 ? [a, b] : [b, a];
  const total = daysBetween(from, to);
  const fullWeeks = Math.floor(total / 7);
  let count = fullWeeks * 5;
  for (let i = fullWeeks * 7; i < total; i++) {
    const day = addDays(from, i).getDay();
    if (day !== 0 && day !== 6) count++;
  }
  return count;
}

export function relativeTime(iso: string | null): string {
  if (!iso) return "never";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 45_000) return "just now";
  const min = Math.round(diff / 60_000);
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h ago`;
  return new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" }).format(new Date(iso));
}
