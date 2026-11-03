import { findUserByEmail, handle, hashPassword, json, readJson, verifyPassword, withSession } from "@/lib/server/auth";

const WRONG = "That email and password don’t match. Try again.";

export function POST(req: Request) {
  return handle(async () => {
    const body = await readJson(req);
    const email = String(body.email ?? "");
    const password = String(body.password ?? "");
    const row = email && password ? await findUserByEmail(email) : undefined;
    if (!row) {
      // Spend the same time as a real check, so response time doesn't reveal which emails exist.
      await hashPassword(password || "x");
      return json({ ok: false, error: WRONG }, 401);
    }
    if (!(await verifyPassword(password, row.password_hash))) return json({ ok: false, error: WRONG }, 401);
    const user = { id: row.id, name: row.name, email: row.email };
    return withSession(json({ ok: true, user }), user.id);
  });
}
