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
