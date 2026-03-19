import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function replacer(_: string, v: unknown) {
    return typeof v === "bigint" ? Number(v) : v;
}

async function safeQuery<T = any>(sql: string): Promise<T[]> {
    try {
        return await prisma.$queryRawUnsafe<T[]>(sql);
    } catch (e) {
        console.warn(`[backup] table query failed (may not exist): ${sql.slice(0, 60)}`, (e as Error).message);
        return [];
    }
}

// GET /api/admin/backup — download full DB snapshot as JSON
export async function GET() {
    // 인증 체크: 로그인한 관리자만 백업 다운로드 가능
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: "인증 필요" }, { status: 401 });
    }

    try {
        const [
            academySettingsRows,
            programs,
            coaches,
            classSlotOverrides,
            customClassSlots,
            routes,
            stops,
        ] = await Promise.all([
            safeQuery(`SELECT * FROM "AcademySettings" WHERE id = 'singleton' LIMIT 1`),
            safeQuery(`SELECT * FROM "Program" ORDER BY "order" ASC, "createdAt" DESC`),
            safeQuery(`SELECT * FROM "Coach" ORDER BY "order" ASC`),
            safeQuery(`SELECT * FROM "ClassSlotOverride" ORDER BY "slotKey" ASC`),
            safeQuery(`SELECT * FROM "CustomClassSlot" ORDER BY "dayKey" ASC, "startTime" ASC`),
            safeQuery(`SELECT * FROM "Route"`),
            safeQuery(`SELECT * FROM "Stop" ORDER BY "createdAt" ASC`),
        ]);

        // Attach stops to routes
        const routesWithStops = routes.map((r: any) => ({
            ...r,
            stops: stops.filter((s: any) => s.routeId === r.id),
        }));

        const backup = {
            _meta: {
                version: 1,
                exportedAt: new Date().toISOString(),
                tables: ["AcademySettings", "Program", "Coach", "ClassSlotOverride", "CustomClassSlot", "Route/Stop"],
            },
            academySettings: academySettingsRows[0] ?? null,
            programs,
            coaches,
            classSlotOverrides,
            customClassSlots,
            routes: routesWithStops,
        };

        const filename = `stiz-backup-${new Date().toISOString().slice(0, 10)}.json`;

        return new NextResponse(JSON.stringify(backup, replacer, 2), {
            headers: {
                "Content-Type": "application/json",
                "Content-Disposition": `attachment; filename="${filename}"`,
            },
        });
    } catch (e) {
        console.error("[backup GET] failed:", e);
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}

