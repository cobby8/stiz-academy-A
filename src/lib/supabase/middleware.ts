import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { defaultPathForRole, normalizeAppRole } from "@/lib/auth-routes";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const claimsResult = await supabase.auth.getClaims();
  let isAuthenticated = false;
  let userMetadata: Record<string, any> | null = null;

  if (!claimsResult.error && claimsResult.data?.claims?.sub) {
    isAuthenticated = true;
    userMetadata = claimsResult.data.claims.user_metadata ?? null;
  } else {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    isAuthenticated = Boolean(user);
    userMetadata = user?.user_metadata ?? null;
  }

  const pathname = request.nextUrl.pathname;
  const protectedPath =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/staff") ||
    pathname.startsWith("/mypage");

  if (protectedPath && !isAuthenticated) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  if (pathname === "/login" && isAuthenticated) {
    const role = normalizeAppRole(userMetadata?.role);
    const url = request.nextUrl.clone();
    url.pathname = defaultPathForRole(role);
    url.search = "";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
