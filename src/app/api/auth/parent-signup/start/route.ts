import { NextResponse } from "next/server";
import { sendParentSignupOtp, startParentSignup, type ParentSignupMethod } from "@/lib/parent-signup-verification";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "입력값을 확인해 주세요." }, { status: 400 });
  const { data } = await (await createClient()).auth.getUser();
  const oauthUser = data.user ? { id: data.user.id, email: data.user.email } : null;
  const rawProvider = String(data.user?.app_metadata?.provider || data.user?.identities?.[0]?.provider || "").toLowerCase();
  const method: ParentSignupMethod = rawProvider === "google"
    ? "GOOGLE"
    : rawProvider === "kakao"
      ? "KAKAO"
      : rawProvider === "custom:naver" || rawProvider === "naver"
        ? "NAVER"
        : "PASSWORD";
  if (body.social === true && (method === "PASSWORD" || !oauthUser)) {
    return NextResponse.json(
      { error: "간편가입 연결이 만료되었습니다. 가입 방법을 다시 선택해 주세요." },
      { status: 401 },
    );
  }
  const result = await startParentSignup({
    phone: String(body.phone || ""), signupMethod: method,
    email: oauthUser?.email, pendingAuthUserId: method === "PASSWORD" ? null : oauthUser?.id,
  });
  if ("error" in result) return NextResponse.json(result, { status: 400 });
  const forwarded = request.headers.get("x-vercel-forwarded-for") || request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
  const requestKey = forwarded.split(",")[0]?.trim() || "unknown";
  const sent = await sendParentSignupOtp(result.token, requestKey);
  if ("error" in sent) return NextResponse.json(sent, { status: 400 });
  return NextResponse.json({ ok: true, challengeToken: result.token });
}
