import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { requireAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";

const SYSTEM_STATUS_CACHE_SECONDS = 300;
const SYSTEM_STATUS_CACHE_HEADERS = {
    "Cache-Control": `private, max-age=60, stale-while-revalidate=${SYSTEM_STATUS_CACHE_SECONDS}`,
};

async function getDbStatus() {
    try {
        await prisma.$queryRaw`SELECT 1`;
        return true;
    } catch {
        return false;
    }
}

async function getBackupStatus() {
    try {
        const supabase = createAdminClient();
        const { data: allFiles } = await supabase.storage.from("backups").list("", {
            limit: 50,
            sortBy: { column: "created_at", order: "desc" },
        });
        const lastBackupAt = allFiles?.[0]?.created_at ? new Date(allFiles[0].created_at) : null;
        const backupCount = allFiles?.length ?? 0;
        return {
            lastBackupAt: lastBackupAt?.toISOString() ?? null,
            backupCount,
        };
    } catch {
        return { lastBackupAt: null, backupCount: 0 };
    }
}

const getCachedSystemStatus = unstable_cache(
    async () => {
        const [dbOk, backup] = await Promise.all([getDbStatus(), getBackupStatus()]);
        return { dbOk, backup };
    },
    ["admin-dashboard-system-status-v1"],
    {
        revalidate: SYSTEM_STATUS_CACHE_SECONDS,
        tags: ["admin-dashboard-system"],
    },
);

export async function GET() {
    try {
        await requireAdmin();
    } catch {
        return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    try {
        const status = await getCachedSystemStatus();

        return NextResponse.json(status, { headers: SYSTEM_STATUS_CACHE_HEADERS });
    } catch (error) {
        console.error("[api/admin/dashboard/system] failed:", error);
        return NextResponse.json({ error: "Failed to load dashboard system status" }, { status: 500 });
    }
}
