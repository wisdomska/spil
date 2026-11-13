import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_VIEWS, sectionOf } from "@/lib/admin/views";

/** Refreshes the Supabase session cookie on navigation and API calls (Next 16 "proxy"). */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      },
    },
  });
  // Rotates the access token when it has expired, then verifies it locally against the
  // project's public keys. getUser() asked the auth server on every request, a network round
  // trip in front of every API call and every room poll (owner request 2026-11-13: too slow).
  const { data: claims } = await supabase.auth.getClaims();
  const signedIn = !!claims?.claims?.sub;

  // Admin console: signed-out visitors go to the sign-in page, and signed-in admins skip it.
  // The console layout checks the admins allow-list on the server for every console page, so
  // only the sign-in page asks the database here.
  const path = request.nextUrl.pathname;
  if (path === "/admin" || path.startsWith("/admin/")) {
    const open = path === "/admin/login" || path === "/admin/reset";
    let target: string | null = null;
    if (!open && !signedIn) target = "/admin/login";
    else if (path === "/admin/login" && signedIn) {
      const { data } = await supabase.rpc("is_admin");
      if (data === true) target = "/admin";
    }
    if (target) {
      const redirect = NextResponse.redirect(new URL(target, request.url));
      for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
      return redirect;
    }
    // Start the page's data download with the HTML, instead of after its JavaScript. Only on a
    // real page load: the router's background prefetches of other console pages pass through
    // here too, and a hint on each of those downloaded every section's data twice.
    const pageLoad =
      request.headers.get("sec-fetch-dest") === "document" && !request.headers.has("rsc");
    const section = pageLoad && !open && !request.nextUrl.search ? sectionOf(path) : null;
    if (section) {
      response.headers.set(
        "link",
        [{ url: "/counts" }, ...DEFAULT_VIEWS[section]]
          .map((v) => `</api/v1/admin${v.url}>; rel=preload; as=fetch; crossorigin=anonymous`)
          .join(", "),
      );
    }
  }
  return response;
}

export const config = {
  // Only where a session matters: rooms, the API and the admin console. Static pages (landing,
  // join, create, info) skip the proxy entirely so the CDN serves them without a function call.
  matcher: ["/r/:path*", "/api/v1/:path*", "/admin", "/admin/:path*"],
};
