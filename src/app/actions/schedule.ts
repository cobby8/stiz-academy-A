"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

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
    try {
        await prisma.classSlotOverride.upsert({
            where: { slotKey },
            update: data,
            create: { slotKey, ...data },
        });
        revalidatePath("/schedule");
        revalidatePath("/admin/schedule");
    } catch (e) {
        console.error("upsertClassSlotOverride failed:", e);
        throw new Error("저장 실패");
    }
}

export async function deleteClassSlotOverride(slotKey: string) {
    try {
        await prisma.classSlotOverride.delete({ where: { slotKey } });
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
    try {
        await prisma.customClassSlot.create({ data });
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
    try {
        await prisma.customClassSlot.update({ where: { id }, data });
        revalidatePath("/schedule");
        revalidatePath("/admin/schedule");
    } catch (e) {
        console.error("updateCustomSlot failed:", e);
        throw new Error("수정 실패");
    }
}

export async function deleteCustomSlot(id: string) {
    try {
        await prisma.customClassSlot.delete({ where: { id } });
        revalidatePath("/schedule");
        revalidatePath("/admin/schedule");
    } catch (e) {
        console.error("deleteCustomSlot failed:", e);
        throw new Error("삭제 실패");
    }
}
