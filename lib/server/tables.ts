// Where the two tables live: CSV files in a Google Drive folder, reached through the
// Apps Script in public/apps-script/Code.gs (DRIVE_SCRIPT_URL + DRIVE_SCRIPT_SECRET),
// or local CSV files in data/ when no script is configured. Callers read and rewrite
// whole tables inside withLock.

import fs from "node:fs/promises";
import path from "node:path";
import { COLUMNS } from "../types";
import { csvRecords, toCsv } from "../serialize";

export const TABLES = {
  users: ["id", "email", "name", "password_hash", "created_at"],
  events: ["user_id", ...COLUMNS],
} as const;
export type TableName = keyof typeof TABLES;
export type Row = Record<string, string>;

export interface TableStore {
  readonly kind: "drive" | "local";
  read(table: TableName): Promise<Row[]>;
  /** Replace the whole table. */
  write(table: TableName, rows: Row[]): Promise<void>;
}

// Every read-modify-write runs through this one queue so concurrent requests
// cannot overwrite each other's changes.
let queue: Promise<unknown> = Promise.resolve();
export function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => undefined);
  return run;
}

// --- Local CSV files ---

class LocalStore implements TableStore {
  readonly kind = "local";
  private dir = process.env.DATA_DIR ?? path.join(process.cwd(), "data");
  private file = (table: TableName) => path.join(this.dir, `${table}.csv`);

  async read(table: TableName): Promise<Row[]> {
    try {
      return csvRecords(await fs.readFile(this.file(table), "utf-8"));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw err;
    }
  }

  /** Write to a temp file, then rename: a crash never leaves a half-written file. */
  async write(table: TableName, rows: Row[]): Promise<void> {
    const file = this.file(table);
    await fs.mkdir(path.dirname(file), { recursive: true });
    const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(tmp, toCsv(TABLES[table], rows), "utf-8");
    await fs.rename(tmp, file);
  }
}

// --- CSV files in Google Drive ---

export class StorageError extends Error {}

class DriveStore implements TableStore {
  readonly kind = "drive";
  /**
   * Each file's rows, kept for a few seconds and replaced by our own writes, so a burst
   * of requests doesn't hit Apps Script every time. Edits made directly to the files in
   * Drive show up once the entry expires.
   */
  private cache = new Map<TableName, { rows: Row[]; at: number }>();
  private ttl = Number(process.env.DRIVE_CACHE_SECONDS ?? 10) * 1000;

  constructor(
    private url: string,
    private secret: string,
  ) {}

  private async call(body: Record<string, unknown>): Promise<{ csv?: string }> {
    let res: Response;
    try {
      res = await fetch(this.url, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ secret: this.secret, ...body }),
        redirect: "follow",
        cache: "no-store",
      });
    } catch (err) {
      throw new StorageError(`Google Drive unreachable: ${(err as Error).message}`);
    }
    const text = await res.text();
    let data: { ok?: boolean; error?: string; csv?: string };
    try {
      data = JSON.parse(text);
    } catch {
      // A sign-in page instead of JSON means the deployment isn't shared with "Anyone".
      throw new StorageError('Apps Script returned a web page. Deploy it with "Who has access: Anyone".');
    }
    if (!data.ok) throw new StorageError(`Apps Script: ${data.error ?? res.statusText}`);
    return data;
  }

  async read(table: TableName): Promise<Row[]> {
    const hit = this.cache.get(table);
    if (hit && Date.now() - hit.at < this.ttl) return hit.rows;
    const { csv = "" } = await this.call({ action: "read", file: `${table}.csv` });
    const rows = csvRecords(csv);
    this.cache.set(table, { rows, at: Date.now() });
    return rows;
  }

  async write(table: TableName, rows: Row[]): Promise<void> {
    await this.call({ action: "write", file: `${table}.csv`, csv: toCsv(TABLES[table], rows) });
    this.cache.set(table, { rows, at: Date.now() });
  }
}

let store: TableStore | null = null;
export function tables(): TableStore {
  const url = process.env.DRIVE_SCRIPT_URL?.trim();
  store ??= url ? new DriveStore(url, process.env.DRIVE_SCRIPT_SECRET ?? "") : new LocalStore();
  return store;
}
