import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED = ["/wallet", "/portfolio", "/profile", "/settings", "/admin", "/propose", "/notifications"];
export const REF_COOKIE = "unipred_ref";
const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/;
/** The official address. Old links to the Vercel address are forwarded here. */
const CANONICAL_HOST = "unipred.site";
const OLD_HOSTS = new Set(["unipred.vercel.app", "www.unipred.site"]);

/** Remembers who invited this visitor (?ref=username) for 30 days, for referral credit at sign-up. */
function rememberReferrer(request: NextRequest, response: NextResponse): NextResponse {
  const ref = request.nextUrl.searchParams.get("ref");
  if (ref && USERNAME_RE.test(ref) && !request.cookies.get(REF_COOKIE)) {
    response.cookies.set(REF_COOKIE, ref, { maxAge: 60 * 60 * 24 * 30, path: "/", sameSite: "lax", httpOnly: true });
  }
  return response;
}

/** Refreshes the Supabase session cookie and guards signed-in-only pages. */
export async function proxy(request: NextRequest) {
  // Permanently forward old addresses (keeps the path, ?ref= invites and bet links intact).
  // Paystack webhooks (/api/paystack) never reach this proxy, so payments are unaffected.
  const host = request.headers.get("host")?.toLowerCase() ?? "";
  if (OLD_HOSTS.has(host)) {
    const target = request.nextUrl.clone();
    target.protocol = "https:";
    target.host = CANONICAL_HOST;
    target.port = "";
    return NextResponse.redirect(target, 308);
  }

  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return rememberReferrer(request, response);

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  if (!user && PROTECTED.some((p) => path === p || path.startsWith(`${p}/`))) {
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.search = `?next=${encodeURIComponent(path + request.nextUrl.search)}`;
    return rememberReferrer(request, NextResponse.redirect(login));
  }
  return rememberReferrer(request, response);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|api/paystack|api/notify|api/push|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
