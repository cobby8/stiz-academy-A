/**
 * POST /api/admin/backup-now
 *
 * 愿由ъ옄媛 ?섎룞?쇰줈 利됱떆 ?대씪?곕뱶 諛깆뾽???앹꽦?⑸땲??
 * /api/cron/backup 怨??숈씪??濡쒖쭅?댁?留?CRON_SECRET ???愿由ъ옄 UI?먯꽌 ?몄텧?⑸땲??
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
    // ?몄쬆 泥댄겕: 濡쒓렇?명븳 愿由ъ옄留??섎룞 諛깆뾽 媛??
    try {
        await requireOwner();
    } catch {
        return NextResponse.json({ error: "원장 권한이 필요합니다." }, { status: 403 });
    }

    try {
        const supabase = createAdminClient();

        // 1. 踰꾪궥 ?뺤씤 (?놁쑝硫??앹꽦)
        const { data: buckets } = await supabase.storage.listBuckets();
        const exists = buckets?.some((b) => b.name === BUCKET);
        if (!exists) {
            const { error } = await supabase.storage.createBucket(BUCKET, { public: false });
            if (error) throw new Error(`버킷 생성 실패: ${error.message}`);
        }

        // 2. DB ?꾩껜 ?ㅻ깄???섏쭛
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

        // 3. Supabase Storage???낅줈??
        const now = new Date();
        const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
        const filename = `stiz-backup-${kstNow.toISOString().slice(0, 19).replace(/:/g, "-")}.json`;

        const body = JSON.stringify(snapshot, replacer, 2);
        const { error: uploadError } = await supabase.storage
            .from(BUCKET)
            .upload(filename, body, { contentType: "application/json", upsert: true });

        if (uploadError) throw new Error(`업로드 실패: ${uploadError.message}`);

        // 4. 30???댁긽 ???뚯씪 ??젣
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
