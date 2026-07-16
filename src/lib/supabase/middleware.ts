import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

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

  if (!claimsResult.error && claimsResult.data?.claims?.sub) {
    isAuthenticated = true;
  } else {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    isAuthenticated = Boolean(user);
  }

  const pathname = request.nextUrl.pathname;
  const isStaffLogin = pathname === "/staff/login";
  const isStaffInstall = pathname === "/staff/install";
  const isAdminPath = pathname === "/admin" || pathname.startsWith("/admin/");
  const isStaffPath = pathname === "/staff" || pathname.startsWith("/staff/");
  const isMyPagePath = pathname === "/mypage" || pathname.startsWith("/mypage/");
  const protectedPath =
    isAdminPath || (isStaffPath && !isStaffLogin && !isStaffInstall) || isMyPagePath;

  if (protectedPath && !isAuthenticated) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.startsWith("/staff") ? "/staff/login" : "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  if ((pathname === "/login" || isStaffLogin) && isAuthenticated) {
    // Middleware cannot safely query the application DB. Route through a server
    // page that resolves the current DB role instead of trusting stale metadata.
    const url = request.nextUrl.clone();
    const requestedPath = request.nextUrl.searchParams.get("redirect");
    url.pathname = "/auth/continue";
    url.search = "";
    if (isStaffLogin) {
      url.searchParams.set("context", "staff");
    }
    if (requestedPath) {
      url.searchParams.set("redirect", requestedPath);
    }
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
