import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Raw BigInt replacer for JSON
function replacer(_: string, v: unknown) {
    return typeof v === "bigint" ? Number(v) : v;
}

export async function GET() {
    const result: Record<string, unknown> = {};

    try {
        const rows = await prisma.$queryRaw<any[]>`SELECT * FROM "AcademySettings" LIMIT 1`;
        result.academySettings = rows[0] ?? null;
    } catch (e: any) {
        result.academySettings = { error: e.message };
    }

    try {
        const rows = await prisma.$queryRaw<any[]>`
            SELECT id, name, "targetAge", frequency, "weeklyFrequency", price,
                   days, "priceWeek1", "priceWeek2", "priceWeek3", "priceDaily",
                   "shuttleFeeOverride", "order", "createdAt"
            FROM "Program" ORDER BY "createdAt"`;
        result.programs = { count: rows.length, rows };
    } catch (e: any) {
        // Try without new columns
        try {
            const rows = await prisma.$queryRaw<any[]>`
                SELECT id, name, "targetAge", frequency, "weeklyFrequency", price, "createdAt"
                FROM "Program" ORDER BY "createdAt"`;
            result.programs = { count: rows.length, rows, note: "new columns missing" };
        } catch (e2: any) {
            result.programs = { error: e2.message };
        }
    }

    try {
        const rows = await prisma.$queryRaw<any[]>`
            SELECT id, name, role, "order", "imageUrl", "createdAt" FROM "Coach" ORDER BY "order"`;
        result.coaches = { count: rows.length, rows };
    } catch (e: any) {
        result.coaches = { error: e.message };
    }

    try {
        const rows = await prisma.$queryRaw<any[]>`
            SELECT id, "dayKey", "startTime", "endTime", label, capacity,
                   enrolled, "isHidden", "coachId", "programId", "gradeRange"
            FROM "CustomClassSlot" ORDER BY "dayKey", "startTime"`;
        result.customClassSlots = { count: rows.length, rows };
    } catch (e: any) {
        try {
            const rows = await prisma.$queryRaw<any[]>`
                SELECT id, "dayKey", "startTime", "endTime", label, capacity, enrolled
                FROM "CustomClassSlot" ORDER BY "dayKey", "startTime"`;
            result.customClassSlots = { count: rows.length, rows, note: "new columns missing" };
        } catch (e2: any) {
            result.customClassSlots = { error: e2.message };
        }
    }

    try {
        const rows = await prisma.$queryRaw<any[]>`
            SELECT id, "slotKey", label, note, "isHidden", capacity, "coachId", "programId"
            FROM "ClassSlotOverride" ORDER BY "slotKey"`;
        result.classSlotOverrides = { count: rows.length, rows };
    } catch (e: any) {
        result.classSlotOverrides = { error: e.message };
    }

    try {
        const rows = await prisma.$queryRaw<any[]>`SELECT COUNT(*) as cnt FROM "Student"`;
        result.studentCount = Number(rows[0]?.cnt ?? 0);
    } catch (e: any) {
        result.studentCount = { error: e.message };
    }

    // List all tables in the DB
    try {
        const tables = await prisma.$queryRaw<any[]>`
            SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`;
        result.dbTables = tables.map((t: any) => t.tablename);
    } catch (e: any) {
        result.dbTables = { error: e.message };
    }

    return new NextResponse(JSON.stringify(result, replacer, 2), {
        headers: { "Content-Type": "application/json" },
    });
}
