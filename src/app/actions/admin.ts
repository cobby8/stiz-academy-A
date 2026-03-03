"use server";

import { PrismaClient } from "@prisma/client";
import { revalidatePath } from "next/cache";

const prisma = new PrismaClient();

// Programs
export async function getPrograms() {
    return await prisma.program.findMany({
        orderBy: { createdAt: "desc" },
    });
}

export async function createProgram(data: {
    name: string;
    targetAge?: string;
    frequency?: string;
    description?: string;
    price: number;
}) {
    await prisma.program.create({
        data,
    });
    revalidatePath("/admin/programs");
    revalidatePath("/");
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

// Classes (Schedules)
export async function getClasses() {
    return await prisma.class.findMany({
        include: {
            program: true,
        },
        orderBy: { createdAt: "desc" },
    });
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
    await prisma.class.create({ data });
    revalidatePath("/admin/classes");
    revalidatePath("/");
}

export async function deleteClass(id: string) {
    try {
        await prisma.class.delete({ where: { id } });
        revalidatePath("/admin/classes");
        revalidatePath("/");
    } catch (e) {
        console.error("Failed to delete class:", e);
        throw new Error("Failed to delete class");
    }
}

// Academy Settings
export async function getAcademySettings() {
    try {
        const settings = await prisma.academySettings.findUnique({
            where: { id: "singleton" }
        });

        if (!settings) throw new Error("Not found");
        return settings;
    } catch (e) {
        return {
            pageDesignJSON: null,
            contactPhone: "010-0000-0000",
            address: "다산신도시 체육관",
        };
    }
}

export async function updateAcademySettings(data: {
    pageDesignJSON?: string;
    contactPhone?: string;
    address?: string;
    introductionTitle?: string;
    introductionText?: string;
}) {
    await prisma.academySettings.upsert({
        where: { id: "singleton" },
        update: data,
        create: {
            id: "singleton",
            ...data
        }
    });
    revalidatePath("/admin/settings");
    revalidatePath("/", "layout");
}

// Coaches
export async function getCoaches() {
    try {
        return await prisma.coach.findMany({
            orderBy: { order: "asc" }
        });
    } catch (e) {
        return [];
    }
}

export async function createCoach(data: {
    name: string;
    role: string;
    description?: string;
    imageUrl?: string;
    order?: number;
}) {
    await prisma.coach.create({ data });
    revalidatePath("/admin/settings");
    revalidatePath("/", "layout");
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

// Annual Events (연간일정표)
export async function getAnnualEvents() {
    try {
        return await prisma.annualEvent.findMany({
            orderBy: { date: "asc" },
        });
    } catch (e) {
        return [];
    }
}

export async function createAnnualEvent(data: {
    title: string;
    date: string;
    endDate?: string;
    description?: string;
    category?: string;
}) {
    await prisma.annualEvent.create({
        data: {
            title: data.title,
            date: new Date(data.date),
            endDate: data.endDate ? new Date(data.endDate) : undefined,
            description: data.description,
            category: data.category || "일반",
        },
    });
    revalidatePath("/admin/annual-events");
    revalidatePath("/annual");
}

export async function deleteAnnualEvent(id: string) {
    try {
        await prisma.annualEvent.delete({ where: { id } });
        revalidatePath("/admin/annual-events");
        revalidatePath("/annual");
    } catch (e) {
        console.error("Failed to delete annual event:", e);
        throw new Error("Failed to delete annual event");
    }
}
