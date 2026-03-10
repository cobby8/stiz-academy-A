/**
 * 순수 DB 조회 함수들 (mutations 제외)
 * react.cache() 로 감싸 동일 요청 내 중복 DB 호출을 자동 제거 (request-level memoization)
 * "use server" 없음 — 일반 서버 모듈로 import 가능
 */
import { cache } from "react";
import { prisma } from "@/lib/prisma";

export const getAcademySettings = cache(async () => {
    // Try Prisma first, then raw SQL fallback (in case schema mismatch affects Prisma)
    try {
        const settings = await prisma.academySettings.findUnique({
            where: { id: "singleton" },
        });
        if (settings) return settings;
    } catch {
        // Prisma query failed — try raw SQL
    }
    try {
        const rows = await prisma.$queryRaw<any[]>`
            SELECT * FROM "AcademySettings" WHERE id = 'singleton' LIMIT 1
        `;
        if (rows[0]) return rows[0];
    } catch {
        // Both failed — return safe fallback
    }
    return {
        pageDesignJSON: null,
        contactPhone: "010-0000-0000",
        address: "다산신도시 체육관",
    } as any;
});

export const getPrograms = cache(async () => {
    try {
        return await prisma.program.findMany({
            orderBy: [{ order: "asc" }, { createdAt: "desc" }],
        });
    } catch {
        // Prisma failed (likely schema mismatch) — try raw SQL with original columns
        try {
            const rows = await prisma.$queryRaw<any[]>`
                SELECT
                    id, name, "targetAge", frequency, "weeklyFrequency",
                    description, price, "createdAt", "updatedAt"
                FROM "Program" ORDER BY "createdAt" DESC
            `;
            return rows.map((r: any) => ({
                ...r,
                price: Number(r.price ?? 0),
                order: 0,
                targetAge: r.targetage ?? r.targetAge ?? null,
                weeklyFrequency: r.weeklyfrequency ?? r.weeklyFrequency ?? null,
                days: null,
                priceWeek1: null,
                priceWeek2: null,
                priceWeek3: null,
                priceDaily: null,
                shuttleFeeOverride: null,
            }));
        } catch {
            return [];
        }
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
    // Try full Prisma query first (works after DB migration)
    try {
        return await prisma.classSlotOverride.findMany({
            include: { coach: true },
            orderBy: { slotKey: "asc" },
        });
    } catch {
        // Prisma failed (likely new columns not yet in DB) — raw SQL fallback with original columns
    }
    try {
        const rows = await prisma.$queryRaw<any[]>`
            SELECT
                cso.id,
                cso."slotKey",
                cso.label,
                cso.note,
                cso."isHidden",
                cso.capacity,
                cso."coachId",
                cso."createdAt",
                cso."updatedAt",
                c.id          AS c_id,
                c.name        AS c_name,
                c.role        AS c_role,
                c."imageUrl"  AS c_imageurl,
                c.description AS c_desc,
                c."order"     AS c_order
            FROM "ClassSlotOverride" cso
            LEFT JOIN "Coach" c ON cso."coachId" = c.id
            ORDER BY cso."slotKey" ASC
        `;
        return rows.map((r: any) => ({
            id: r.id,
            slotKey: r.slotkey ?? r.slotKey,
            label: r.label ?? null,
            note: r.note ?? null,
            isHidden: r.ishidden ?? r.isHidden ?? false,
            capacity: Number(r.capacity ?? 12),
            coachId: r.coachid ?? r.coachId ?? null,
            startTimeOverride: null,
            endTimeOverride: null,
            programId: null,
            createdAt: r.createdat ?? r.createdAt,
            updatedAt: r.updatedat ?? r.updatedAt,
            coach: r.c_id ? {
                id: r.c_id,
                name: r.c_name,
                role: r.c_role,
                imageUrl: r.c_imageurl ?? null,
                description: r.c_desc ?? null,
                order: Number(r.c_order ?? 0),
                createdAt: new Date(),
                updatedAt: new Date(),
                slots: [],
                customSlots: [],
            } : null,
        }));
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

export const getCustomClassSlots = cache(async () => {
    try {
        return await prisma.customClassSlot.findMany({
            include: { coach: true },
            orderBy: [{ dayKey: "asc" }, { startTime: "asc" }],
        });
    } catch {
        return [];
    }
});
