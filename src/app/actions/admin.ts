"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

// ── AcademySettings 누락 컬럼 자동 추가 (idempotent) ──────────────────────────
async function ensureAcademySettingsColumns() {
    await prisma.$executeRaw`ALTER TABLE "AcademySettings" ADD COLUMN IF NOT EXISTS "termsOfService" TEXT`;
    await prisma.$executeRaw`ALTER TABLE "AcademySettings" ADD COLUMN IF NOT EXISTS "trialTitle" TEXT DEFAULT '체험수업 안내'`;
    await prisma.$executeRaw`ALTER TABLE "AcademySettings" ADD COLUMN IF NOT EXISTS "trialContent" TEXT`;
    await prisma.$executeRaw`ALTER TABLE "AcademySettings" ADD COLUMN IF NOT EXISTS "trialFormUrl" TEXT`;
    await prisma.$executeRaw`ALTER TABLE "AcademySettings" ADD COLUMN IF NOT EXISTS "enrollTitle" TEXT DEFAULT '수강신청 안내'`;
    await prisma.$executeRaw`ALTER TABLE "AcademySettings" ADD COLUMN IF NOT EXISTS "enrollContent" TEXT`;
    await prisma.$executeRaw`ALTER TABLE "AcademySettings" ADD COLUMN IF NOT EXISTS "enrollFormUrl" TEXT`;
}

// ── Prisma 모델 클라이언트 없이 raw SQL 로 upsert (RETURNING 우회) ──────────────
const ALLOWED_SETTINGS_COLUMNS = [
    'introductionTitle', 'introductionText', 'shuttleInfoText',
    'contactPhone', 'address', 'termsOfService', 'pageDesignJSON',
    'googleCalendarIcsUrl', 'googleSheetsScheduleUrl', 'classDays',
    'siteBodyFont', 'siteHeadingFont',
    'trialTitle', 'trialContent', 'trialFormUrl',
    'enrollTitle', 'enrollContent', 'enrollFormUrl',
] as const;

async function rawUpsertAcademySettings(payload: Record<string, any>) {
    // singleton 행이 없으면 생성
    await prisma.$executeRaw`
        INSERT INTO "AcademySettings" (id, "createdAt", "updatedAt")
        VALUES ('singleton', NOW(), NOW())
        ON CONFLICT (id) DO NOTHING
    `;
    // allowlist 필터링
    const fields = (ALLOWED_SETTINGS_COLUMNS as readonly string[]).filter(
        (col) => payload[col] !== undefined
    );
    if (fields.length === 0) return;
    // 컬럼명은 내부 allowlist 에서만 — $executeRawUnsafe 로 단일 UPDATE
    // 값은 $1, $2, ... 파라미터로 안전하게 바인딩
    const setClause = fields.map((col, i) => `"${col}" = $${i + 1}`).join(', ');
    const values = fields.map((col) => payload[col]);
    await prisma.$executeRawUnsafe(
        `UPDATE "AcademySettings" SET ${setClause}, "updatedAt" = NOW() WHERE id = 'singleton'`,
        ...values
    );
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
    try {
        await prisma.program.create({ data });
    } catch {
        // New columns may not exist yet — retry with only original fields
        try {
            const { days, priceWeek1, priceWeek2, priceWeek3, priceDaily, shuttleFeeOverride, ...original } = data;
            await prisma.program.create({ data: original });
        } catch (e) {
            console.error("Failed to create program:", e);
            throw new Error("데이터베이스에 연결할 수 없습니다. Supabase 연결 설정을 확인해주세요.");
        }
    }
    revalidatePath("/admin/programs");
    revalidatePath("/programs");
    revalidatePath("/schedule");
}

export async function updateProgram(id: string, data: ProgramData) {
    try {
        await prisma.program.update({ where: { id }, data });
    } catch {
        // New columns may not exist yet — retry with only original fields
        try {
            const { days, priceWeek1, priceWeek2, priceWeek3, priceDaily, shuttleFeeOverride, ...original } = data;
            await prisma.program.update({ where: { id }, data: original });
        } catch (e) {
            console.error("Failed to update program:", e);
            throw new Error("프로그램 수정 실패");
        }
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

    // Step 1: 누락 컬럼 자동 추가 (prisma db push 없이도 스키마 일치 보장)
    try {
        await ensureAcademySettingsColumns();
    } catch {
        // DB 비가용 시 무시 — Step 2/3 에서 처리
    }

    // Step 2: Prisma 정상 경로 (컬럼이 존재하면 성공)
    try {
        await prisma.academySettings.upsert({
            where: { id: "singleton" },
            update: payload,
            create: { id: "singleton", ...payload }
        });
    } catch {
        // Step 3: Prisma 모델 클라이언트가 여전히 실패하면 raw SQL 로 직접 업데이트
        // (Prisma RETURNING 절이 누락 컬럼을 참조하는 문제를 완전히 우회)
        try {
            await rawUpsertAcademySettings(payload);
        } catch (e) {
            console.error("Failed to update academy settings:", e);
            throw new Error("데이터베이스에 연결할 수 없습니다. Supabase 연결 설정을 확인해주세요.");
        }
    }
    revalidatePath("/admin/settings");
    revalidatePath("/admin/apply");
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

