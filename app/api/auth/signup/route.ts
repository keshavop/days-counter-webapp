import { createUser, handle, json, readJson, withSession } from "@/lib/server/auth";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function POST(req: Request) {
  return handle(async () => {
    const body = await readJson(req);
    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim();
    const password = String(body.password ?? "");
    if (!name || name.length > 80) return json({ ok: false, error: "Enter your name." }, 400);
    if (!EMAIL.test(email) || email.length > 200) return json({ ok: false, error: "Enter a full email address, like name@example.com." }, 400);
    if (password.length < 8 || password.length > 200) return json({ ok: false, error: "Use at least 8 characters for your password." }, 400);

    const user = await createUser(name, email, password);
    if (!user) return json({ ok: false, error: "An account with that email already exists. Log in instead." }, 409);
    return withSession(json({ ok: true, user }), user.id);
  });
}
