import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, readSession } from "@/lib/session";

const AUTH_PAGES = ["/login", "/signup"];

/** Pages need a session: without one, go to /login (and back afterwards). Signed-in users skip the auth pages. */
export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const signedIn = (await readSession(req.cookies.get(SESSION_COOKIE)?.value)) !== null;
  const authPage = AUTH_PAGES.includes(pathname);

  if (authPage && signedIn) return NextResponse.redirect(new URL("/", req.url));
  if (!authPage && !signedIn) {
    const url = new URL("/login", req.url);
    if (pathname !== "/") url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // API routes check the session themselves; static files, icons and the PWA files are public.
  matcher: ["/((?!api/|_next/|icons/|apps-script/|sw\\.js|manifest\\.webmanifest|favicon\\.ico).*)"],
};
