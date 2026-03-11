import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function replacer(_: string, v: unknown) {
    return typeof v === "bigint" ? Number(v) : v;
}

// GET /api/admin/backup — download full DB snapshot as JSON
export async function GET() {
    const [
        academySettings,
        programs,
        coaches,
        classSlotOverrides,
        customClassSlots,
        routes,
    ] = await Promise.all([
        prisma.academySettings.findFirst(),
        prisma.program.findMany({ orderBy: { order: "asc" } }),
        prisma.coach.findMany({ orderBy: { order: "asc" } }),
        prisma.classSlotOverride.findMany({ orderBy: { slotKey: "asc" } }),
        prisma.customClassSlot.findMany({ orderBy: [{ dayKey: "asc" }, { startTime: "asc" }] }),
        prisma.route.findMany({ include: { stops: { orderBy: { createdAt: "asc" } } } }),
    ]);

    const backup = {
        _meta: {
            version: 1,
            exportedAt: new Date().toISOString(),
            tables: ["AcademySettings", "Program", "Coach", "ClassSlotOverride", "CustomClassSlot", "Route/Stop"],
        },
        academySettings,
        programs,
        coaches,
        classSlotOverrides,
        customClassSlots,
        routes,
    };

    const filename = `stiz-backup-${new Date().toISOString().slice(0, 10)}.json`;

    return new NextResponse(JSON.stringify(backup, replacer, 2), {
        headers: {
            "Content-Type": "application/json",
            "Content-Disposition": `attachment; filename="${filename}"`,
        },
    });
}

// POST /api/admin/backup — restore from JSON backup
export async function POST(req: NextRequest) {
    let backup: any;
    try {
        backup = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    if (!backup?._meta?.version) {
        return NextResponse.json({ error: "Not a valid backup file" }, { status: 400 });
    }

    const results: Record<string, string> = {};

    // Restore Programs
    if (Array.isArray(backup.programs)) {
        for (const p of backup.programs) {
            await prisma.program.upsert({
                where: { id: p.id },
                update: {
                    name: p.name,
                    targetAge: p.targetAge,
                    frequency: p.frequency,
                    weeklyFrequency: p.weeklyFrequency,
                    price: p.price,
                    days: p.days,
                    priceWeek1: p.priceWeek1,
                    priceWeek2: p.priceWeek2,
                    priceWeek3: p.priceWeek3,
                    priceDaily: p.priceDaily,
                    shuttleFeeOverride: p.shuttleFeeOverride,
                    order: p.order,
                },
                create: {
                    id: p.id,
                    name: p.name,
                    targetAge: p.targetAge,
                    frequency: p.frequency,
                    weeklyFrequency: p.weeklyFrequency,
                    price: p.price,
                    days: p.days,
                    priceWeek1: p.priceWeek1,
                    priceWeek2: p.priceWeek2,
                    priceWeek3: p.priceWeek3,
                    priceDaily: p.priceDaily,
                    shuttleFeeOverride: p.shuttleFeeOverride,
                    order: p.order ?? 0,
                },
            });
        }
        results.programs = `${backup.programs.length}개 복원`;
    }

    // Restore Coaches
    if (Array.isArray(backup.coaches)) {
        for (const c of backup.coaches) {
            await prisma.coach.upsert({
                where: { id: c.id },
                update: { name: c.name, role: c.role, imageUrl: c.imageUrl, description: c.description, order: c.order },
                create: { id: c.id, name: c.name, role: c.role, imageUrl: c.imageUrl, description: c.description, order: c.order ?? 0 },
            });
        }
        results.coaches = `${backup.coaches.length}개 복원`;
    }

    // Restore ClassSlotOverrides (coachId/programId)
    if (Array.isArray(backup.classSlotOverrides)) {
        for (const s of backup.classSlotOverrides) {
            await prisma.classSlotOverride.upsert({
                where: { slotKey: s.slotKey },
                update: {
                    label: s.label,
                    note: s.note,
                    isHidden: s.isHidden,
                    capacity: s.capacity,
                    startTimeOverride: s.startTimeOverride,
                    endTimeOverride: s.endTimeOverride,
                    coachId: s.coachId ?? null,
                    programId: s.programId ?? null,
                },
                create: {
                    id: s.id,
                    slotKey: s.slotKey,
                    label: s.label,
                    note: s.note,
                    isHidden: s.isHidden ?? false,
                    capacity: s.capacity ?? 12,
                    startTimeOverride: s.startTimeOverride,
                    endTimeOverride: s.endTimeOverride,
                    coachId: s.coachId ?? null,
                    programId: s.programId ?? null,
                },
            });
        }
        results.classSlotOverrides = `${backup.classSlotOverrides.length}개 복원`;
    }

    // Restore CustomClassSlots
    if (Array.isArray(backup.customClassSlots)) {
        for (const s of backup.customClassSlots) {
            await prisma.customClassSlot.upsert({
                where: { id: s.id },
                update: {
                    dayKey: s.dayKey,
                    startTime: s.startTime,
                    endTime: s.endTime,
                    label: s.label,
                    gradeRange: s.gradeRange,
                    enrolled: s.enrolled,
                    capacity: s.capacity,
                    note: s.note,
                    isHidden: s.isHidden,
                    coachId: s.coachId ?? null,
                    programId: s.programId ?? null,
                },
                create: {
                    id: s.id,
                    dayKey: s.dayKey,
                    startTime: s.startTime,
                    endTime: s.endTime,
                    label: s.label,
                    gradeRange: s.gradeRange,
                    enrolled: s.enrolled ?? 0,
                    capacity: s.capacity ?? 12,
                    note: s.note,
                    isHidden: s.isHidden ?? false,
                    coachId: s.coachId ?? null,
                    programId: s.programId ?? null,
                },
            });
        }
        results.customClassSlots = `${backup.customClassSlots.length}개 복원`;
    }

    return NextResponse.json({
        success: true,
        restoredAt: new Date().toISOString(),
        results,
    });
}
