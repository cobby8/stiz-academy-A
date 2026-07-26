import { NextResponse } from "next/server";
import { createOrGetRunLink } from "@/lib/seasonal/shuttleRun";

export const dynamic = "force-dynamic";

// 기사님 전용 링크 토큰 생성/조회(원장 전용). requireAdmin은 라이브러리에서 강제한다.
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null) as { date?: string } | null;
    if (!body?.date) {
      return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
    }
    const { token } = await createOrGetRunLink(body.date);
    return NextResponse.json({ token, path: `/shuttle/run/${token}` });
  } catch (e) {
    console.error("[dispatch/run-link POST]", e);
    const msg = String((e as { message?: string })?.message ?? "");
    const status = /원장|권한|로그인|인증|Unauthorized|Forbidden/i.test(msg) ? 403 : 500;
    return NextResponse.json({ error: status === 403 ? msg : "링크를 만들지 못했습니다." }, { status });
  }
}
