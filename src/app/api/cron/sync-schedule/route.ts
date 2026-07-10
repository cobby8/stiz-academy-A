/**
 * GET /api/cron/sync-schedule
 *
 * 구글 시트 → DB 동기화 예비 엔드포인트.
 * 기본 운영은 /api/admin/sync-schedule 수동 동기화를 사용한다.
 * 자동 동기화가 필요해지면 vercel.json crons에 다시 등록한다.
 */

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { syncSheetSlots } from "@/lib/syncSheetSlots";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    // Cron 인증 필수화 — CRON_SECRET 없으면 무조건 거부 (개발환경 예외)
    const cronSecret = process.env.CRON_SECRET;
    if (process.env.NODE_ENV !== "development") {
        if (!cronSecret || req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
    }

    const result = await syncSheetSlots();

    if ("error" in result) {
        console.error("[cron/sync-schedule]", result.error);
        return NextResponse.json({ error: result.error }, { status: 400 });
    }

    revalidatePath("/schedule");
    revalidatePath("/simulator");

    console.log(`[cron/sync-schedule] 완료: ${result.synced}개 슬롯, ${result.syncedAt}`);
    return NextResponse.json({ success: true, ...result });
}
