/**
 * GET /api/admin/trial-count — 새 체험 신청(NEW) 건수 반환
 * 사이드바 배지 표시용 (클라이언트 컴포넌트에서 fetch)
 */
import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";

const TRIAL_COUNT_CACHE_SECONDS = 30;
const TRIAL_COUNT_CACHE_HEADERS = {
    "Cache-Control": `private, max-age=${TRIAL_COUNT_CACHE_SECONDS}, stale-while-revalidate=120`,
};

const getCachedNewTrialCount = unstable_cache(
    async () => {
        const rows = await prisma.$queryRawUnsafe<{ count: number }[]>(
            `SELECT COUNT(*)::int AS count FROM "TrialLead" WHERE status = 'NEW'`,
        );
        return rows[0]?.count ?? 0;
    },
    ["admin-new-trial-count-v1"],
    {
        revalidate: TRIAL_COUNT_CACHE_SECONDS,
        tags: ["admin-trial-count"],
    },
);

export async function GET() {
    try {
        try {
            await requireAdmin();
        } catch {
            return NextResponse.json({ count: 0 }, { status: 401 });
        }

        const count = await getCachedNewTrialCount();
        return NextResponse.json({ count }, { headers: TRIAL_COUNT_CACHE_HEADERS });
    } catch {
        return NextResponse.json({ count: 0 }, { headers: TRIAL_COUNT_CACHE_HEADERS });
    }
}
