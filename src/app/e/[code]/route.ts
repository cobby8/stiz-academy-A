import { NextRequest, NextResponse } from "next/server";
import { resolveEnrollmentShortLink } from "@/lib/enroll-short-link";

export const dynamic = "force-dynamic";

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ code: string }> },
) {
    const { code } = await context.params;
    const shortLink = await resolveEnrollmentShortLink(code);
    const destination = new URL(shortLink?.targetPath ?? "/apply/enroll", request.url);

    if (!shortLink) {
        destination.searchParams.set("link", "expired");
        return NextResponse.redirect(destination, {
            headers: { "Cache-Control": "no-store" },
        });
    }

    // 문자에는 내부 ID가 보이지 않습니다. 1차에서는 기존 신청서 자동 채움과
    // 호환되도록 검증된 링크만 서버에서 trialId로 변환합니다.
    destination.searchParams.set("trialId", shortLink.trialLeadId);
    return NextResponse.redirect(destination, {
        headers: { "Cache-Control": "no-store" },
    });
}
