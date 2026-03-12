"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

// ── AcademySettings 누락 컬럼 자동 추가 (idempotent) ──────────────────────────
// $executeRawUnsafe 사용: simple query protocol → PgBouncer transaction mode 호환
// $executeRaw 태그드 템플릿은 prepared statement(extended protocol)를 사용해 PgBouncer가 차단
async function ensureAcademySettingsColumns() {
    const columns: [string, string][] = [
        ["googleSheetsScheduleUrl", "TEXT"],
        ["googleCalendarIcsUrl", "TEXT"],
        ["termsOfService", "TEXT"],
        ["trialTitle", "TEXT DEFAULT '체험수업 안내'"],
        ["trialContent", "TEXT"],
        ["trialFormUrl", "TEXT"],
        ["enrollTitle", "TEXT DEFAULT '수강신청 안내'"],
        ["enrollContent", "TEXT"],
        ["enrollFormUrl", "TEXT"],
        ["youtubeUrl", "TEXT"],
    ];
    for (const [col, type] of columns) {
        try {
            await prisma.$executeRawUnsafe(
                `ALTER TABLE "AcademySettings" ADD COLUMN IF NOT EXISTS "${col}" ${type}`
            );
        } catch (e) {
            console.warn(`[DDL] column "${col}" ensure failed:`, (e as Error).message);
        }
    }
}

// ── Prisma 모델 클라이언트 없이 raw SQL 로 upsert (RETURNING 우회) ──────────────
const ALLOWED_SETTINGS_COLUMNS = [
    'introductionTitle', 'introductionText', 'shuttleInfoText',
    'contactPhone', 'address', 'termsOfService', 'pageDesignJSON',
    'googleCalendarIcsUrl', 'googleSheetsScheduleUrl', 'classDays',
    'siteBodyFont', 'siteHeadingFont',
    'trialTitle', 'trialContent', 'trialFormUrl',
    'enrollTitle', 'enrollContent', 'enrollFormUrl',
    'youtubeUrl',
] as const;

async function rawUpsertAcademySettings(payload: Record<string, any>) {
    // singleton 행이 없으면 생성 — $executeRawUnsafe: simple query protocol (PgBouncer 호환)
    await prisma.$executeRawUnsafe(
        `INSERT INTO "AcademySettings" (id, "createdAt", "updatedAt") VALUES ('singleton', NOW(), NOW()) ON CONFLICT (id) DO NOTHING`
    );
    // 컬럼별 개별 UPDATE
    for (const col of ALLOWED_SETTINGS_COLUMNS) {
        if (payload[col] === undefined) continue;
        try {
            await prisma.$executeRawUnsafe(
                `UPDATE "AcademySettings" SET "${col}" = $1, "updatedAt" = NOW() WHERE id = 'singleton'`,
                payload[col]
            );
        } catch (e) {
            // 컬럼이 DB에 아직 없는 경우 — 로깅 후 건너뜀 (다른 컬럼 저장은 계속)
            console.error(`[rawUpsert] column "${col}" save failed:`, (e as Error).message);
        }
    }
}

type ProgramData = {
    name: string;
    targetAge?: string;
    weeklyFrequency?: string;
    description?: string;
    price: number;
    days?: string | null;
    priceWeek1?: number | null;
    priceWeek2?: number | null;
    priceWeek3?: number | null;
    priceDaily?: number | null;
    shuttleFeeOverride?: number | null;
};

export async function createProgram(data: ProgramData) {
    const { name, targetAge, weeklyFrequency, description, price, days, priceWeek1, priceWeek2, priceWeek3, priceDaily, shuttleFeeOverride } = data;
    // $executeRawUnsafe: simple query protocol → PgBouncer transaction mode 호환
    try {
        await prisma.$executeRawUnsafe(
            `INSERT INTO "Program" (id, "name", "targetAge", "weeklyFrequency", "description", "price", "days", "priceWeek1", "priceWeek2", "priceWeek3", "priceDaily", "shuttleFeeOverride", "order", "createdAt", "updatedAt")
             VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
               (SELECT COALESCE(MAX("order"), -1) + 1 FROM "Program"), now(), now())`,
            name,
            targetAge ?? null,
            weeklyFrequency ?? null,
            description ?? null,
            price,
            days ?? null,
            priceWeek1 ?? null,
            priceWeek2 ?? null,
            priceWeek3 ?? null,
            priceDaily ?? null,
            shuttleFeeOverride ?? null,
        );
    } catch (e) {
        console.error("Failed to create program:", e);
        throw new Error("데이터베이스에 연결할 수 없습니다. Supabase 연결 설정을 확인해주세요.");
    }
    revalidatePath("/admin/programs");
    revalidatePath("/programs");
    revalidatePath("/schedule");
}

export async function updateProgram(id: string, data: ProgramData) {
    const { name, targetAge, weeklyFrequency, description, price, days, priceWeek1, priceWeek2, priceWeek3, priceDaily, shuttleFeeOverride } = data;
    // $executeRawUnsafe: simple query protocol → PgBouncer transaction mode 호환
    try {
        await prisma.$executeRawUnsafe(
            `UPDATE "Program" SET
               "name" = $1,
               "targetAge" = $2,
               "weeklyFrequency" = $3,
               "description" = $4,
               "price" = $5,
               "days" = $6,
               "priceWeek1" = $7,
               "priceWeek2" = $8,
               "priceWeek3" = $9,
               "priceDaily" = $10,
               "shuttleFeeOverride" = $11,
               "updatedAt" = now()
             WHERE id = $12`,
            name,
            targetAge ?? null,
            weeklyFrequency ?? null,
            description ?? null,
            price,
            days ?? null,
            priceWeek1 ?? null,
            priceWeek2 ?? null,
            priceWeek3 ?? null,
            priceDaily ?? null,
            shuttleFeeOverride ?? null,
            id,
        );
    } catch (e) {
        console.error("Failed to update program:", e);
        throw new Error("프로그램 수정 실패");
    }
    revalidatePath("/admin/programs");
    revalidatePath("/programs");
    revalidatePath("/schedule");
}

