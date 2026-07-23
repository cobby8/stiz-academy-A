import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/auth-guard";

export const dynamic = "force-dynamic";

function replacer(_: string, v: unknown) {
    return typeof v === "bigint" ? Number(v) : v;
}

async function safeRaw<T = any>(sql: string): Promise<T[] | { error: string }> {
    try {
        return await prisma.$queryRawUnsafe<T[]>(sql);
    } catch (e: any) {
        return { error: e.message } as any;
    }
}

export async function GET() {
    // ?몄쬆 泥댄겕: 濡쒓렇?명븳 愿由ъ옄留?吏꾨떒 ?뺣낫 議고쉶 媛??
    try {
        await requireOwner();
    } catch {
        return NextResponse.json({ error: "원장 권한이 필요합니다." }, { status: 403 });
    }

    const result: Record<string, unknown> = {};

    // ?? 1. 紐⑤뱺 ?뚯씠釉?紐⑸줉 ?????????????????????????????????????????????????????
    result.dbTables = await safeRaw(
        `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
    );

    // ?? 2. 媛??뚯씠釉붿쓽 而щ읆 紐⑸줉 (column_name, data_type, is_nullable) ??????????
    result.columnInfo = await safeRaw(`
        SELECT table_name, column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name IN ('AcademySettings','Program','Coach','ClassSlotOverride','CustomClassSlot')
        ORDER BY table_name, ordinal_position
    `);

    // ?? 3. AcademySettings ?꾩껜 ??(SELECT * ??紐⑤뱺 而щ읆 媛??ы븿) ?????????????
    result.academySettings = await safeRaw(
        `SELECT * FROM "AcademySettings" WHERE id = 'singleton' LIMIT 1`
    );

    // ?? 4. Programs ????????????????????????????????????????????????????????????
    const programs = await safeRaw(`SELECT * FROM "Program" ORDER BY "order" ASC, "createdAt" ASC`);
    result.programs = Array.isArray(programs) ? { count: programs.length, rows: programs } : programs;

    // ?? 5. Coaches ?????????????????????????????????????????????????????????????
    const coaches = await safeRaw(`SELECT * FROM "Coach" ORDER BY "order" ASC`);
    result.coaches = Array.isArray(coaches) ? { count: coaches.length, rows: coaches } : coaches;

    // ?? 6. ClassSlotOverride ??肄붿튂/?꾨줈洹몃옩 諛곗젙 ?ы븿 ?꾩껜 議고쉶 ????????????????
    const slots = await safeRaw(`SELECT * FROM "ClassSlotOverride" ORDER BY "slotKey" ASC`);
    result.classSlotOverrides = Array.isArray(slots) ? { count: slots.length, rows: slots } : slots;

    // ?? 7. CustomClassSlot ?????????????????????????????????????????????????????
    const custom = await safeRaw(`SELECT * FROM "CustomClassSlot" ORDER BY "dayKey" ASC, "startTime" ASC`);
    result.customClassSlots = Array.isArray(custom) ? { count: custom.length, rows: custom } : custom;

    // ?? 8. 媛??뚯씠釉??????붿빟 ????????????????????????????????????????????????
    const tables = ["Program", "Coach", "ClassSlotOverride", "CustomClassSlot", "Student", "AcademySettings"];
    const counts: Record<string, number | string> = {};
    for (const t of tables) {
        const r = await safeRaw<{ cnt: bigint }>(`SELECT COUNT(*) as cnt FROM "${t}"`);
        if (Array.isArray(r)) {
            counts[t] = Number(r[0]?.cnt ?? 0);
        } else {
            counts[t] = (r as any).error ?? "error";
        }
    }
    result.rowCounts = counts;

    // ?? 9. ClassSlotOverride?먯꽌 coachId / programId 媛 null ???꾨땶 ?됰쭔 ???????
    const withCoach = await safeRaw(
        `SELECT "slotKey", "coachId", "programId" FROM "ClassSlotOverride"
         WHERE "coachId" IS NOT NULL OR "programId" IS NOT NULL
         ORDER BY "slotKey"`
    );
    result.slotsWithAssignments = Array.isArray(withCoach)
        ? { count: withCoach.length, rows: withCoach }
        : withCoach;

    // ?? 10. 留덉?留됱쑝濡??낅뜲?댄듃??ClassSlotOverride ??????????????????????????
    result.lastSlotUpdate = await safeRaw(
        `SELECT "slotKey", "coachId", "programId", "updatedAt"
         FROM "ClassSlotOverride" ORDER BY "updatedAt" DESC LIMIT 5`
    );

    return new NextResponse(JSON.stringify(result, replacer, 2), {
        headers: { "Content-Type": "application/json" },
    });
}
