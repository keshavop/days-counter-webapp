import { json } from "@/lib/server/auth";
import { SESSION_COOKIE } from "@/lib/session";

export function POST() {
  const res = json({ ok: true });
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
