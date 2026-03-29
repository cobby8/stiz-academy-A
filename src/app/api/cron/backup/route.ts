/**
 * GET /api/cron/backup
 *
 * Vercel Cron이 매일 KST 자정(UTC 15:00)에 호출합니다.
 * 전체 DB를 JSON으로 내보내 Supabase Storage "backups/" 버킷에 저장합니다.
 * 30일이 지난 백업은 자동 삭제됩니다.
 *
 * vercel.json:
 *   "crons": [{ "path": "/api/cron/backup", "schedule": "0 15 * * *" }]
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";

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
        console.warn(`[cron/backup] query failed: ${(e as Error).message}`);
        return [];
    }
}

export async function GET(req: NextRequest) {
    // Cron 인증 필수화 — CRON_SECRET 없으면 무조건 거부 (개발환경 예외)
    const cronSecret = process.env.CRON_SECRET;
    if (process.env.NODE_ENV !== "development") {
        if (!cronSecret || req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
    }

    try {
        const supabase = createAdminClient();

        // 1. 버킷 확인 (없으면 생성)
        const { data: buckets } = await supabase.storage.listBuckets();
        const exists = buckets?.some((b) => b.name === BUCKET);
        if (!exists) {
            const { error } = await supabase.storage.createBucket(BUCKET, { public: false });
            if (error) throw new Error(`버킷 생성 실패: ${error.message}`);
        }

        // 2. DB 전체 스냅샷 수집
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
                source: "cron",
                tables: ["AcademySettings", "Program", "Coach", "ClassSlotOverride", "CustomClassSlot", "Route/Stop"],
            },
            academySettings: academyRows[0] ?? null,
            programs,
            coaches,
            classSlotOverrides,
            customClassSlots,
            routes: routesWithStops,
        };

        // 3. Supabase Storage에 업로드
        const now = new Date();
        const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
        const filename = `stiz-backup-${kstNow.toISOString().slice(0, 19).replace(/:/g, "-")}.json`;

        const body = JSON.stringify(snapshot, replacer, 2);
        const { error: uploadError } = await supabase.storage
            .from(BUCKET)
            .upload(filename, body, { contentType: "application/json", upsert: true });

        if (uploadError) throw new Error(`업로드 실패: ${uploadError.message}`);

        // 4. 30일 이상 된 파일 삭제
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
            deleted: toDelete.map((f) => f.name),
        });
    } catch (e) {
        console.error("[cron/backup] failed:", e);
        return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
    }
}
