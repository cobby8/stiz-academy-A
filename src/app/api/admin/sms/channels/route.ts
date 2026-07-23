import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import { isSmsProviderConfigured } from "@/lib/sms";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        await requireAdmin();
    } catch {
        return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    return NextResponse.json({
        channels: {
            SMS: isSmsProviderConfigured(),
            // 승인 템플릿 변수와 RCS 발송 구현이 끝나기 전까지 준비 중으로 고정한다.
            ALIMTALK: false,
            RCS: false,
        },
    }, { headers: { "Cache-Control": "no-store" } });
}
