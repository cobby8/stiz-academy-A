/**
 * POST /api/admin/backup-now
 *
 * 관리자가 수동으로 즉시 클라우드 백업을 생성한다.
 * /api/cron/backup과 같은 백업 로직을 사용하지만, CRON_SECRET 대신 원장 권한을 확인한다.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireOwner } from "@/lib/auth-guard";

export const dynamic = "force-dynamic";

const BUCKET = "backups";
const KEEP_DAYS = 30;

function replacer(_: string, v: unknown) {
    return typeof v === "bigint" ? Number(v) : v;
}

async function safeQuery<T = any>(sql: string): Promise<T[]> {
    try {
        return await prisma.$queryRawUnsafe<T[]>(sql);
    } catch (e) {
        console.warn(`[backup-now] query failed: ${(e as Error).message}`);
        return [];
    }
}

export async function POST() {
    // 원장 권한이 있는 사용자만 수동 백업을 실행할 수 있다.
    try {
        await requireOwner();
    } catch {
        return NextResponse.json({ error: "원장 권한이 필요합니다." }, { status: 403 });
    }

    try {
        const supabase = createAdminClient();

        // 1. 백업 버킷 확인. 없으면 생성한다.
        const { data: buckets } = await supabase.storage.listBuckets();
        const exists = buckets?.some((b) => b.name === BUCKET);
        if (!exists) {
            const { error } = await supabase.storage.createBucket(BUCKET, { public: false });
            if (error) throw new Error(`버킷 생성 실패: ${error.message}`);
        }

        // 2. 백업에 포함할 주요 DB 데이터를 조회한다.
        const [academyRows, programs, coaches, classSlotOverrides, customClassSlots, routes, stops] =
            await Promise.all([
                safeQuery(`SELECT * FROM "AcademySettings" WHERE id = 'singleton' LIMIT 1`),
                safeQuery(`SELECT * FROM "Program" ORDER BY "order" ASC, "createdAt" ASC`),
                safeQuery(`SELECT * FROM "Coach" ORDER BY "order" ASC`),
                safeQuery(`SELECT * FROM "ClassSlotOverride" ORDER BY "slotKey" ASC`),
                safeQuery(`SELECT * FROM "CustomClassSlot" ORDER BY "dayKey" ASC, "startTime" ASC`),
                safeQuery(`SELECT * FROM "Route"`),
                safeQuery(`SELECT * FROM "Stop" ORDER BY "createdAt" ASC`),
            ]);

        const routesWithStops = routes.map((r: any) => ({
            ...r,
            stops: stops.filter((s: any) => s.routeId === r.id),
        }));

        const snapshot = {
            _meta: {
                version: 1,
                exportedAt: new Date().toISOString(),
                source: "manual",
                tables: ["AcademySettings", "Program", "Coach", "ClassSlotOverride", "CustomClassSlot", "Route/Stop"],
            },
            academySettings: academyRows[0] ?? null,
            programs,
            coaches,
            classSlotOverrides,
            customClassSlots,
            routes: routesWithStops,
        };

        // 3. Supabase Storage에 업로드한다.
        const now = new Date();
        const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
        const filename = `stiz-backup-${kstNow.toISOString().slice(0, 19).replace(/:/g, "-")}.json`;

        const body = JSON.stringify(snapshot, replacer, 2);
        const { error: uploadError } = await supabase.storage
            .from(BUCKET)
            .upload(filename, body, { contentType: "application/json", upsert: true });

        if (uploadError) throw new Error(`업로드 실패: ${uploadError.message}`);

        // 4. 30일이 지난 오래된 백업 파일을 정리한다.
        const { data: files } = await supabase.storage.from(BUCKET).list("", { limit: 200 });
        const cutoff = new Date(Date.now() - KEEP_DAYS * 24 * 60 * 60 * 1000);
        const toDelete = (files ?? []).filter((f) => {
            const created = new Date(f.created_at ?? 0);
            return created < cutoff;
        });
        if (toDelete.length > 0) {
            await supabase.storage.from(BUCKET).remove(toDelete.map((f) => f.name));
        }

        return NextResponse.json({
            success: true,
            filename,
            rows: {
                programs: programs.length,
                coaches: coaches.length,
                classSlotOverrides: classSlotOverrides.length,
                customClassSlots: customClassSlots.length,
            },
        });
    } catch (e) {
        console.error("[backup-now] failed:", e);
        return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
    }
}