// POST /api/admin/backup — restore from JSON backup
export async function POST(req: NextRequest) {
    // 인증 체크: 로그인한 관리자만 백업 복원 가능
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: "인증 필요" }, { status: 401 });
    }

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
        let restored = 0;
        for (const p of backup.programs) {
            try {
                await prisma.$executeRawUnsafe(
                    `INSERT INTO "Program" (
                        id, name, "targetAge", frequency, "weeklyFrequency", description,
                        price, "order", days,
                        "priceWeek1", "priceWeek2", "priceWeek3", "priceDaily",
                        "shuttleFeeOverride", "createdAt", "updatedAt"
                    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
                    ON CONFLICT (id) DO UPDATE SET
                        name = EXCLUDED.name,
                        "targetAge" = EXCLUDED."targetAge",
                        frequency = EXCLUDED.frequency,
                        "weeklyFrequency" = EXCLUDED."weeklyFrequency",
                        description = EXCLUDED.description,
                        price = EXCLUDED.price,
                        "order" = EXCLUDED."order",
                        days = EXCLUDED.days,
                        "priceWeek1" = EXCLUDED."priceWeek1",
                        "priceWeek2" = EXCLUDED."priceWeek2",
                        "priceWeek3" = EXCLUDED."priceWeek3",
                        "priceDaily" = EXCLUDED."priceDaily",
                        "shuttleFeeOverride" = EXCLUDED."shuttleFeeOverride",
                        "updatedAt" = NOW()`,
                    p.id, p.name, p.targetAge ?? null, p.frequency ?? null,
                    p.weeklyFrequency ?? null, p.description ?? null,
                    p.price ?? 0, p.order ?? 0, p.days ?? null,
                    p.priceWeek1 ?? null, p.priceWeek2 ?? null,
                    p.priceWeek3 ?? null, p.priceDaily ?? null,
                    p.shuttleFeeOverride ?? null,
                    p.createdAt ?? new Date(), p.updatedAt ?? new Date(),
                );
                restored++;
            } catch (e) {
                console.error(`[backup restore] Program "${p.name}" failed:`, e);
            }
        }
        results.programs = `${restored}/${backup.programs.length}개 복원`;
    }

    // Restore Coaches
    if (Array.isArray(backup.coaches)) {
        let restored = 0;
        for (const c of backup.coaches) {
            try {
                await prisma.$executeRawUnsafe(
                    `INSERT INTO "Coach" (id, name, role, description, "imageUrl", "order", "createdAt", "updatedAt")
                     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
                     ON CONFLICT (id) DO UPDATE SET
                        name = EXCLUDED.name, role = EXCLUDED.role,
                        description = EXCLUDED.description, "imageUrl" = EXCLUDED."imageUrl",
                        "order" = EXCLUDED."order", "updatedAt" = NOW()`,
                    c.id, c.name, c.role, c.description ?? null,
                    c.imageUrl ?? null, c.order ?? 0,
                    c.createdAt ?? new Date(), c.updatedAt ?? new Date(),
                );
                restored++;
            } catch (e) {
                console.error(`[backup restore] Coach "${c.name}" failed:`, e);
            }
        }
        results.coaches = `${restored}/${backup.coaches.length}개 복원`;
    }

    // Restore ClassSlotOverrides
    if (Array.isArray(backup.classSlotOverrides)) {
        let restored = 0;
        for (const s of backup.classSlotOverrides) {
            try {
                await prisma.$executeRawUnsafe(
                    `INSERT INTO "ClassSlotOverride" (
                        id, "slotKey", label, note, "isHidden", capacity,
                        "startTimeOverride", "endTimeOverride",
                        "coachId", "programId", "createdAt", "updatedAt"
                    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
                    ON CONFLICT ("slotKey") DO UPDATE SET
                        label = EXCLUDED.label, note = EXCLUDED.note,
                        "isHidden" = EXCLUDED."isHidden", capacity = EXCLUDED.capacity,
                        "startTimeOverride" = EXCLUDED."startTimeOverride",
                        "endTimeOverride" = EXCLUDED."endTimeOverride",
                        "coachId" = EXCLUDED."coachId", "programId" = EXCLUDED."programId",
                        "updatedAt" = NOW()`,
                    s.id, s.slotKey, s.label ?? null, s.note ?? null,
                    s.isHidden ?? false, s.capacity ?? 12,
                    s.startTimeOverride ?? null, s.endTimeOverride ?? null,
                    s.coachId ?? null, s.programId ?? null,
                    s.createdAt ?? new Date(), s.updatedAt ?? new Date(),
                );
                restored++;
            } catch (e) {
                console.error(`[backup restore] Slot "${s.slotKey}" failed:`, e);
            }
        }
        results.classSlotOverrides = `${restored}/${backup.classSlotOverrides.length}개 복원`;
    }

    // Restore CustomClassSlots
    if (Array.isArray(backup.customClassSlots)) {
        let restored = 0;
        for (const s of backup.customClassSlots) {
            try {
                await prisma.$executeRawUnsafe(
                    `INSERT INTO "CustomClassSlot" (
                        id, "dayKey", "startTime", "endTime", label, "gradeRange",
                        enrolled, capacity, note, "isHidden",
                        "coachId", "programId", "createdAt", "updatedAt"
                    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
                    ON CONFLICT (id) DO UPDATE SET
                        "dayKey" = EXCLUDED."dayKey", "startTime" = EXCLUDED."startTime",
                        "endTime" = EXCLUDED."endTime", label = EXCLUDED.label,
                        "gradeRange" = EXCLUDED."gradeRange", enrolled = EXCLUDED.enrolled,
                        capacity = EXCLUDED.capacity, note = EXCLUDED.note,
                        "isHidden" = EXCLUDED."isHidden",
                        "coachId" = EXCLUDED."coachId", "programId" = EXCLUDED."programId",
                        "updatedAt" = NOW()`,
                    s.id, s.dayKey, s.startTime, s.endTime, s.label,
                    s.gradeRange ?? null, s.enrolled ?? 0, s.capacity ?? 12,
                    s.note ?? null, s.isHidden ?? false,
                    s.coachId ?? null, s.programId ?? null,
                    s.createdAt ?? new Date(), s.updatedAt ?? new Date(),
                );
                restored++;
            } catch (e) {
                console.error(`[backup restore] CustomSlot failed:`, e);
            }
        }
        results.customClassSlots = `${restored}/${backup.customClassSlots.length}개 복원`;
    }

    return NextResponse.json({
        success: true,
        restoredAt: new Date().toISOString(),
        results,
    });
}
