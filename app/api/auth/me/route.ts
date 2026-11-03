import { currentUser, handle, json, renewSession } from "@/lib/server/auth";
import { SESSION_COOKIE } from "@/lib/session";

// Called every time the app opens, so this is also where sessions get renewed.
export function GET() {
  return handle(async () => {
    const user = await currentUser();
    if (user) return renewSession(json({ ok: true, user }), user.id);
    // Drop a cookie that is signed but names no account (e.g. a deleted user); otherwise
    // proxy.ts keeps bouncing /login back to / while the app keeps sending it to /login.
    const res = json({ ok: false, error: "Not signed in" }, 401);
    res.cookies.delete(SESSION_COOKIE);
    return res;
  });
}
