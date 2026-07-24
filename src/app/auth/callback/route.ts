import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  parseParentOAuthProvider,
  safeInternalRedirect,
} from "@/lib/parent-oauth";
import { createClient } from "@/lib/supabase/server";
import { linkEnrollmentAccount } from "@/lib/enrollment-account-handoff";

type OAuthIntent = "login" | "parent-signup";

function signupRedirect(request: NextRequest, error?: string) {
  const url = new URL("/signup/parent", request.url);
  url.searchParams.set("social", "1");
  const next = safeInternalRedirect(request.nextUrl.searchParams.get("next"));
  url.searchParams.set("next", next);
  const handoff = request.nextUrl.searchParams.get("handoff")
    || request.nextUrl.searchParams.get("enrollmentHandoff");
  if (handoff) url.searchParams.set("enrollmentHandoff", handoff);
  if (error) url.searchParams.set("error", error);
  return NextResponse.redirect(url);
}

function authFailureRedirect(request: NextRequest, error: string) {
  const intent: OAuthIntent =
    request.nextUrl.searchParams.get("intent") === "login" ? "login" : "parent-signup";
  if (intent !== "login") return signupRedirect(request, error);

  const url = new URL("/login", request.url);
  const next = safeInternalRedirect(request.nextUrl.searchParams.get("next"));
  url.searchParams.set("error", error);
  if (next !== "/mypage") url.searchParams.set("redirect", next);
  const handoff = request.nextUrl.searchParams.get("handoff")
    || request.nextUrl.searchParams.get("enrollmentHandoff");
  if (handoff) url.searchParams.set("enrollmentHandoff", handoff);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const provider = parseParentOAuthProvider(request.nextUrl.searchParams.get("provider") || "");
  const next = safeInternalRedirect(request.nextUrl.searchParams.get("next"));
  const enrollmentHandoff = request.nextUrl.searchParams.get("handoff")
    || request.nextUrl.searchParams.get("enrollmentHandoff");

  if (!code || !provider) {
    return authFailureRedirect(request, "간편가입 인증 정보가 올바르지 않습니다. 다시 시도해 주세요.");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return authFailureRedirect(request, "간편가입 인증 시간이 만료되었거나 취소되었습니다.");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return authFailureRedirect(request, "간편가입 정보를 확인하지 못했습니다.");

  // Authorization is based on the application DB, never OAuth user metadata.
  // A social session alone is intentionally insufficient for parent access.
  const users = await prisma.$queryRawUnsafe<
    Array<{ id: string; role: string; username: string | null; phoneVerifiedAt: Date | null }>
  >(
    `SELECT id, role::text AS role, username, "phoneVerifiedAt"
       FROM "User"
      WHERE "authUserId" = $1 OR ("authUserId" IS NULL AND id = $1)
      ORDER BY CASE WHEN "authUserId" = $1 THEN 0 ELSE 1 END
      LIMIT 1`,
    user.id,
  );
  const appUser = users[0];

  if (appUser?.role === "PARENT" && (appUser.phoneVerifiedAt || appUser.username === null)) {
    if (enrollmentHandoff) {
      try {
        await linkEnrollmentAccount({
          token: enrollmentHandoff,
          parentUserId: appUser.id,
        });
      } catch (linkError) {
        await supabase.auth.signOut();
        return authFailureRedirect(
          request,
          linkError instanceof Error
            ? linkError.message
            : "수강신청서를 계정에 연결하지 못했습니다.",
        );
      }
    }
    const url = new URL("/auth/continue", request.url);
    url.searchParams.set("redirect", enrollmentHandoff ? "/mypage" : next);
    return NextResponse.redirect(url);
  }

  const url = new URL("/signup/parent", request.url);
  url.searchParams.set("social", "1");
  url.searchParams.set("provider", provider);
  url.searchParams.set("next", next);
  if (enrollmentHandoff) url.searchParams.set("enrollmentHandoff", enrollmentHandoff);
  return NextResponse.redirect(url);
}
