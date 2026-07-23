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
    // 원장 권한이 있는 사용자만 진단 정보를 조회할 수 있다.
    try {
        await requireOwner();
    } catch {
        return NextResponse.json({ error: "원장 권한이 필요합니다." }, { status: 403 });
    }

    const result: Record<string, unknown> = {};

    // 1. 모든 테이블 목록
    result.dbTables = await safeRaw(
        `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
    );

    // 2. 주요 테이블의 컬럼 목록
    result.columnInfo = await safeRaw(`
        SELECT table_name, column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name IN ('AcademySettings','Program','Coach','ClassSlotOverride','CustomClassSlot')
        ORDER BY table_name, ordinal_position
    `);

    // 3. AcademySettings 전체 행
    result.academySettings = await safeRaw(
        `SELECT * FROM "AcademySettings" WHERE id = 'singleton' LIMIT 1`
    );

    // 4. Programs
    const programs = await safeRaw(`SELECT * FROM "Program" ORDER BY "order" ASC, "createdAt" ASC`);
    result.programs = Array.isArray(programs) ? { count: programs.length, rows: programs } : programs;

    // 5. Coaches
    const coaches = await safeRaw(`SELECT * FROM "Coach" ORDER BY "order" ASC`);
    result.coaches = Array.isArray(coaches) ? { count: coaches.length, rows: coaches } : coaches;

    // 6. 코치/프로그램 배정을 포함한 ClassSlotOverride 전체 조회
    const slots = await safeRaw(`SELECT * FROM "ClassSlotOverride" ORDER BY "slotKey" ASC`);
    result.classSlotOverrides = Array.isArray(slots) ? { count: slots.length, rows: slots } : slots;

    // 7. CustomClassSlot
    const custom = await safeRaw(`SELECT * FROM "CustomClassSlot" ORDER BY "dayKey" ASC, "startTime" ASC`);
    result.customClassSlots = Array.isArray(custom) ? { count: custom.length, rows: custom } : custom;

    // 8. 각 테이블의 행 수 요약
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

    // 9. ClassSlotOverride에서 coachId 또는 programId가 있는 행만 조회
    const withCoach = await safeRaw(
        `SELECT "slotKey", "coachId", "programId" FROM "ClassSlotOverride"
         WHERE "coachId" IS NOT NULL OR "programId" IS NOT NULL
         ORDER BY "slotKey"`
    );
    result.slotsWithAssignments = Array.isArray(withCoach)
        ? { count: withCoach.length, rows: withCoach }
        : withCoach;

    // 10. 최근 업데이트된 ClassSlotOverride 행
    result.lastSlotUpdate = await safeRaw(
        `SELECT "slotKey", "coachId", "programId", "updatedAt"
         FROM "ClassSlotOverride" ORDER BY "updatedAt" DESC LIMIT 5`
    );

    return new NextResponse(JSON.stringify(result, replacer, 2), {
        headers: { "Content-Type": "application/json" },
    });
}
