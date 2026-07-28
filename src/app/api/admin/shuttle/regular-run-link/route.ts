import { NextResponse } from "next/server";
import { createOrGetRegularRunLink } from "@/lib/shuttle/regularRun";

export const dynamic = "force-dynamic";

// 정규 셔틀 기사 고정 링크 토큰 생성/조회(원장 전용). requireAdmin은 라이브러리에서 강제.
export async function POST() {
  try {
    const { token } = await createOrGetRegularRunLink();
    return NextResponse.json({ token, path: `/driver/${token}` });
  } catch (e) {
    console.error("[regular-run-link POST]", e);
    const msg = String((e as { message?: string })?.message ?? "");
    const status = /원장|권한|로그인|인증|Unauthorized|Forbidden/i.test(msg) ? 403 : 500;
    return NextResponse.json({ error: status === 403 ? msg : "링크를 만들지 못했습니다." }, { status });
  }
}
