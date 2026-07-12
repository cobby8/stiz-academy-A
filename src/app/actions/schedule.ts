"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";

const DAY_LABEL: Record<string, string> = {
    Mon: "월요일",
    Tue: "화요일",
    Wed: "수요일",
    Thu: "목요일",
    Fri: "금요일",
    Sat: "토요일",
    Sun: "일요일",
};

function isScheduleSlotMirrorError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    return message.includes("ScheduleSlot") || message.includes("relation");
}

async function syncClassFromSlot(input: {
    slotKey: string;
    programId: string | null;
    label: string;
    dayKey: string;
    startTime: string;
    endTime: string;
    capacity: number;
    isHidden?: boolean;
}) {
    if (input.isHidden || !input.programId) return;

    const existingRows = await prisma.$queryRawUnsafe<{ id: string }[]>(
        `SELECT id FROM "Class" WHERE "slotKey" = $1 LIMIT 1`,
        input.slotKey,
    );

    if (existingRows.length > 0) {
        await prisma.$executeRawUnsafe(
            `UPDATE "Class" SET
                "programId" = $1,
                name = $2,
                "dayOfWeek" = $3,
                "startTime" = $4,
                "endTime" = $5,
                capacity = $6,
                "updatedAt" = NOW()
             WHERE "slotKey" = $7`,
            input.programId,
            input.label,
            input.dayKey,
            input.startTime,
            input.endTime,
            input.capacity,
            input.slotKey,
        );
        return;
    }

    await prisma.$executeRawUnsafe(
        `INSERT INTO "Class" (
            id, "programId", name, "dayOfWeek", "startTime", "endTime",
            capacity, "slotKey", "createdAt", "updatedAt"
        ) VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
        input.programId,
        input.label,
        input.dayKey,
        input.startTime,
        input.endTime,
        input.capacity,
        input.slotKey,
    );
}

async function mirrorOverrideToScheduleSlot(
    slotKey: string,
    data: {
        label?: string;
        note?: string;
        isHidden?: boolean;
        capacity?: number;
        coachId?: string | null;
        startTimeOverride?: string | null;
        endTimeOverride?: string | null;
        programId?: string | null;
    },
) {
    try {
        const rows = await prisma.$queryRawUnsafe<any[]>(
            `SELECT "slotKey", period, "dayKey", "dayLabel", "startTime", "endTime", label, capacity, "programId", "isHidden"
             FROM "ScheduleSlot"
             WHERE "slotKey" = $1
             LIMIT 1`,
            slotKey,
        );
        const row = rows[0];
        if (!row) return;

        const dayKey = row.dayKey ?? row.daykey;
        const dayLabel = row.dayLabel ?? row.daylabel ?? DAY_LABEL[dayKey] ?? dayKey;
        const period = row.period != null ? Number(row.period) : null;
        const startTime = data.startTimeOverride || row.startTime || row.starttime;
        const endTime = data.endTimeOverride || row.endTime || row.endtime;
        const label = data.label?.trim() || (period != null ? `${dayLabel} ${period}교시` : `${dayLabel} ${startTime}`);
        const capacity = data.capacity ?? Number(row.capacity ?? 12);
        const isHidden = data.isHidden ?? false;
        const programId = data.programId ?? null;

        await prisma.$executeRawUnsafe(
            `UPDATE "ScheduleSlot" SET
                label = $2,
                note = $3,
                "isHidden" = $4,
                capacity = $5,
                "startTime" = $6,
                "endTime" = $7,
                "coachId" = $8,
                "programId" = $9,
                "updatedAt" = NOW()
             WHERE "slotKey" = $1`,
            slotKey,
            data.label?.trim() || null,
            data.note ?? null,
            isHidden,
            capacity,
            startTime,
            endTime,
            data.coachId ?? null,
            programId,
        );

        await syncClassFromSlot({ slotKey, programId, label, dayKey, startTime, endTime, capacity, isHidden });
    } catch (error) {
        if (!isScheduleSlotMirrorError(error)) {
            console.warn("[mirrorOverrideToScheduleSlot] failed:", error);
        }
    }
}

async function mirrorCustomSlotToScheduleSlot(id: string) {
    try {
        const rows = await prisma.$queryRawUnsafe<any[]>(
            `SELECT id, "dayKey", "startTime", "endTime", label, "gradeRange",
                    enrolled, capacity, note, "isHidden", "coachId", "programId"
             FROM "CustomClassSlot"
             WHERE id = $1
             LIMIT 1`,
            id,
        );
        const row = rows[0];
        if (!row) return;

        const dayKey = row.dayKey ?? row.daykey;
        const startTime = row.startTime ?? row.starttime;
        const endTime = row.endTime ?? row.endtime;
        const label = row.label ?? "";
        const slotKey = `custom-${id}`;
        const capacity = Number(row.capacity ?? 12);
        const isHidden = row.isHidden ?? row.ishidden ?? false;
        const programId = row.programId ?? row.programid ?? null;

        await prisma.$executeRawUnsafe(
            `INSERT INTO "ScheduleSlot" (
                id, "slotKey", source, period, "dayKey", "dayLabel", "isWeekend",
                "startTime", "endTime", label, "gradeRange", "gradesJSON",
                "enrolledSnapshot", capacity, note, "isHidden", "displayOrder",
                "coachId", "programId", "rawJSON", "createdAt", "updatedAt"
            ) VALUES (
                gen_random_uuid()::text, $1, 'CUSTOM_SLOT', NULL, $2, $3, $4,
                $5, $6, $7, $8, '[]',
                $9, $10, $11, $12, 1000,
                $13, $14, $15, NOW(), NOW()
            )
            ON CONFLICT ("slotKey") DO UPDATE SET
                "dayKey" = EXCLUDED."dayKey",
                "dayLabel" = EXCLUDED."dayLabel",
                "isWeekend" = EXCLUDED."isWeekend",
                "startTime" = EXCLUDED."startTime",
                "endTime" = EXCLUDED."endTime",
                label = EXCLUDED.label,
                "gradeRange" = EXCLUDED."gradeRange",
                "enrolledSnapshot" = EXCLUDED."enrolledSnapshot",
                capacity = EXCLUDED.capacity,
                note = EXCLUDED.note,
                "isHidden" = EXCLUDED."isHidden",
                "coachId" = EXCLUDED."coachId",
                "programId" = EXCLUDED."programId",
                "rawJSON" = EXCLUDED."rawJSON",
                "updatedAt" = NOW()`,
            slotKey,
            dayKey,
            DAY_LABEL[dayKey] ?? null,
            dayKey === "Sat" || dayKey === "Sun",
            startTime,
            endTime,
            label,
            row.gradeRange ?? row.graderange ?? null,
            Number(row.enrolled ?? 0),
            capacity,
            row.note ?? null,
            isHidden,
            row.coachId ?? row.coachid ?? null,
            programId,
            JSON.stringify({ customSlot: row }),
        );

        await syncClassFromSlot({ slotKey, programId, label, dayKey, startTime, endTime, capacity, isHidden });
    } catch (error) {
        if (!isScheduleSlotMirrorError(error)) {
            console.warn("[mirrorCustomSlotToScheduleSlot] failed:", error);
        }
    }
}

export async function upsertClassSlotOverride(
    slotKey: string,
    data: {
        label?: string;
        note?: string;
        isHidden?: boolean;
        capacity?: number;
        coachId?: string | null;
        startTimeOverride?: string | null;
        endTimeOverride?: string | null;
        programId?: string | null;
    }
) {
    await requireAdmin();
    try {
        // $executeRawUnsafe = simple query protocol → PgBouncer transaction mode 호환
        // Prisma ORM upsert 는 prepared statement(extended protocol)를 사용 → PgBouncer 차단
        await prisma.$executeRawUnsafe(
            `INSERT INTO "ClassSlotOverride" (
                id, "slotKey", label, note, "isHidden", capacity,
                "startTimeOverride", "endTimeOverride", "coachId", "programId",
                "createdAt", "updatedAt"
            ) VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
            ON CONFLICT ("slotKey") DO UPDATE SET
                label = EXCLUDED.label,
                note = EXCLUDED.note,
                "isHidden" = EXCLUDED."isHidden",
                capacity = EXCLUDED.capacity,
                "startTimeOverride" = EXCLUDED."startTimeOverride",
                "endTimeOverride" = EXCLUDED."endTimeOverride",
                "coachId" = EXCLUDED."coachId",
                "programId" = EXCLUDED."programId",
                "updatedAt" = NOW()`,
            slotKey,
            data.label ?? null,
            data.note ?? null,
            data.isHidden ?? false,
            data.capacity ?? 12,
            data.startTimeOverride ?? null,
            data.endTimeOverride ?? null,
            data.coachId ?? null,
            data.programId ?? null,
        );
        await mirrorOverrideToScheduleSlot(slotKey, data);
        revalidatePath("/schedule");
        revalidatePath("/admin/schedule");
        revalidatePath("/admin/classes");
        revalidatePath("/admin/students");
    } catch (e) {
        console.error("upsertClassSlotOverride failed:", e);
        throw new Error("저장 실패");
    }
}

export async function deleteClassSlotOverride(slotKey: string) {
    await requireAdmin();
    try {
        await prisma.$executeRawUnsafe(
            `DELETE FROM "ClassSlotOverride" WHERE "slotKey" = $1`,
            slotKey,
        );
        revalidatePath("/schedule");
        revalidatePath("/admin/schedule");
    } catch (e) {
        console.error("deleteClassSlotOverride failed:", e);
        throw new Error("삭제 실패");
    }
}

export async function createCustomSlot(data: {
    dayKey: string;
    startTime: string;
    endTime: string;
    label: string;
    gradeRange?: string;
    enrolled?: number;
    capacity?: number;
    note?: string;
    isHidden?: boolean;
    coachId?: string | null;
    programId?: string | null;
}) {
    await requireAdmin();
    try {
        const id = crypto.randomUUID();
        await prisma.$executeRawUnsafe(
            `INSERT INTO "CustomClassSlot" (
                id, "dayKey", "startTime", "endTime", label, "gradeRange",
                enrolled, capacity, note, "isHidden", "coachId", "programId",
                "createdAt", "updatedAt"
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())`,
            id,
            data.dayKey, data.startTime, data.endTime, data.label,
            data.gradeRange ?? null,
            data.enrolled ?? 0, data.capacity ?? 12,
            data.note ?? null, data.isHidden ?? false,
            data.coachId ?? null, data.programId ?? null,
        );
        await mirrorCustomSlotToScheduleSlot(id);
        revalidatePath("/schedule");
        revalidatePath("/admin/schedule");
        revalidatePath("/admin/classes");
        revalidatePath("/admin/students");
    } catch (e) {
        console.error("createCustomSlot failed:", e);
        throw new Error("생성 실패");
    }
}

export async function updateCustomSlot(
    id: string,
    data: {
        dayKey?: string;
        startTime?: string;
        endTime?: string;
        label?: string;
        gradeRange?: string | null;
        enrolled?: number;
        capacity?: number;
        note?: string | null;
        isHidden?: boolean;
        coachId?: string | null;
        programId?: string | null;
    }
) {
    await requireAdmin();
    try {
        // Build SET clause dynamically for only provided fields
        const fields: string[] = [];
        const values: any[] = [];
        let idx = 1;
        const add = (col: string, val: unknown) => {
            fields.push(`"${col}" = $${idx++}`);
            values.push(val);
        };
        if (data.dayKey !== undefined)    add("dayKey",    data.dayKey);
        if (data.startTime !== undefined) add("startTime", data.startTime);
        if (data.endTime !== undefined)   add("endTime",   data.endTime);
        if (data.label !== undefined)     add("label",     data.label);
        if (data.gradeRange !== undefined)add("gradeRange",data.gradeRange);
        if (data.enrolled !== undefined)  add("enrolled",  data.enrolled);
        if (data.capacity !== undefined)  add("capacity",  data.capacity);
        if (data.note !== undefined)      add("note",      data.note);
        if (data.isHidden !== undefined)  add("isHidden",  data.isHidden);
        if (data.coachId !== undefined)   add("coachId",   data.coachId);
        if (data.programId !== undefined) add("programId", data.programId);
        if (fields.length === 0) return;
        fields.push(`"updatedAt" = NOW()`);
        values.push(id);
        await prisma.$executeRawUnsafe(
            `UPDATE "CustomClassSlot" SET ${fields.join(", ")} WHERE id = $${idx}`,
            ...values,
        );
        await mirrorCustomSlotToScheduleSlot(id);
        revalidatePath("/schedule");
        revalidatePath("/admin/schedule");
        revalidatePath("/admin/classes");
        revalidatePath("/admin/students");
    } catch (e) {
        console.error("updateCustomSlot failed:", e);
        throw new Error("수정 실패");
    }
}

export async function deleteCustomSlot(id: string) {
    await requireAdmin();
    try {
        await prisma.$executeRawUnsafe(
            `DELETE FROM "CustomClassSlot" WHERE id = $1`,
            id,
        );
        await prisma.$executeRawUnsafe(
            `DELETE FROM "ScheduleSlot" WHERE "slotKey" = $1`,
            `custom-${id}`,
        ).catch((error) => {
            if (!isScheduleSlotMirrorError(error)) {
                console.warn("[deleteCustomSlot] ScheduleSlot mirror delete failed:", error);
            }
        });
        revalidatePath("/schedule");
        revalidatePath("/admin/schedule");
        revalidatePath("/admin/classes");
        revalidatePath("/admin/students");
    } catch (e) {
        console.error("deleteCustomSlot failed:", e);
        throw new Error("삭제 실패");
    }
}
