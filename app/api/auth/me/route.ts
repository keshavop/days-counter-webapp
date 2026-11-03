import { currentUser, handle, json } from "@/lib/server/auth";

export function GET() {
  return handle(async () => {
    const user = await currentUser();
    return user ? json({ ok: true, user }) : json({ ok: false, error: "Not signed in" }, 401);
  });
}
