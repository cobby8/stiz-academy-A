"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export async function createProgram(data: {
    name: string;
    targetAge?: string;
    frequency?: string;
    description?: string;
    price: number;
}) {
    try {
        await prisma.program.create({ data });
        revalidatePath("/admin/programs");
        revalidatePath("/");
    } catch (e) {
        console.error("Failed to create program:", e);
        throw new Error("데이터베이스에 연결할 수 없습니다. Supabase 연결 설정을 확인해주세요.");
    }
}

export async function deleteProgram(id: string) {
    // First, delete related classes if any
    // But for simple implementation, wait, Prisma doesn't cascade by default unless specified. Let's just catch error or safely delete.
    try {
        await prisma.class.deleteMany({ where: { programId: id } });
        await prisma.program.delete({ where: { id } });
        revalidatePath("/admin/programs");
        revalidatePath("/");
    } catch (e) {
        console.error("Failed to delete program:", e);
        throw new Error("Failed to delete program");
    }
}

export async function createClass(data: {
    programId: string;
    name: string;
    dayOfWeek: string;
    startTime: string;
    endTime: string;
    location?: string;
    capacity: number;
}) {
    try {
        await prisma.class.create({ data });
        revalidatePath("/admin/classes");
        revalidatePath("/schedule");
        revalidatePath("/");
    } catch (e) {
        console.error("Failed to create class:", e);
        throw new Error("데이터베이스에 연결할 수 없습니다. Supabase 연결 설정을 확인해주세요.");
    }
}

export async function deleteClass(id: string) {
    try {
        await prisma.class.delete({ where: { id } });
        revalidatePath("/admin/classes");
        revalidatePath("/schedule");
        revalidatePath("/");
    } catch (e) {
        console.error("Failed to delete class:", e);
        throw new Error("Failed to delete class");
    }
}

export async function updateAcademySettings(data: {
    pageDesignJSON?: string;
    contactPhone?: string;
    address?: string;
    introductionTitle?: string;
    introductionText?: string;
    googleCalendarIcsUrl?: string;
    googleSheetsScheduleUrl?: string;
    classDays?: string;
    siteBodyFont?: string;
    siteHeadingFont?: string;
}) {
    try {
        await prisma.academySettings.upsert({
            where: { id: "singleton" },
            update: data,
            create: { id: "singleton", ...data }
        });
        revalidatePath("/admin/settings");
        revalidatePath("/");
        revalidatePath("/about");
        revalidatePath("/schedule");
        revalidatePath("/", "layout");
    } catch (e) {
        console.error("Failed to update academy settings:", e);
        throw new Error("데이터베이스에 연결할 수 없습니다. Supabase 연결 설정을 확인해주세요.");
    }
}

export async function createCoach(data: {
    name: string;
    role: string;
    description?: string;
    imageUrl?: string;
    order?: number;
}) {
    try {
        await prisma.coach.create({ data });
        revalidatePath("/admin/settings");
        revalidatePath("/", "layout");
    } catch (e) {
        console.error("Failed to create coach:", e);
        throw new Error("데이터베이스에 연결할 수 없습니다. Supabase 연결 설정을 확인해주세요.");
    }
}

export async function deleteCoach(id: string) {
    try {
        await prisma.coach.delete({ where: { id } });
        revalidatePath("/admin/settings");
        revalidatePath("/", "layout");
    } catch (e) {
        console.error("Failed to delete coach:", e);
        throw new Error("Failed to delete coach");
    }
}

