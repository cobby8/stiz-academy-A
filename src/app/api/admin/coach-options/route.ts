import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { requireAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

const COACH_OPTIONS_CACHE_SECONDS = 60;
const COACH_OPTIONS_CACHE_HEADERS = {
    "Cache-Control": `private, max-age=${COACH_OPTIONS_CACHE_SECONDS}, stale-while-revalidate=300`,
};

type CoachOptionRow = {
    id: string;
    name: string;
};

const getCachedCoachOptions = unstable_cache(
    async () =>
        prisma.$queryRawUnsafe<CoachOptionRow[]>(`
            SELECT id, name
            FROM "Coach"
            ORDER BY "order" ASC, name ASC
        `),
    ["admin-coach-options-v1"],
    {
        revalidate: COACH_OPTIONS_CACHE_SECONDS,
        tags: ["admin-coach-options"],
    },
);

export async function GET() {
    try {
        await requireAdmin();
    } catch {
        return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const coaches = await getCachedCoachOptions();

    return NextResponse.json(
        { coaches },
        {
            headers: COACH_OPTIONS_CACHE_HEADERS,
        },
    );
}
