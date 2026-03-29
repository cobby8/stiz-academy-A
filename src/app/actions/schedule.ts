"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";

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
        revalidatePath("/schedule");
        revalidatePath("/admin/schedule");
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
        await prisma.$executeRawUnsafe(
            `INSERT INTO "CustomClassSlot" (
                id, "dayKey", "startTime", "endTime", label, "gradeRange",
                enrolled, capacity, note, "isHidden", "coachId", "programId",
                "createdAt", "updatedAt"
            ) VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())`,
            data.dayKey, data.startTime, data.endTime, data.label,
            data.gradeRange ?? null,
            data.enrolled ?? 0, data.capacity ?? 12,
            data.note ?? null, data.isHidden ?? false,
            data.coachId ?? null, data.programId ?? null,
        );
        revalidatePath("/schedule");
        revalidatePath("/admin/schedule");
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
        revalidatePath("/schedule");
        revalidatePath("/admin/schedule");
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
        revalidatePath("/schedule");
        revalidatePath("/admin/schedule");
    } catch (e) {
        console.error("deleteCustomSlot failed:", e);
        throw new Error("삭제 실패");
    }
}
