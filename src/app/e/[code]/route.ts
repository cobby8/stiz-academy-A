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

    // 내부 체험신청 ID는 주소에 노출하지 않습니다.
    // 신청서 서버가 동일한 접근 코드의 만료·활성 상태를 다시 검증합니다.
    destination.searchParams.set("access", shortLink.code);
    return NextResponse.redirect(destination, {
        headers: { "Cache-Control": "no-store" },
    });
}
