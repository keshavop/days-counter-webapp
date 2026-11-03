export type Repeat = "once" | "weekly" | "monthly" | "yearly";
export type Unit = "years" | "months" | "weeks" | "days";
export type FontKey = "display" | "sans" | "serif" | "mono";

/** One event. Every field maps 1:1 to a column in events.csv. */
export interface DayEvent {
  id: string;
  title: string;
  /** Local calendar date, YYYY-MM-DD. */
  date: string;
  description: string;
  /** Local date-time, YYYY-MM-DDTHH:mm, or "" for no reminder. */
  reminder_at: string;
  notify_text: string;
  repeat: Repeat;
  /** Units shown by the counter, in order. */
  format: Unit[];
  /** Cover colour (hex). Used when there is no image, and as the image backdrop. */
  cover: string;
  /** Image URL or a small compressed data: URL. */
  image: string;
  /** Darkening over the cover, 0–80 (%). */
  dim: number;
  font: FontKey;
  counter_size: number;
  title_size: number;
  /** Text colour on the cover (hex). */
  color: string;
  divider: boolean;
  created_at: string;
  updated_at: string;
  /** Tombstone: set locally on delete until the server has been told. */
  deleted?: boolean;
}

export const COLUMNS = [
  "id",
  "title",
  "date",
  "description",
  "reminder_at",
  "notify_text",
  "repeat",
  "format",
  "cover",
  "image",
  "dim",
  "font",
  "counter_size",
  "title_size",
  "color",
  "divider",
  "created_at",
  "updated_at",
  "deleted",
] as const;

export type Column = (typeof COLUMNS)[number];
/** A row exactly as stored in the sheet: every value a string. */
export type SheetRow = Record<Column, string>;

export const UNITS: Unit[] = ["years", "months", "weeks", "days"];
export const REPEATS: { value: Repeat; label: string }[] = [
  { value: "once", label: "Once" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

export const COVERS: { name: string; hex: string }[] = [
  { name: "Ink", hex: "#1e293b" },
  { name: "Ocean", hex: "#0f4c5c" },
  { name: "Forest", hex: "#1f4d3a" },
  { name: "Plum", hex: "#4a2545" },
  { name: "Ember", hex: "#9a3412" },
  { name: "Sand", hex: "#e7d9c4" },
];

export const TEXT_COLORS: { name: string; hex: string }[] = [
  { name: "White", hex: "#ffffff" },
  { name: "Cream", hex: "#fef3c7" },
  { name: "Ink", hex: "#111827" },
];

export const FONTS: { value: FontKey; label: string; className: string }[] = [
  { value: "display", label: "Bricolage", className: "font-display" },
  { value: "sans", label: "Geist", className: "font-sans" },
  { value: "serif", label: "Fraunces", className: "font-serif" },
  { value: "mono", label: "JetBrains Mono", className: "font-mono" },
];

export function fontClass(font: FontKey): string {
  return FONTS.find((f) => f.value === font)?.className ?? "font-display";
}

export interface Settings {
  autoSync: boolean;
  theme: "system" | "light" | "dark";
}

export type SyncStatus = "signedout" | "idle" | "syncing" | "offline" | "error";

export interface User {
  id: string;
  name: string;
  email: string;
}
