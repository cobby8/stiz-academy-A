/**
 * POST /api/admin/sync-schedule
 *
 * 관리자가 수동으로 구글 시트 → DB 동기화를 실행합니다.
 * 동기화 완료 후 공개 /schedule 페이지 캐시가 갱신됩니다.
 */

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { syncSheetSlots } from "@/lib/syncSheetSlots";

export const dynamic = "force-dynamic";

export async function POST() {
    const result = await syncSheetSlots();

    if ("error" in result) {
        return NextResponse.json({ error: result.error }, { status: 400 });
    }

    // 동기화 완료 후 /schedule 캐시 즉시 무효화
    revalidatePath("/schedule");

    return NextResponse.json({ success: true, ...result });
}
