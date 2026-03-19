/**
 * POST /api/admin/sync-schedule
 *
 * 관리자가 수동으로 구글 시트 → DB 동기화를 실행합니다.
 * 동기화 완료 후 공개 /schedule 페이지 캐시가 갱신됩니다.
 */

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { syncSheetSlots } from "@/lib/syncSheetSlots";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST() {
    // 인증 체크: 로그인한 관리자만 시간표 동기화 가능
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: "인증 필요" }, { status: 401 });
    }

    const result = await syncSheetSlots();

    if ("error" in result) {
        return NextResponse.json({ error: result.error }, { status: 400 });
    }

    // 동기화 완료 후 /schedule 캐시 즉시 무효화
    revalidatePath("/schedule");

    return NextResponse.json({ success: true, ...result });
}