export async function reorderPrograms(orderedIds: string[]) {
    try {
        await prisma.$transaction(
            orderedIds.map((id, index) =>
                prisma.program.update({ where: { id }, data: { order: index } })
            )
        );
    } catch {
        // order column may not exist yet — try raw SQL
        try {
            for (let i = 0; i < orderedIds.length; i++) {
                await prisma.$executeRaw`UPDATE "Program" SET "order" = ${i} WHERE id = ${orderedIds[i]}`;
            }
        } catch {}
    }
    revalidatePath("/admin/programs");
    revalidatePath("/programs");
}

export async function deleteProgram(id: string) {
    try {
        await prisma.class.deleteMany({ where: { programId: id } });
        await prisma.program.delete({ where: { id } });
        revalidatePath("/admin/programs");
        revalidatePath("/programs");
        revalidatePath("/schedule");
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
    termsOfService?: string;
    trialTitle?: string;
    trialContent?: string;
    trialFormUrl?: string;
    enrollTitle?: string;
    enrollContent?: string;
    enrollFormUrl?: string;
}) {
    // 빈 URL 필드는 기존 DB 값을 덮어쓰지 않음
    const payload = { ...data };
    if (payload.googleSheetsScheduleUrl === "") delete payload.googleSheetsScheduleUrl;
    if (payload.googleCalendarIcsUrl === "") delete payload.googleCalendarIcsUrl;

    // Step 1: 누락 컬럼 자동 추가 ($executeRawUnsafe = simple protocol → PgBouncer 통과)
    try {
        await ensureAcademySettingsColumns();
    } catch (e) {
        console.warn("[settings] DDL step failed:", (e as Error).message);
    }

    // Step 2: raw SQL 로 직접 저장 (Prisma RETURNING 절의 누락 컬럼 문제 완전 우회)
    try {
        await rawUpsertAcademySettings(payload);
    } catch (e) {
        console.error("Failed to update academy settings:", e);
        throw new Error("설정 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    }
    revalidatePath("/admin/settings");
    revalidatePath("/admin/apply");
    revalidatePath("/admin/schedule");
    revalidatePath("/");
    revalidatePath("/about");
    revalidatePath("/schedule");
    revalidatePath("/apply");
    revalidatePath("/", "layout");
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
        revalidatePath("/admin/coaches");
        revalidatePath("/admin/schedule");
        revalidatePath("/about");
        revalidatePath("/schedule");
    } catch (e) {
        console.error("Failed to create coach:", e);
        throw new Error("데이터베이스에 연결할 수 없습니다. Supabase 연결 설정을 확인해주세요.");
    }
}

export async function updateCoach(id: string, data: {
    name: string;
    role: string;
    description?: string;
    imageUrl?: string;
}) {
    try {
        await prisma.coach.update({ where: { id }, data });
        revalidatePath("/admin/coaches");
        revalidatePath("/admin/schedule");
        revalidatePath("/about");
        revalidatePath("/schedule");
    } catch (e) {
        console.error("Failed to update coach:", e);
        throw new Error("코치 정보 수정 실패");
    }
}

export async function deleteCoach(id: string) {
    try {
        await prisma.coach.delete({ where: { id } });
        revalidatePath("/admin/coaches");
        revalidatePath("/admin/schedule");
        revalidatePath("/about");
        revalidatePath("/schedule");
    } catch (e) {
        console.error("Failed to delete coach:", e);
        throw new Error("Failed to delete coach");
    }
}

export async function moveCoach(id: string, direction: "up" | "down") {
    try {
        const coaches = await prisma.coach.findMany({ orderBy: { order: "asc" } });
        const idx = coaches.findIndex((c) => c.id === id);
        if (idx === -1) return;
        const swapIdx = direction === "up" ? idx - 1 : idx + 1;
        if (swapIdx < 0 || swapIdx >= coaches.length) return;
        const a = coaches[idx];
        const b = coaches[swapIdx];
        await prisma.$transaction([
            prisma.coach.update({ where: { id: a.id }, data: { order: b.order } }),
            prisma.coach.update({ where: { id: b.id }, data: { order: a.order } }),
        ]);
        revalidatePath("/admin/coaches");
        revalidatePath("/about");
        revalidatePath("/schedule");
    } catch (e) {
        console.error("Failed to move coach:", e);
        throw new Error("순서 변경 실패");
    }
}

export async function reorderCoaches(ids: string[]) {
    try {
        await prisma.$transaction(
            ids.map((id, index) => prisma.coach.update({ where: { id }, data: { order: index } }))
        );
        revalidatePath("/admin/coaches");
        revalidatePath("/about");
        revalidatePath("/schedule");
    } catch (e) {
        console.error("Failed to reorder coaches:", e);
        throw new Error("순서 변경 실패");
    }
}

