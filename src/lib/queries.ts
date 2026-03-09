/**
 * 순수 DB 조회 함수들 (mutations 제외)
 * react.cache() 로 감싸 동일 요청 내 중복 DB 호출을 자동 제거 (request-level memoization)
 * "use server" 없음 — 일반 서버 모듈로 import 가능
 */
import { cache } from "react";
import { prisma } from "@/lib/prisma";

export const getAcademySettings = cache(async () => {
    try {
        const settings = await prisma.academySettings.findUnique({
            where: { id: "singleton" },
        });
        if (!settings) throw new Error("Not found");
        return settings;
    } catch {
        return {
            pageDesignJSON: null,
            contactPhone: "010-0000-0000",
            address: "다산신도시 체육관",
        } as any;
    }
});

export const getPrograms = cache(async () => {
    try {
        return await prisma.program.findMany({
            orderBy: { createdAt: "desc" },
        });
    } catch {
        return [];
    }
});

export const getClasses = cache(async () => {
    try {
        return await prisma.class.findMany({
            include: { program: true },
            orderBy: { createdAt: "desc" },
        });
    } catch {
        return [];
    }
});

export const getClassSlotOverrides = cache(async () => {
    try {
        return await prisma.classSlotOverride.findMany({
            include: { coach: true },
            orderBy: { slotKey: "asc" },
        });
    } catch {
        return [];
    }
});

export const getCoaches = cache(async () => {
    try {
        return await prisma.coach.findMany({
            orderBy: { order: "asc" },
        });
    } catch {
        return [];
    }
});
