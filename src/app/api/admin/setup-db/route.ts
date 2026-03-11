/**
 * POST /api/admin/setup-db
 *
 * DB에 누락된 테이블을 생성합니다 (CREATE TABLE IF NOT EXISTS).
 * prisma db push 없이 브라우저에서 직접 실행 가능.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Allow GET so it can be triggered directly from the browser address bar
export async function GET() {
    return POST();
}

export async function POST() {
    const results: Record<string, string> = {};

    // ClassSlotOverride
    try {
        await prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "ClassSlotOverride" (
                id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
                "slotKey" TEXT NOT NULL UNIQUE,
                label TEXT,
                note TEXT,
                "isHidden" BOOLEAN NOT NULL DEFAULT false,
                capacity INTEGER NOT NULL DEFAULT 12,
                "startTimeOverride" TEXT,
                "endTimeOverride" TEXT,
                "coachId" TEXT REFERENCES "Coach"(id) ON DELETE SET NULL,
                "programId" TEXT REFERENCES "Program"(id) ON DELETE SET NULL,
                "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `);
        results.ClassSlotOverride = "OK (created or already exists)";
    } catch (e) {
        results.ClassSlotOverride = `ERROR: ${(e as Error).message}`;
    }

    // CustomClassSlot
    try {
        await prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "CustomClassSlot" (
                id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
                "dayKey" TEXT NOT NULL,
                "startTime" TEXT NOT NULL,
                "endTime" TEXT NOT NULL,
                label TEXT NOT NULL,
                "gradeRange" TEXT,
                enrolled INTEGER NOT NULL DEFAULT 0,
                capacity INTEGER NOT NULL DEFAULT 12,
                note TEXT,
                "isHidden" BOOLEAN NOT NULL DEFAULT false,
                "coachId" TEXT REFERENCES "Coach"(id) ON DELETE SET NULL,
                "programId" TEXT REFERENCES "Program"(id) ON DELETE SET NULL,
                "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `);
        results.CustomClassSlot = "OK (created or already exists)";
    } catch (e) {
        results.CustomClassSlot = `ERROR: ${(e as Error).message}`;
    }

    // Coach table columns (order field)
    try {
        await prisma.$executeRawUnsafe(
            `ALTER TABLE "Coach" ADD COLUMN IF NOT EXISTS "order" INTEGER NOT NULL DEFAULT 0`
        );
        results.CoachOrder = "OK";
    } catch (e) {
        results.CoachOrder = `ERROR: ${(e as Error).message}`;
    }

    // Program table columns
    const programCols: [string, string][] = [
        ["order", "INTEGER NOT NULL DEFAULT 0"],
        ["days", "TEXT"],
        ["priceWeek1", "INTEGER"],
        ["priceWeek2", "INTEGER"],
        ["priceWeek3", "INTEGER"],
        ["priceDaily", "INTEGER"],
        ["shuttleFeeOverride", "INTEGER"],
        ["weeklyFrequency", "TEXT"],
    ];
    for (const [col, type] of programCols) {
        try {
            await prisma.$executeRawUnsafe(
                `ALTER TABLE "Program" ADD COLUMN IF NOT EXISTS "${col}" ${type}`
            );
        } catch {
            // ignore
        }
    }
    results.ProgramCols = "OK";

    return NextResponse.json({ success: true, results });
}
