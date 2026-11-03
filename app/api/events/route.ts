import { currentUser, handle, json, readJson } from "@/lib/server/auth";
import { tables, withLock, type Row } from "@/lib/server/tables";
import { COLUMNS } from "@/lib/types";

// The signed-in user's rows of events.csv. Same rules as before:
// upsert by id where the newer updated_at wins, rows marked deleted are removed, and
// every response is the user's full list so a sync is one request.

const isTrue = (v: unknown) => /^(true|1|yes)$/i.test(String(v ?? ""));
const strip = ({ user_id: _, ...row }: Row) => row;
const mine = (rows: Row[], userId: string) => rows.filter((r) => r.user_id === userId).map(strip);

/** Keep only known columns, as strings, tagged with the owner. */
function clean(raw: unknown, userId: string): Row | null {
  if (!raw || typeof raw !== "object") return null;
  const src = raw as Record<string, unknown>;
  const row: Row = { user_id: userId };
  for (const c of COLUMNS) row[c] = src[c] == null ? "" : String(src[c]);
  return row.id && row.date ? row : null;
}

function upsert(all: Row[], incoming: Row[], userId: string): Row[] {
  const index = new Map(all.map((r, i) => [`${r.user_id} ${r.id}`, i] as const));
  const next: (Row | null)[] = all.slice();
  for (const row of incoming) {
    const at = index.get(`${userId} ${row.id}`);
    if (isTrue(row.deleted)) {
      if (at !== undefined) next[at] = null;
      continue;
    }
    row.deleted = "";
    if (at === undefined) {
      index.set(`${userId} ${row.id}`, next.length);
      next.push(row);
    } else {
      const old = next[at];
      // Last write wins: ignore a change older than what's stored.
      if (old && old.updated_at && row.updated_at && row.updated_at < old.updated_at) continue;
      next[at] = row;
    }
  }
  return next.filter((r): r is Row => r !== null);
}

export function GET() {
  return handle(async () => {
    const user = await currentUser();
    if (!user) return json({ ok: false, error: "Not signed in" }, 401);
    return json({ ok: true, rows: mine(await tables().read("events"), user.id) });
  });
}

export function POST(req: Request) {
  return handle(async () => {
    const user = await currentUser();
    if (!user) return json({ ok: false, error: "Not signed in" }, 401);
    const body = await readJson(req);
    const action = body.action;
    if (action !== "upsert" && action !== "replace") return json({ ok: false, error: `Unknown action: ${String(action)}` }, 400);
    const incoming = (Array.isArray(body.rows) ? body.rows : []).map((r) => clean(r, user.id)).filter((r): r is Row => r !== null);

    const rows = await withLock(async () => {
      let all = await tables().read("events");
      if (action === "replace") all = all.filter((r) => r.user_id !== user.id);
      all = upsert(all, incoming, user.id);
      await tables().write("events", all);
      return all;
    });
    return json({ ok: true, rows: mine(rows, user.id) });
  });
}
