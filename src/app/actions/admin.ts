"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";
import { sendPushToUser } from "@/lib/pushNotification";
import type { SheetClassSlot } from "@/lib/googleSheetsSchedule";
import {
    createCalendarEvent,
    updateCalendarEvent,
    deleteCalendarEvent,
} from "@/lib/googleCalendarWrite";

// ── AcademySettings 누락 컬럼 자동 추가 (idempotent) ──────────────────────────
// $executeRawUnsafe 사용: simple query protocol → PgBouncer transaction mode 호환
// $executeRaw 태그드 템플릿은 prepared statement(extended protocol)를 사용해 PgBouncer가 차단
let _columnsEnsured = false;
export async function ensureAcademySettingsColumns() {
    if (_columnsEnsured) return;
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
        ["philosophyText", "TEXT"],
        ["facilitiesText", "TEXT"],
        ["facilitiesImagesJSON", "TEXT"],
        ["galleryImagesJSON", "TEXT"],
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
    _columnsEnsured = true;
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
    'philosophyText',
    'facilitiesText',
    'facilitiesImagesJSON',
    'galleryImagesJSON',
] as const;

async function rawUpsertAcademySettings(payload: Record<string, any>) {
    // singleton 행이 없으면 생성
    await prisma.$executeRawUnsafe(
        `INSERT INTO "AcademySettings" (id, "createdAt", "updatedAt") VALUES ('singleton', NOW(), NOW()) ON CONFLICT (id) DO NOTHING`
    );

    const colsToUpdate = ALLOWED_SETTINGS_COLUMNS.filter(col => payload[col] !== undefined);
    if (colsToUpdate.length === 0) return;

    const values = colsToUpdate.map(col => payload[col]);

    // 단일 배치 UPDATE: 19개 개별 쿼리(~1,400ms) → 쿼리 1개(~75ms)
    // 신규 컬럼 없을 때까지 재시도 (최대 컬럼 수)
    for (let attempt = 0; attempt <= colsToUpdate.length; attempt++) {
        const setClauses = colsToUpdate.map((col, i) => `"${col}" = $${i + 1}`).join(", ");
        try {
            await prisma.$executeRawUnsafe(
                `UPDATE "AcademySettings" SET ${setClauses}, "updatedAt" = NOW() WHERE id = 'singleton'`,
                ...values
            );
            return; // 성공
        } catch (e) {
            const msg = (e as Error).message ?? "";
            // PostgreSQL: column "X" of relation "Y" does not exist
            const missingCol = msg.match(/column "([^"]+)" of relation/)?.[1];
            if (missingCol) {
                // 해당 컬럼만 추가 후 재시도
                try {
                    await prisma.$executeRawUnsafe(
                        `ALTER TABLE "AcademySettings" ADD COLUMN IF NOT EXISTS "${missingCol}" TEXT`
                    );
                } catch {}
            } else {
                console.error("[rawUpsert] batch update failed:", msg);
                throw e;
            }
        }
    }
    // 루프 종료까지 return 없음 = 모든 재시도 실패
    throw new Error("설정 컬럼 추가 후에도 저장에 실패했습니다. DB 스키마를 확인해 주세요.");
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
    imageUrl?: string | null;
};

export async function createProgram(data: ProgramData) {
    await requireAdmin();
    const { name, targetAge, weeklyFrequency, description, price, days, priceWeek1, priceWeek2, priceWeek3, priceDaily, shuttleFeeOverride, imageUrl } = data;
    // $executeRawUnsafe: simple query protocol → PgBouncer transaction mode 호환
    try {
        await prisma.$executeRawUnsafe(
            `INSERT INTO "Program" (id, "name", "targetAge", "weeklyFrequency", "description", "price", "days", "priceWeek1", "priceWeek2", "priceWeek3", "priceDaily", "shuttleFeeOverride", "imageUrl", "order", "createdAt", "updatedAt")
             VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
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
            imageUrl ?? null,
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
    await requireAdmin();
    const { name, targetAge, weeklyFrequency, description, price, days, priceWeek1, priceWeek2, priceWeek3, priceDaily, shuttleFeeOverride, imageUrl } = data;
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
               "imageUrl" = $12,
               "updatedAt" = now()
             WHERE id = $13`,
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
            imageUrl ?? null,
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
    await requireAdmin();
    // 파라미터 바인딩으로 SQL 인젝션 방지 + $executeRawUnsafe로 PgBouncer 호환
    try {
        for (let i = 0; i < orderedIds.length; i++) {
            await prisma.$executeRawUnsafe(
                `UPDATE "Program" SET "order" = $1 WHERE id = $2`, i, orderedIds[i]
            );
        }
    } catch (e) {
        console.error("Failed to reorder programs:", e);
    }
    revalidatePath("/admin/programs");
    revalidatePath("/programs");
}

export async function deleteProgram(id: string) {
    await requireAdmin();
    // $executeRawUnsafe: PgBouncer transaction mode 호환 (Prisma ORM 메서드 사용 불가)
    try {
        await prisma.$executeRawUnsafe(`DELETE FROM "Class" WHERE "programId" = $1`, id);
        await prisma.$executeRawUnsafe(`DELETE FROM "Program" WHERE id = $1`, id);
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
    await requireAdmin();
    try {
        await prisma.$executeRawUnsafe(
            `INSERT INTO "Class" (id, "programId", name, "dayOfWeek", "startTime", "endTime", location, capacity, "createdAt", "updatedAt")
             VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
            data.programId, data.name, data.dayOfWeek,
            data.startTime || "", data.endTime || "",
            data.location || null, data.capacity,
        );
    } catch (e) {
        console.error("Failed to create class:", e);
        throw new Error("데이터베이스에 연결할 수 없습니다. Supabase 연결 설정을 확인해주세요.");
    }
    revalidatePath("/admin/classes");
    revalidatePath("/schedule");
    revalidatePath("/");
}

export async function updateClass(id: string, data: {
    programId: string;
    name: string;
    dayOfWeek: string;
    startTime: string;
    endTime: string;
    location?: string;
    capacity: number;
}) {
    await requireAdmin();
    try {
        await prisma.$executeRawUnsafe(
            `UPDATE "Class" SET "programId" = $1, name = $2, "dayOfWeek" = $3,
             "startTime" = $4, "endTime" = $5, location = $6, capacity = $7, "updatedAt" = NOW()
             WHERE id = $8`,
            data.programId, data.name, data.dayOfWeek,
            data.startTime || "", data.endTime || "",
            data.location || null, data.capacity, id,
        );
    } catch (e) {
        console.error("Failed to update class:", e);
        throw new Error("반 수정 실패");
    }
    revalidatePath("/admin/classes");
    revalidatePath("/schedule");
    revalidatePath("/");
}

export async function deleteClass(id: string) {
    await requireAdmin();
    try {
        await prisma.$executeRawUnsafe(`DELETE FROM "Enrollment" WHERE "classId" = $1`, id);
        await prisma.$executeRawUnsafe(`DELETE FROM "Class" WHERE id = $1`, id);
    } catch (e) {
        console.error("Failed to delete class:", e);
        throw new Error("반 삭제 실패");
    }
    revalidatePath("/admin/classes");
    revalidatePath("/schedule");
    revalidatePath("/");
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
    youtubeUrl?: string;
    philosophyText?: string;
    facilitiesText?: string;
    facilitiesImagesJSON?: string;
    galleryImagesJSON?: string;
}) {
    await requireAdmin();
    // 빈 URL 필드는 기존 DB 값을 덮어쓰지 않음
    const payload = { ...data };
    if (payload.googleSheetsScheduleUrl === "") delete payload.googleSheetsScheduleUrl;
    if (payload.googleCalendarIcsUrl === "") delete payload.googleCalendarIcsUrl;

    // raw SQL 로 직접 저장 — 누락 컬럼은 rawUpsertAcademySettings 내부에서 lazily 추가
    try {
        await rawUpsertAcademySettings(payload);
    } catch (e) {
        console.error("Failed to update academy settings:", e);
        throw new Error("설정 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    }
    revalidatePath("/");
    revalidatePath("/about");
    revalidatePath("/admin/settings");
}

export async function createCoach(data: {
    name: string;
    role: string;
    description?: string;
    imageUrl?: string;
    order?: number;
}) {
    await requireAdmin();
    // $executeRawUnsafe: PgBouncer transaction mode 호환 (Prisma ORM 메서드 사용 불가)
    try {
        await prisma.$executeRawUnsafe(
            `INSERT INTO "Coach" (id, name, role, description, "imageUrl", "order", "createdAt", "updatedAt")
             VALUES (gen_random_uuid()::text, $1, $2, $3, $4,
               COALESCE($5, (SELECT COALESCE(MAX("order"), -1) + 1 FROM "Coach")),
               NOW(), NOW())`,
            data.name,
            data.role,
            data.description || null,
            data.imageUrl || null,
            data.order ?? null,
        );
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
    await requireAdmin();
    // $executeRawUnsafe: PgBouncer transaction mode 호환 (Prisma ORM 메서드 사용 불가)
    try {
        await prisma.$executeRawUnsafe(
            `UPDATE "Coach" SET name = $1, role = $2, description = $3, "imageUrl" = $4, "updatedAt" = NOW()
             WHERE id = $5`,
            data.name,
            data.role,
            data.description || null,
            data.imageUrl || null,
            id,
        );
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
    await requireAdmin();
    // $executeRawUnsafe: PgBouncer transaction mode 호환 (Prisma ORM 메서드 사용 불가)
    try {
        await prisma.$executeRawUnsafe(`DELETE FROM "Coach" WHERE id = $1`, id);
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
    await requireAdmin();
    // $queryRawUnsafe + $executeRawUnsafe: PgBouncer transaction mode 호환
    try {
        const coaches = await prisma.$queryRawUnsafe<any[]>(
            `SELECT id, "order" FROM "Coach" ORDER BY "order" ASC`
        );
        const idx = coaches.findIndex((c: any) => c.id === id);
        if (idx === -1) return;
        const swapIdx = direction === "up" ? idx - 1 : idx + 1;
        if (swapIdx < 0 || swapIdx >= coaches.length) return;
        const a = coaches[idx];
        const b = coaches[swapIdx];
        // 두 코치의 order 값을 서로 교환
        await prisma.$executeRawUnsafe(
            `UPDATE "Coach" SET "order" = $1 WHERE id = $2`, b.order, a.id
        );
        await prisma.$executeRawUnsafe(
            `UPDATE "Coach" SET "order" = $1 WHERE id = $2`, a.order, b.id
        );
        revalidatePath("/admin/coaches");
        revalidatePath("/about");
        revalidatePath("/schedule");
    } catch (e) {
        console.error("Failed to move coach:", e);
        throw new Error("순서 변경 실패");
    }
}

export async function reorderCoaches(ids: string[]) {
    await requireAdmin();
    // 파라미터 바인딩으로 SQL 인젝션 방지 + PgBouncer 호환
    try {
        if (ids.length === 0) return;
        for (let i = 0; i < ids.length; i++) {
            await prisma.$executeRawUnsafe(
                `UPDATE "Coach" SET "order" = $1 WHERE id = $2`, i, ids[i]
            );
        }
        revalidatePath("/admin/coaches");
        revalidatePath("/about");
        revalidatePath("/schedule");
    } catch (e) {
        console.error("Failed to reorder coaches:", e);
        throw new Error("순서 변경 실패");
    }
}

// ── 연간일정 CRUD ─────────────────────────────────────────────────────────────
export async function createAnnualEvent(data: {
    title: string;
    date: string;
    endDate?: string | null;
    description?: string | null;
    category?: string;
}) {
    await requireAdmin();
    // ID를 미리 생성하여 INSERT 후 구글 이벤트 ID를 UPDATE할 때 사용
    const id = crypto.randomUUID();

    try {
        // 1단계: DB에 먼저 저장 (googleEventId는 null로 시작)
        await prisma.$executeRawUnsafe(
            `INSERT INTO "AnnualEvent" (id, title, date, "endDate", description, category, "googleEventId", "createdAt", "updatedAt")
             VALUES ($1, $2, $3::timestamp, $4::timestamp, $5, $6, NULL, NOW(), NOW())`,
            id,
            data.title,
            data.date,
            data.endDate || null,
            data.description || null,
            data.category || "일반",
        );
    } catch (e) {
        console.error("Failed to create annual event:", e);
        throw new Error("일정 추가 실패");
    }

    // 2단계: 구글 캘린더에 동기화 (best-effort — 실패해도 DB는 이미 저장됨)
    const googleEventId = await createCalendarEvent({
        title: data.title,
        date: data.date,
        endDate: data.endDate,
        description: data.description,
    });

    // 3단계: 구글 이벤트 ID를 DB에 저장 (성공한 경우만)
    if (googleEventId) {
        try {
            await prisma.$executeRawUnsafe(
                `UPDATE "AnnualEvent" SET "googleEventId" = $1, "updatedAt" = NOW() WHERE id = $2`,
                googleEventId,
                id,
            );
        } catch (e) {
            console.error("Failed to save googleEventId:", e);
            // googleEventId 저장 실패해도 이벤트 자체는 DB에 존재하므로 무시
        }
    }

    revalidatePath("/admin/annual");
    revalidatePath("/annual");
}

export async function updateAnnualEvent(id: string, data: {
    title: string;
    date: string;
    endDate?: string | null;
    description?: string | null;
    category?: string;
}) {
    await requireAdmin();
    // 1단계: DB 먼저 수정
    try {
        await prisma.$executeRawUnsafe(
            `UPDATE "AnnualEvent" SET title = $1, date = $2::timestamp, "endDate" = $3::timestamp,
             description = $4, category = $5, "updatedAt" = NOW() WHERE id = $6`,
            data.title,
            data.date,
            data.endDate || null,
            data.description || null,
            data.category || "일반",
            id,
        );
    } catch (e) {
        console.error("Failed to update annual event:", e);
        throw new Error("일정 수정 실패");
    }

    // 2단계: 구글 캘린더 동기화 (best-effort)
    // 기존 googleEventId를 조회하여 구글 이벤트도 함께 수정
    try {
        const rows = await prisma.$queryRawUnsafe<{ googleEventId: string | null }[]>(
            `SELECT "googleEventId" FROM "AnnualEvent" WHERE id = $1`,
            id,
        );
        const gId = rows[0]?.googleEventId;
        if (gId) {
            await updateCalendarEvent(gId, {
                title: data.title,
                date: data.date,
                endDate: data.endDate,
                description: data.description,
            });
        }
    } catch (e) {
        // 구글 동기화 실패해도 DB 수정은 이미 완료됨
        console.error("Failed to sync update to Google Calendar:", e);
    }

    revalidatePath("/admin/annual");
    revalidatePath("/annual");
}

export async function deleteAnnualEvent(id: string) {
    await requireAdmin();
    // 1단계: 삭제 전에 구글 이벤트 ID를 먼저 조회 (삭제 후에는 조회 불가)
    let googleEventId: string | null = null;
    try {
        const rows = await prisma.$queryRawUnsafe<{ googleEventId: string | null }[]>(
            `SELECT "googleEventId" FROM "AnnualEvent" WHERE id = $1`,
            id,
        );
        googleEventId = rows[0]?.googleEventId ?? null;
    } catch (e) {
        console.error("Failed to fetch googleEventId before delete:", e);
    }

    // 2단계: DB에서 삭제
    try {
        await prisma.$executeRawUnsafe(
            `DELETE FROM "AnnualEvent" WHERE id = $1`,
            id,
        );
    } catch (e) {
        console.error("Failed to delete annual event:", e);
        throw new Error("일정 삭제 실패");
    }

    // 3단계: 구글 캘린더에서도 삭제 (best-effort)
    if (googleEventId) {
        await deleteCalendarEvent(googleEventId);
    }

    revalidatePath("/admin/annual");
    revalidatePath("/annual");
}

// ── 원생 관리 CRUD ────────────────────────────────────────────────────────────
export async function createStudent(data: {
    name: string;
    birthDate: string;
    gender?: string | null;
    parentName: string;
    parentPhone?: string | null;
    parentEmail?: string | null;
    // 새 필드: 엑셀 업로드 일괄 등록에서도 사용
    phone?: string | null;       // 학생 휴대폰번호
    school?: string | null;      // 학교명
    grade?: string | null;       // 학년
    address?: string | null;     // 주소
    enrollDate?: string | null;  // 입회일자
    memo?: string | null;        // 메모
}) {
    await requireAdmin();
    try {
        // 학부모 User 생성 또는 조회 (이메일 기준)
        let parentId: string;
        const email = data.parentEmail?.trim() || `parent_${Date.now()}@stiz.local`;

        const existing = await prisma.$queryRawUnsafe<any[]>(
            `SELECT id FROM "User" WHERE email = $1 LIMIT 1`, email
        );

        if (existing.length > 0) {
            parentId = existing[0].id;
            // 이름/전화번호 업데이트
            await prisma.$executeRawUnsafe(
                `UPDATE "User" SET name = $1, phone = $2, "updatedAt" = NOW() WHERE id = $3`,
                data.parentName, data.parentPhone || null, parentId,
            );
        } else {
            const rows = await prisma.$queryRawUnsafe<any[]>(
                `INSERT INTO "User" (id, email, name, phone, role, "createdAt", "updatedAt")
                 VALUES (gen_random_uuid()::text, $1, $2, $3, 'PARENT', NOW(), NOW())
                 RETURNING id`,
                email, data.parentName, data.parentPhone || null,
            );
            parentId = rows[0].id;
        }

        // 원생 생성: 새 필드(phone, school, grade, address, enrollDate, memo) 포함
        await prisma.$executeRawUnsafe(
            `INSERT INTO "Student" (id, name, "birthDate", gender, "parentId", phone, school, grade, address, "enrollDate", memo, "createdAt", "updatedAt")
             VALUES (gen_random_uuid()::text, $1, $2::timestamp, $3, $4, $5, $6, $7, $8, $9::timestamp, $10, NOW(), NOW())`,
            data.name,
            data.birthDate,
            data.gender || null,
            parentId,
            data.phone || null,
            data.school || null,
            data.grade || null,
            data.address || null,
            data.enrollDate || null,
            data.memo || null,
        );
    } catch (e) {
        console.error("Failed to create student:", e);
        throw new Error("원생 등록 실패");
    }
    revalidatePath("/admin/students");
    revalidatePath("/admin");
}

export async function updateStudentMemo(id: string, memo: string) {
    await requireAdmin();
    try {
        await prisma.$executeRawUnsafe(
            `UPDATE "Student" SET memo = $1, "updatedAt" = NOW() WHERE id = $2`,
            memo || null, id,
        );
    } catch (e) {
        console.error("Failed to update student memo:", e);
        throw new Error("메모 저장 실패");
    }
    revalidatePath("/admin/students");
}

export async function updateStudent(id: string, data: {
    name: string;
    birthDate: string;
    gender?: string | null;
    parentName: string;
    parentPhone?: string | null;
    // 새 필드: 학생 추가 정보
    phone?: string | null;
    school?: string | null;
    grade?: string | null;
    address?: string | null;
    enrollDate?: string | null;
}) {
    await requireAdmin();
    try {
        // 원생 정보 업데이트: 새 필드(phone, school, grade, address, enrollDate) 포함
        await prisma.$executeRawUnsafe(
            `UPDATE "Student" SET name = $1, "birthDate" = $2::timestamp, gender = $3,
                    phone = $5, school = $6, grade = $7, address = $8, "enrollDate" = $9::timestamp,
                    "updatedAt" = NOW()
             WHERE id = $4`,
            data.name, data.birthDate, data.gender || null, id,
            data.phone || null, data.school || null, data.grade || null,
            data.address || null, data.enrollDate || null,
        );
        // 학부모 정보도 업데이트
        const student = await prisma.$queryRawUnsafe<any[]>(
            `SELECT "parentId" FROM "Student" WHERE id = $1`, id
        );
        if (student[0]) {
            await prisma.$executeRawUnsafe(
                `UPDATE "User" SET name = $1, phone = $2, "updatedAt" = NOW() WHERE id = $3`,
                data.parentName, data.parentPhone || null, student[0].parentId ?? student[0].parentid,
            );
        }
    } catch (e) {
        console.error("Failed to update student:", e);
        throw new Error("원생 수정 실패");
    }
    revalidatePath("/admin/students");
    revalidatePath("/admin");
}

export async function deleteStudent(id: string) {
    await requireAdmin();
    try {
        await prisma.$executeRawUnsafe(`DELETE FROM "Attendance" WHERE "studentId" = $1`, id);
        await prisma.$executeRawUnsafe(`DELETE FROM "Payment" WHERE "studentId" = $1`, id);
        await prisma.$executeRawUnsafe(`DELETE FROM "Enrollment" WHERE "studentId" = $1`, id);
        await prisma.$executeRawUnsafe(`DELETE FROM "Student" WHERE id = $1`, id);
    } catch (e) {
        console.error("Failed to delete student:", e);
        throw new Error("원생 삭제 실패");
    }
    revalidatePath("/admin/students");
    revalidatePath("/admin");
}

// ── 수강 등록 관리 ────────────────────────────────────────────────────────────
export async function enrollStudent(studentId: string, classId: string) {
    await requireAdmin();
    try {
        await prisma.$executeRawUnsafe(
            `INSERT INTO "Enrollment" (id, "studentId", "classId", status, "createdAt", "updatedAt")
             VALUES (gen_random_uuid()::text, $1, $2, 'ACTIVE', NOW(), NOW())
             ON CONFLICT ("studentId", "classId") DO UPDATE SET status = 'ACTIVE', "updatedAt" = NOW()`,
            studentId, classId,
        );
    } catch (e) {
        console.error("Failed to enroll student:", e);
        throw new Error("수강 등록 실패");
    }
    revalidatePath("/admin/students");
    revalidatePath("/admin/classes");
}

export async function updateEnrollmentStatus(enrollmentId: string, status: string) {
    await requireAdmin();
    try {
        await prisma.$executeRawUnsafe(
            `UPDATE "Enrollment" SET status = $1, "updatedAt" = NOW() WHERE id = $2`,
            status, enrollmentId,
        );
    } catch (e) {
        console.error("Failed to update enrollment:", e);
        throw new Error("수강 상태 변경 실패");
    }
    revalidatePath("/admin/students");
    revalidatePath("/admin/classes");
}

export async function deleteEnrollment(enrollmentId: string) {
    await requireAdmin();
    try {
        await prisma.$executeRawUnsafe(`DELETE FROM "Enrollment" WHERE id = $1`, enrollmentId);
    } catch (e) {
        console.error("Failed to delete enrollment:", e);
        throw new Error("수강 취소 실패");
    }
    revalidatePath("/admin/students");
    revalidatePath("/admin/classes");
}

// ── 출결 관리 ──────────────────────────────────────────────────────────────────
export async function saveAttendance(classId: string, date: string, records: { studentId: string; status: string }[]) {
    await requireAdmin();
    try {
        // 세션 생성 또는 조회
        const existing = await prisma.$queryRawUnsafe<any[]>(
            `SELECT id FROM "Session" WHERE "classId" = $1 AND date::date = $2::date LIMIT 1`,
            classId, date
        );
        let sessionId: string;
        if (existing.length > 0) {
            sessionId = existing[0].id;
        } else {
            const rows = await prisma.$queryRawUnsafe<any[]>(
                `INSERT INTO "Session" (id, "classId", date, "createdAt", "updatedAt")
                 VALUES (gen_random_uuid()::text, $1, $2::timestamp, NOW(), NOW())
                 RETURNING id`,
                classId, date
            );
            sessionId = rows[0].id;
        }

        // 각 학생 출석 기록 upsert
        for (const rec of records) {
            await prisma.$executeRawUnsafe(
                `INSERT INTO "Attendance" (id, "sessionId", "studentId", status, "createdAt", "updatedAt")
                 VALUES (gen_random_uuid()::text, $1, $2, $3, NOW(), NOW())
                 ON CONFLICT ("sessionId", "studentId") DO UPDATE SET status = $3, "updatedAt" = NOW()`,
                sessionId, rec.studentId, rec.status
            );
        }
        // 출결 완료 알림 → 학부모에게 전송
        const studentIds = records.map(r => r.studentId);
        const dateStr = new Date(date).toLocaleDateString("ko-KR", { month: "long", day: "numeric" });
        await notifyParentsOfStudents(
            studentIds,
            "ATTENDANCE",
            "출결 확인",
            `${dateStr} 출결이 기록되었습니다.`,
            "/mypage",
        );
    } catch (e) {
        console.error("Failed to save attendance:", e);
        throw new Error("출결 저장 실패");
    }
    revalidatePath("/admin/attendance");
    revalidatePath("/mypage");
}

// ── 수납 관리 ──────────────────────────────────────────────────────────────────
export async function createPayment(data: {
    studentId: string;
    amount: number;
    dueDate: string;
    status?: string;
}) {
    await requireAdmin();
    try {
        await prisma.$executeRawUnsafe(
            `INSERT INTO "Payment" (id, "studentId", amount, status, "dueDate", "createdAt", "updatedAt")
             VALUES (gen_random_uuid()::text, $1, $2, $3, $4::timestamp, NOW(), NOW())`,
            data.studentId, data.amount, data.status || "PENDING", data.dueDate,
        );

        // 수납 안내 알림 → 해당 학부모
        const amountStr = data.amount.toLocaleString("ko-KR");
        await notifyParentsOfStudents(
            [data.studentId],
            "PAYMENT",
            "수납 안내",
            `${amountStr}원 수납 요청이 등록되었습니다.`,
            "/mypage",
        );
    } catch (e) {
        console.error("Failed to create payment:", e);
        throw new Error("수납 기록 생성 실패");
    }
    revalidatePath("/admin/finance");
    revalidatePath("/mypage");
}

export async function updatePaymentStatus(id: string, status: string) {
    await requireAdmin();
    try {
        const paidDate = status === "PAID" ? ", \"paidDate\" = NOW()" : "";
        await prisma.$executeRawUnsafe(
            `UPDATE "Payment" SET status = $1${paidDate}, "updatedAt" = NOW() WHERE id = $2`,
            status, id,
        );
    } catch (e) {
        console.error("Failed to update payment:", e);
        throw new Error("수납 상태 변경 실패");
    }
    revalidatePath("/admin/finance");
}

export async function deletePayment(id: string) {
    await requireAdmin();
    try {
        await prisma.$executeRawUnsafe(`DELETE FROM "Payment" WHERE id = $1`, id);
    } catch (e) {
        console.error("Failed to delete payment:", e);
        throw new Error("수납 기록 삭제 실패");
    }
    revalidatePath("/admin/finance");
}

// ── 갤러리 관리 ──────────────────────────────────────────────────────────────
export async function createGalleryPost(data: {
    classId?: string | null;
    title?: string | null;
    caption?: string | null;
    mediaJSON: string;
    isPublic?: boolean;
}) {
    await requireAdmin();
    try {
        await prisma.$executeRawUnsafe(
            `INSERT INTO "GalleryPost" (id, "classId", title, caption, "mediaJSON", "isPublic", "createdAt", "updatedAt")
             VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, NOW(), NOW())`,
            data.classId || null,
            data.title || null,
            data.caption || null,
            data.mediaJSON,
            data.isPublic !== false,
        );
    } catch (e) {
        console.error("Failed to create gallery post:", e);
        throw new Error("갤러리 게시물 생성 실패");
    }
    revalidatePath("/admin/gallery");
    revalidatePath("/gallery");
    revalidatePath("/mypage");
    revalidatePath("/");
}

export async function updateGalleryPost(id: string, data: {
    classId?: string | null;
    title?: string | null;
    caption?: string | null;
    mediaJSON?: string;
    isPublic?: boolean;
}) {
    await requireAdmin();
    try {
        await prisma.$executeRawUnsafe(
            `UPDATE "GalleryPost" SET "classId" = $1, title = $2, caption = $3,
             "mediaJSON" = $4, "isPublic" = $5, "updatedAt" = NOW() WHERE id = $6`,
            data.classId || null,
            data.title || null,
            data.caption || null,
            data.mediaJSON || "[]",
            data.isPublic !== false,
            id,
        );
    } catch (e) {
        console.error("Failed to update gallery post:", e);
        throw new Error("갤러리 게시물 수정 실패");
    }
    revalidatePath("/admin/gallery");
    revalidatePath("/gallery");
    revalidatePath("/mypage");
    revalidatePath("/");
}

export async function deleteGalleryPost(id: string) {
    await requireAdmin();
    try {
        await prisma.$executeRawUnsafe(`DELETE FROM "GalleryPost" WHERE id = $1`, id);
    } catch (e) {
        console.error("Failed to delete gallery post:", e);
        throw new Error("갤러리 게시물 삭제 실패");
    }
    revalidatePath("/admin/gallery");
    revalidatePath("/gallery");
    revalidatePath("/mypage");
    revalidatePath("/");
}

// ── 공지사항 관리 ────────────────────────────────────────────────────────────
export async function createNotice(data: {
    title: string;
    content: string;
    targetType?: string;
    targetClassIds?: string | null;
    attachmentsJSON?: string | null;
    isPinned?: boolean;
}) {
    await requireAdmin();
    try {
        await prisma.$executeRawUnsafe(
            `INSERT INTO "Notice" (id, title, content, "targetType", "targetClassIds", "attachmentsJSON", "isPinned", "createdAt", "updatedAt")
             VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, NOW(), NOW())`,
            data.title,
            data.content,
            data.targetType || "ALL",
            data.targetClassIds || null,
            data.attachmentsJSON || null,
            data.isPinned || false,
        );
        // 공지 작성 알림 → 모든 학부모에게
        await notifyAllParents(
            "NOTICE",
            "새 공지사항",
            data.title,
            "/notices",
        );
    } catch (e) {
        console.error("Failed to create notice:", e);
        throw new Error("공지사항 생성 실패");
    }
    revalidatePath("/admin/notices");
    revalidatePath("/notices");
    revalidatePath("/mypage");
    revalidatePath("/");
}

export async function updateNotice(id: string, data: {
    title: string;
    content: string;
    targetType?: string;
    targetClassIds?: string | null;
    attachmentsJSON?: string | null;
    isPinned?: boolean;
}) {
    await requireAdmin();
    try {
        await prisma.$executeRawUnsafe(
            `UPDATE "Notice" SET title = $1, content = $2, "targetType" = $3,
             "targetClassIds" = $4, "attachmentsJSON" = $5, "isPinned" = $6, "updatedAt" = NOW()
             WHERE id = $7`,
            data.title,
            data.content,
            data.targetType || "ALL",
            data.targetClassIds || null,
            data.attachmentsJSON || null,
            data.isPinned || false,
            id,
        );
    } catch (e) {
        console.error("Failed to update notice:", e);
        throw new Error("공지사항 수정 실패");
    }
    revalidatePath("/admin/notices");
    revalidatePath("/notices");
    revalidatePath("/mypage");
    revalidatePath("/");
}

export async function deleteNotice(id: string) {
    await requireAdmin();
    try {
        await prisma.$executeRawUnsafe(`DELETE FROM "Notice" WHERE id = $1`, id);
    } catch (e) {
        console.error("Failed to delete notice:", e);
        throw new Error("공지사항 삭제 실패");
    }
    revalidatePath("/admin/notices");
    revalidatePath("/notices");
    revalidatePath("/mypage");
    revalidatePath("/");
}

// ── 알림 시스템 ──────────────────────────────────────────────────────────────

// 알림 생성 (내부 헬퍼 — 다른 액션에서 호출)
// DB에 인앱 알림 저장 + 푸시 알림도 동시 발송
async function createNotificationRecord(data: {
    userId: string;
    type: string;      // ATTENDANCE, NOTICE, PAYMENT
    title: string;
    message: string;
    linkUrl?: string;
}) {
    try {
        // 1. DB에 인앱 알림 저장
        await prisma.$executeRawUnsafe(
            `INSERT INTO "Notification" (id, "userId", type, title, message, "linkUrl", "isRead", "createdAt")
             VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, false, NOW())`,
            data.userId, data.type, data.title, data.message, data.linkUrl || null,
        );
        // 2. 푸시 알림 발송 (실패해도 무시)
        sendPushToUser(data.userId, {
            title: data.title,
            body: data.message,
            url: data.linkUrl || "/mypage",
            tag: data.type,
        }).catch(() => {});
    } catch (e) {
        console.error("Failed to create notification:", e);
    }
}

// 특정 학생들의 학부모에게 일괄 알림
async function notifyParentsOfStudents(studentIds: string[], type: string, title: string, message: string, linkUrl?: string) {
    try {
        if (studentIds.length === 0) return;
        const placeholders = studentIds.map((_, i) => `$${i + 1}`).join(",");
        const parents = await prisma.$queryRawUnsafe<any[]>(
            `SELECT DISTINCT "parentId" FROM "Student" WHERE id IN (${placeholders})`,
            ...studentIds,
        );
        for (const p of parents) {
            const parentId = p.parentId ?? p.parentid;
            if (parentId) {
                await createNotificationRecord({ userId: parentId, type, title, message, linkUrl });
            }
        }
    } catch (e) {
        console.error("Failed to notify parents:", e);
    }
}

// 모든 학부모에게 알림 (공지사항 등)
async function notifyAllParents(type: string, title: string, message: string, linkUrl?: string) {
    try {
        const parents = await prisma.$queryRawUnsafe<any[]>(
            `SELECT id FROM "User" WHERE role = 'PARENT'`
        );
        for (const p of parents) {
            await createNotificationRecord({ userId: p.id, type, title, message, linkUrl });
        }
    } catch (e) {
        console.error("Failed to notify all parents:", e);
    }
}

// 알림 읽음 처리
export async function markNotificationRead(id: string) {
    await requireAdmin();
    try {
        await prisma.$executeRawUnsafe(
            `UPDATE "Notification" SET "isRead" = true WHERE id = $1`, id
        );
    } catch (e) {
        console.error("Failed to mark notification read:", e);
        throw new Error("알림 읽음 처리 실패");
    }
    revalidatePath("/mypage");
}

// 모든 알림 읽음 처리
export async function markAllNotificationsRead(userId: string) {
    await requireAdmin();
    try {
        await prisma.$executeRawUnsafe(
            `UPDATE "Notification" SET "isRead" = true WHERE "userId" = $1 AND "isRead" = false`,
            userId,
        );
    } catch (e) {
        console.error("Failed to mark all notifications read:", e);
        throw new Error("알림 전체 읽음 처리 실패");
    }
    revalidatePath("/mypage");
}

// ── 학부모 요청 시스템 ───────────────────────────────────────────────────────

// 학부모가 요청 접수
export async function createParentRequest(data: {
    userId: string;
    studentId: string;
    type: string;
    title: string;
    content: string;
    date?: string | null;
}) {
    await requireAdmin();
    try {
        await prisma.$executeRawUnsafe(
            `INSERT INTO "ParentRequest" (id, "userId", "studentId", type, title, content, date, status, "createdAt", "updatedAt")
             VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6::timestamptz, 'PENDING', NOW(), NOW())`,
            data.userId, data.studentId, data.type, data.title, data.content, data.date || null,
        );

        // 관리자(ADMIN)에게 알림
        const admins = await prisma.$queryRawUnsafe<any[]>(
            `SELECT id FROM "User" WHERE role = 'ADMIN'`
        );
        // 해당 원생 이름 조회
        const studentRows = await prisma.$queryRawUnsafe<any[]>(
            `SELECT name FROM "Student" WHERE id = $1`, data.studentId
        );
        const studentName = studentRows[0]?.name ?? "원생";
        const typeLabels: Record<string, string> = {
            ABSENCE: "결석 신청", SHUTTLE: "셔틀 변경", EARLY_LEAVE: "조퇴 요청", OTHER: "기타 요청"
        };
        const typeLabel = typeLabels[data.type] || data.type;

        for (const admin of admins) {
            await createNotificationRecord({
                userId: admin.id,
                type: "REQUEST",
                title: `${typeLabel} 접수`,
                message: `${studentName} - ${data.title}`,
                linkUrl: "/admin/requests",
            });
        }
    } catch (e) {
        console.error("Failed to create parent request:", e);
        throw new Error("요청 접수 실패");
    }
    revalidatePath("/mypage");
    revalidatePath("/admin");
    revalidatePath("/admin/requests");
}

// 관리자가 요청 상태 변경 + 메모 작성
export async function updateRequestStatus(id: string, status: string, adminNote?: string) {
    await requireAdmin();
    try {
        await prisma.$executeRawUnsafe(
            `UPDATE "ParentRequest" SET status = $1, "adminNote" = $2, "updatedAt" = NOW() WHERE id = $3`,
            status, adminNote || null, id,
        );

        // 학부모에게 처리 결과 알림
        const reqRows = await prisma.$queryRawUnsafe<any[]>(
            `SELECT "userId", title FROM "ParentRequest" WHERE id = $1`, id
        );
        if (reqRows[0]) {
            const parentId = reqRows[0].userId ?? reqRows[0].userid;
            const statusLabels: Record<string, string> = {
                CONFIRMED: "확인됨", COMPLETED: "처리 완료", REJECTED: "반려"
            };
            await createNotificationRecord({
                userId: parentId,
                type: "REQUEST",
                title: "요청 처리 알림",
                message: `"${reqRows[0].title}" → ${statusLabels[status] || status}`,
                linkUrl: "/mypage",
            });
        }
    } catch (e) {
        console.error("Failed to update request status:", e);
        throw new Error("요청 상태 변경 실패");
    }
    revalidatePath("/admin/requests");
    revalidatePath("/admin");
    revalidatePath("/mypage");
}

// 요청 삭제 (관리자)
export async function deleteParentRequest(id: string) {
    await requireAdmin();
    try {
        await prisma.$executeRawUnsafe(`DELETE FROM "ParentRequest" WHERE id = $1`, id);
    } catch (e) {
        console.error("Failed to delete parent request:", e);
        throw new Error("요청 삭제 실패");
    }
    revalidatePath("/admin/requests");
    revalidatePath("/admin");
    revalidatePath("/mypage");
}

// ── 학습 피드백 ──────────────────────────────────────────────────────────────

// 피드백 생성: 코치가 원생에게 학습 피드백을 작성하고, 해당 학부모에게 알림 전송
export async function createFeedback(data: {
    studentId: string;
    coachId: string;
    sessionDate?: string | null;
    category?: string;
    title: string;
    content: string;
    rating?: number | null;
    isPublic?: boolean;
}) {
    await requireAdmin();
    try {
        await prisma.$executeRawUnsafe(
            `INSERT INTO "Feedback" (id, "studentId", "coachId", "sessionDate", category, title, content, rating, "isPublic", "createdAt", "updatedAt")
             VALUES (gen_random_uuid()::text, $1, $2, $3::timestamptz, $4, $5, $6, $7, $8, NOW(), NOW())`,
            data.studentId, data.coachId, data.sessionDate || null,
            data.category || "GENERAL", data.title, data.content,
            data.rating ?? null, data.isPublic !== false,
        );

        // 학부모에게 피드백 알림 전송
        const studentRows = await prisma.$queryRawUnsafe<any[]>(
            `SELECT name, "parentId" FROM "Student" WHERE id = $1`, data.studentId
        );
        if (studentRows[0]) {
            const parentId = studentRows[0].parentId ?? studentRows[0].parentid;
            if (parentId) {
                await createNotificationRecord({
                    userId: parentId,
                    type: "FEEDBACK",
                    title: "학습 피드백",
                    message: `${studentRows[0].name} - ${data.title}`,
                    linkUrl: "/mypage",
                });
            }
        }
    } catch (e) {
        console.error("Failed to create feedback:", e);
        throw new Error("피드백 작성 실패");
    }
    revalidatePath("/admin/feedback");
    revalidatePath("/mypage");
}

// 피드백 수정: 제목/내용/카테고리/평점/공개여부 변경
export async function updateFeedback(id: string, data: {
    category?: string;
    title: string;
    content: string;
    rating?: number | null;
    isPublic?: boolean;
}) {
    await requireAdmin();
    try {
        await prisma.$executeRawUnsafe(
            `UPDATE "Feedback" SET category = $1, title = $2, content = $3, rating = $4, "isPublic" = $5, "updatedAt" = NOW()
             WHERE id = $6`,
            data.category || "GENERAL", data.title, data.content,
            data.rating ?? null, data.isPublic !== false, id,
        );
    } catch (e) {
        console.error("Failed to update feedback:", e);
        throw new Error("피드백 수정 실패");
    }
    revalidatePath("/admin/feedback");
    revalidatePath("/mypage");
}

// 피드백 삭제
export async function deleteFeedback(id: string) {
    await requireAdmin();
    try {
        await prisma.$executeRawUnsafe(`DELETE FROM "Feedback" WHERE id = $1`, id);
    } catch (e) {
        console.error("Failed to delete feedback:", e);
        throw new Error("피드백 삭제 실패");
    }
    revalidatePath("/admin/feedback");
    revalidatePath("/mypage");
}

// ── FAQ 관리 ──────────────────────────────────────────────────────────────────

// FAQ 생성
export async function createFaq(data: {
    question: string;
    answer: string;
    order?: number;
    isPublic?: boolean;
}) {
    await requireAdmin();
    try {
        await prisma.$executeRawUnsafe(
            `INSERT INTO "Faq" (id, question, answer, "order", "isPublic", "createdAt", "updatedAt")
             VALUES (gen_random_uuid()::text, $1, $2, $3, $4, NOW(), NOW())`,
            data.question,
            data.answer,
            data.order ?? 0,
            data.isPublic ?? true,
        );
    } catch (e) {
        console.error("Failed to create FAQ:", e);
        throw new Error("FAQ 생성 실패");
    }
    revalidatePath("/admin/faq");
    revalidatePath("/apply");
}

// FAQ 수정
export async function updateFaq(id: string, data: {
    question: string;
    answer: string;
    order?: number;
    isPublic?: boolean;
}) {
    await requireAdmin();
    try {
        await prisma.$executeRawUnsafe(
            `UPDATE "Faq" SET question = $1, answer = $2, "order" = $3, "isPublic" = $4, "updatedAt" = NOW()
             WHERE id = $5`,
            data.question,
            data.answer,
            data.order ?? 0,
            data.isPublic ?? true,
            id,
        );
    } catch (e) {
        console.error("Failed to update FAQ:", e);
        throw new Error("FAQ 수정 실패");
    }
    revalidatePath("/admin/faq");
    revalidatePath("/apply");
}

// FAQ 삭제
export async function deleteFaq(id: string) {
    await requireAdmin();
    try {
        await prisma.$executeRawUnsafe(`DELETE FROM "Faq" WHERE id = $1`, id);
    } catch (e) {
        console.error("Failed to delete FAQ:", e);
        throw new Error("FAQ 삭제 실패");
    }
    revalidatePath("/admin/faq");
    revalidatePath("/apply");
}

// ── 엑셀 일괄 등록 ──────────────────────────────────────────────────────────

// bulkCreateStudents에서 사용하는 학생 데이터 타입
// ParsedStudent(엑셀 파싱 결과)와 동일한 구조이지만, Server Action은 별도 타입으로 정의
type BulkStudentInput = {
    rowNumber: number;           // 엑셀 원본 행 번호 (에러 보고용)
    name: string;                // 학생명
    birthDate: string | null;    // 생년월일 ISO 문자열
    gender: string | null;       // "MALE" | "FEMALE" | null
    phone: string | null;        // 학생 휴대폰번호
    school: string | null;       // 학교명
    grade: string | null;        // 학년
    address: string | null;      // 주소
    enrollDate: string | null;   // 입회일자 ISO 문자열
    memo: string | null;         // 메모 (관리용이름 + 원본 메모 조합)
    className: string | null;    // 엑셀 C열 클래스명 (예: "6. 토요일 2교시") — 자동 매칭용
    // 보호자1 정보 → User 테이블에 저장
    guardian1Relation: string | null; // 보호자1 관계 (예: "아버지")
    guardian1Phone: string | null;    // 보호자1 전화번호
    // 보호자2,3 정보 → Guardian 테이블에 저장
    guardian2Relation: string | null;
    guardian2Phone: string | null;
    guardian3Relation: string | null;
    guardian3Phone: string | null;
};

// 일괄 등록 결과 타입
type BulkCreateResult = {
    created: number;     // 새로 등록된 학생 수
    skipped: number;     // 중복으로 건너뛴 학생 수
    updated: number;     // 덮어쓰기로 업데이트된 학생 수
    enrolled: number;    // 자동 수강 등록 성공 수
    enrollErrors: string[];  // 수강 등록 실패/매칭 실패 목록
    errors: { rowNumber: number; name: string; reason: string }[];  // 실패한 행 목록
};

/**
 * 엑셀 클래스명 → slotKey 파싱 함수
 *
 * 엑셀 C열 클래스명 형식 예시:
 * - "6. 토요일 2교시" → "Sat-2"
 * - "1. 월요일 7교시" → "Mon-7"
 * - "화요일 8교시(성인)" → "Tue-8"
 * - "목요일 4교시(대표반)" → "Thu-4"
 *
 * 파싱 규칙:
 * 1. 앞의 번호("6. ") 제거
 * 2. 요일명 추출 → dayKey (Mon/Tue/...)
 * 3. "N교시" → N
 * 4. 괄호 안의 내용은 무시
 * 5. 결과: "{dayKey}-{period}"
 */
const DAY_NAME_TO_KEY: Record<string, string> = {
    "월요일": "Mon", "화요일": "Tue", "수요일": "Wed", "목요일": "Thu",
    "금요일": "Fri", "토요일": "Sat", "일요일": "Sun",
};

function parseClassNameToSlotKey(className: string): string | null {
    // 앞의 번호 제거 (예: "6. " → "")
    const cleaned = className.replace(/^\d+\.\s*/, "").trim();

    // 요일명 추출
    let dayKey: string | null = null;
    for (const [korDay, key] of Object.entries(DAY_NAME_TO_KEY)) {
        if (cleaned.includes(korDay)) {
            dayKey = key;
            break;
        }
    }
    if (!dayKey) return null;

    // 교시 추출: "N교시" 패턴에서 N을 가져옴
    const periodMatch = cleaned.match(/(\d+)교시/);
    if (!periodMatch) return null;

    const period = parseInt(periodMatch[1], 10);
    return `${dayKey}-${period}`;
}

/**
 * 엑셀에서 파싱된 학생 데이터를 일괄 등록하는 Server Action
 *
 * 처리 흐름 (학생 1명당):
 * 1. 중복 체크: 이름 + 생년월일이 동일한 Student가 있는지 확인
 * 2. 중복이면: duplicateMode에 따라 건너뛰기 또는 덮어쓰기
 * 3. 보호자1: User 테이블에서 전화번호로 검색, 없으면 새로 생성
 * 4. Student INSERT (또는 UPDATE)
 * 5. 보호자2,3: Guardian 테이블에 INSERT
 * 6. className이 있으면: slotKey로 파싱 → Class 검색 → 자동 수강 등록
 *
 * PgBouncer 호환을 위해 $queryRawUnsafe / $executeRawUnsafe만 사용
 * 트랜잭션 사용 불가이므로, 건별 INSERT + 실패 목록 반환 방식
 */
export async function bulkCreateStudents(
    students: BulkStudentInput[],
    duplicateMode: "skip" | "overwrite" = "skip"
): Promise<BulkCreateResult> {
    await requireAdmin();
    const result: BulkCreateResult = {
        created: 0,
        skipped: 0,
        updated: 0,
        enrolled: 0,
        enrollErrors: [],
        errors: [],
    };

    for (const student of students) {
        try {
            // ── 1. 중복 체크: 이름 + 생년월일이 같은 학생이 있는지 조회 ──
            let existingStudentId: string | null = null;

            if (student.birthDate) {
                // 이름 + 생년월일 기준으로 기존 학생 조회
                const existing = await prisma.$queryRawUnsafe<any[]>(
                    `SELECT id FROM "Student"
                     WHERE name = $1 AND "birthDate"::date = $2::date
                     LIMIT 1`,
                    student.name,
                    student.birthDate,
                );
                if (existing.length > 0) {
                    existingStudentId = existing[0].id;
                }
            }

            // ── 2. 중복 학생 처리 ──
            // finalStudentId: 수강 등록에 사용할 학생 ID (신규든 기존이든 여기에 저장)
            let finalStudentId: string | null = null;

            if (existingStudentId) {
                if (duplicateMode === "skip") {
                    // 건너뛰기: 학생 정보는 안 건드리고, 수강 등록만 시도
                    result.skipped++;
                    finalStudentId = existingStudentId;
                } else {
                    // 덮어쓰기 모드: 기존 학생 정보를 엑셀 데이터로 업데이트
                    await prisma.$executeRawUnsafe(
                        `UPDATE "Student" SET
                            gender = $1, phone = $2, school = $3, grade = $4,
                            address = $5, "enrollDate" = $6::timestamp, memo = $7,
                            "updatedAt" = NOW()
                         WHERE id = $8`,
                        student.gender || null,
                        student.phone || null,
                        student.school || null,
                        student.grade || null,
                        student.address || null,
                        student.enrollDate || null,
                        student.memo || null,
                        existingStudentId,
                    );

                    // 기존 Guardian 삭제 후 재등록 (보호자 정보 갱신)
                    await prisma.$executeRawUnsafe(
                        `DELETE FROM "Guardian" WHERE "studentId" = $1`,
                        existingStudentId,
                    );

                    // 보호자2,3 Guardian 테이블에 INSERT
                    await insertGuardians(existingStudentId, student);

                    // 보호자1 정보도 업데이트 (User 테이블)
                    if (student.guardian1Phone) {
                        const parentRows = await prisma.$queryRawUnsafe<any[]>(
                            `SELECT "parentId" FROM "Student" WHERE id = $1`,
                            existingStudentId,
                        );
                        const parentId = parentRows[0]?.parentId ?? parentRows[0]?.parentid;
                        if (parentId) {
                            await prisma.$executeRawUnsafe(
                                `UPDATE "User" SET
                                    name = $1, phone = $2, "updatedAt" = NOW()
                                 WHERE id = $3`,
                                student.guardian1Relation || "보호자",
                                student.guardian1Phone,
                                parentId,
                            );
                        }
                    }

                    result.updated++;
                    finalStudentId = existingStudentId;
                }
            }

            // 기존 학생이 처리된 경우 (skip 또는 overwrite) 신규 등록은 건너뜀
            if (!finalStudentId) {
            // ── 3. 신규 학생: 보호자1 User 생성 또는 조회 ──
            let parentId: string;

            // 보호자1 이름은 관계명(예: "아버지")을 사용, 없으면 "보호자"
            const parentName = student.guardian1Relation || "보호자";
            // 랠리즈 엑셀에 email이 없으므로 자동 생성 (기존 createStudent 패턴 동일)
            const parentEmail = `parent_${Date.now()}_${student.rowNumber}@stiz.local`;

            if (student.guardian1Phone) {
                // 전화번호로 기존 보호자 검색 (같은 전화번호 = 같은 보호자)
                const existingParent = await prisma.$queryRawUnsafe<any[]>(
                    `SELECT id FROM "User" WHERE phone = $1 AND role = 'PARENT' LIMIT 1`,
                    student.guardian1Phone,
                );

                if (existingParent.length > 0) {
                    parentId = existingParent[0].id;
                } else {
                    // 보호자1 신규 생성
                    const rows = await prisma.$queryRawUnsafe<any[]>(
                        `INSERT INTO "User" (id, email, name, phone, role, "createdAt", "updatedAt")
                         VALUES (gen_random_uuid()::text, $1, $2, $3, 'PARENT', NOW(), NOW())
                         RETURNING id`,
                        parentEmail,
                        parentName,
                        student.guardian1Phone,
                    );
                    parentId = rows[0].id;
                }
            } else {
                // 전화번호 없으면 무조건 새 User 생성
                const rows = await prisma.$queryRawUnsafe<any[]>(
                    `INSERT INTO "User" (id, email, name, phone, role, "createdAt", "updatedAt")
                     VALUES (gen_random_uuid()::text, $1, $2, $3, 'PARENT', NOW(), NOW())
                     RETURNING id`,
                    parentEmail,
                    parentName,
                    null,
                );
                parentId = rows[0].id;
            }

            // ── 4. Student INSERT ──
            // 생년월일이 없으면 기본값(2000-01-01) 사용 — birthDate는 NOT NULL 컬럼
            const birthDateValue = student.birthDate || "2000-01-01T00:00:00.000Z";

            const studentRows = await prisma.$queryRawUnsafe<any[]>(
                `INSERT INTO "Student" (id, name, "birthDate", gender, "parentId",
                    phone, school, grade, address, "enrollDate", memo,
                    "createdAt", "updatedAt")
                 VALUES (gen_random_uuid()::text, $1, $2::timestamp, $3, $4,
                    $5, $6, $7, $8, $9::timestamp, $10,
                    NOW(), NOW())
                 RETURNING id`,
                student.name,
                birthDateValue,
                student.gender || null,
                parentId,
                student.phone || null,
                student.school || null,
                student.grade || null,
                student.address || null,
                student.enrollDate || null,
                student.memo || null,
            );

            const newStudentId = studentRows[0].id;

            // ── 5. 보호자1도 Guardian 테이블에 기록 (isPrimary = true) ──
            // 보호자1은 User에도 있고 Guardian에도 있음 (이중 저장)
            // 이유: Guardian 테이블에서 모든 보호자를 일괄 조회할 수 있도록
            if (student.guardian1Phone || student.guardian1Relation) {
                await prisma.$executeRawUnsafe(
                    `INSERT INTO "Guardian" (id, "studentId", relation, name, phone, "isPrimary", "createdAt", "updatedAt")
                     VALUES (gen_random_uuid()::text, $1, $2, $3, $4, true, NOW(), NOW())`,
                    newStudentId,
                    student.guardian1Relation || "보호자",
                    student.guardian1Relation || "보호자",
                    student.guardian1Phone || null,
                );
            }

            // ── 6. 보호자2,3 Guardian 테이블에 INSERT ──
            await insertGuardians(newStudentId, student);

            result.created++;
            finalStudentId = newStudentId;
            }

            // ── 7. 엑셀 클래스명으로 자동 수강 등록 ──
            // className이 있고, 학생 ID가 확보된 경우에만 실행
            if (student.className && finalStudentId) {
                try {
                    const slotKey = parseClassNameToSlotKey(student.className);
                    if (slotKey) {
                        // slotKey로 Class 검색
                        const classRows = await prisma.$queryRawUnsafe<any[]>(
                            `SELECT id FROM "Class" WHERE "slotKey" = $1 LIMIT 1`,
                            slotKey,
                        );
                        if (classRows.length > 0) {
                            // Class를 찾았으면 수강 등록 (ON CONFLICT로 중복 등록 방지)
                            await prisma.$executeRawUnsafe(
                                `INSERT INTO "Enrollment" (id, "studentId", "classId", status, "createdAt", "updatedAt")
                                 VALUES (gen_random_uuid()::text, $1, $2, 'ACTIVE', NOW(), NOW())
                                 ON CONFLICT ("studentId", "classId") DO UPDATE SET status = 'ACTIVE', "updatedAt" = NOW()`,
                                finalStudentId,
                                classRows[0].id,
                            );
                            result.enrolled++;
                        } else {
                            // Class를 못 찾으면 경고 로그에 추가 (에러는 아님)
                            result.enrollErrors.push(
                                `${student.name} (행 ${student.rowNumber}): "${student.className}" → slotKey "${slotKey}" 매칭 Class 없음`
                            );
                        }
                    } else {
                        // slotKey 파싱 실패
                        result.enrollErrors.push(
                            `${student.name} (행 ${student.rowNumber}): "${student.className}" 클래스명 파싱 실패`
                        );
                    }
                } catch (enrollErr) {
                    // 수강 등록 오류: 학생 등록은 성공했으므로 경고만 기록
                    result.enrollErrors.push(
                        `${student.name} (행 ${student.rowNumber}): 수강 등록 오류 — ${enrollErr instanceof Error ? enrollErr.message : "알 수 없는 오류"}`
                    );
                }
            }
        } catch (e) {
            // 건별 오류: 해당 학생만 실패 기록하고 나머지 계속 진행
            console.error(`[bulkCreate] 행 ${student.rowNumber} (${student.name}) 실패:`, e);
            result.errors.push({
                rowNumber: student.rowNumber,
                name: student.name,
                reason: e instanceof Error ? e.message : "알 수 없는 오류",
            });
        }
    }

    // 학생 목록 페이지 캐시 무효화
    revalidatePath("/admin/students");
    revalidatePath("/admin");

    return result;
}

/**
 * 보호자2, 3 정보를 Guardian 테이블에 INSERT하는 헬퍼 함수
 * - isPrimary = false (보호자2,3은 보조 보호자)
 * - 관계명 또는 전화번호가 하나라도 있으면 저장
 */
async function insertGuardians(studentId: string, student: BulkStudentInput) {
    // 보호자2
    if (student.guardian2Relation || student.guardian2Phone) {
        await prisma.$executeRawUnsafe(
            `INSERT INTO "Guardian" (id, "studentId", relation, name, phone, "isPrimary", "createdAt", "updatedAt")
             VALUES (gen_random_uuid()::text, $1, $2, $3, $4, false, NOW(), NOW())`,
            studentId,
            student.guardian2Relation || "보호자2",
            student.guardian2Relation || "보호자2",
            student.guardian2Phone || null,
        );
    }

    // 보호자3
    if (student.guardian3Relation || student.guardian3Phone) {
        await prisma.$executeRawUnsafe(
            `INSERT INTO "Guardian" (id, "studentId", relation, name, phone, "isPrimary", "createdAt", "updatedAt")
             VALUES (gen_random_uuid()::text, $1, $2, $3, $4, false, NOW(), NOW())`,
            studentId,
            student.guardian3Relation || "보호자3",
            student.guardian3Relation || "보호자3",
            student.guardian3Phone || null,
        );
    }
}

// ── 수업 기록 저장 (세션 + 출석 일괄) ─────────────────────────────────────────

/**
 * saveSessionLog: 수업 기록(Session)과 출석(Attendance)을 한번에 저장하는 통합 Server Action
 *
 * - 기존 saveAttendance는 출석만 저장하지만, 이 함수는 수업 주제/내용/사진/코치 + 출석을 함께 저장
 * - Session이 이미 있으면 UPDATE, 없으면 INSERT (classId + date 기준)
 * - attendances가 전달되면 각 학생에 대해 Attendance UPSERT
 * - PgBouncer 호환을 위해 $queryRawUnsafe / $executeRawUnsafe만 사용
 */
export async function saveSessionLog(data: {
    classId: string;
    date: string;           // ISO 날짜 문자열
    topic?: string;         // 수업 주제
    content?: string;       // 수업 상세 내용
    photosJSON?: string;    // 사진 URL 배열 JSON 문자열 (클라이언트에서 JSON.stringify 완료)
    coachId?: string;       // 담당 코치 ID
    attendances?: Array<{   // 출석 데이터 (선택)
        studentId: string;
        status: string;     // PRESENT, ABSENT, LATE
    }>;
}) {
    await requireAdmin();
    try {
        // ── 1. 해당 classId + date로 기존 Session 검색 ──
        const existing = await prisma.$queryRawUnsafe<any[]>(
            `SELECT id FROM "Session" WHERE "classId" = $1 AND date::date = $2::date LIMIT 1`,
            data.classId, data.date
        );

        let sessionId: string;

        if (existing.length > 0) {
            // ── 2. 기존 Session이 있으면 UPDATE ──
            sessionId = existing[0].id;
            await prisma.$executeRawUnsafe(
                `UPDATE "Session" SET
                    topic = $1, content = $2, "photosJSON" = $3, "coachId" = $4, "updatedAt" = NOW()
                 WHERE id = $5`,
                data.topic || null,
                data.content || null,
                data.photosJSON || null,
                data.coachId || null,
                sessionId,
            );
        } else {
            // ── 3. 없으면 새 Session INSERT ──
            const rows = await prisma.$queryRawUnsafe<any[]>(
                `INSERT INTO "Session" (id, "classId", date, topic, content, "photosJSON", "coachId", "createdAt", "updatedAt")
                 VALUES (gen_random_uuid()::text, $1, $2::timestamp, $3, $4, $5, $6, NOW(), NOW())
                 RETURNING id`,
                data.classId,
                data.date,
                data.topic || null,
                data.content || null,
                data.photosJSON || null,
                data.coachId || null,
            );
            sessionId = rows[0].id;
        }

        // ── 4. 출석 데이터가 있으면 각 학생별 Attendance UPSERT ──
        // 기존 saveAttendance와 동일한 ON CONFLICT 패턴 사용
        if (data.attendances && data.attendances.length > 0) {
            for (const rec of data.attendances) {
                await prisma.$executeRawUnsafe(
                    `INSERT INTO "Attendance" (id, "sessionId", "studentId", status, "createdAt", "updatedAt")
                     VALUES (gen_random_uuid()::text, $1, $2, $3, NOW(), NOW())
                     ON CONFLICT ("sessionId", "studentId") DO UPDATE SET status = $3, "updatedAt" = NOW()`,
                    sessionId, rec.studentId, rec.status
                );
            }
        }

        // ── 5. 캐시 무효화 ──
        revalidatePath("/admin/classes");

        return { success: true, sessionId };
    } catch (e) {
        console.error("Failed to save session log:", e);
        throw new Error("수업 기록 저장 실패");
    }
}

// ── 시간표 슬롯 → Class 동기화 ────────────────────────────────────────────────

// 요일 키를 한글 라벨로 변환하는 매핑
const DAY_KEY_TO_LABEL: Record<string, string> = {
    Mon: "월요일", Tue: "화요일", Wed: "수요일", Thu: "목요일",
    Fri: "금요일", Sat: "토요일", Sun: "일요일",
};

/**
 * 시간표 슬롯(SheetSlotCache + Override + CustomSlot)을 Class 테이블로 동기화하는 Server Action
 *
 * 처리 흐름:
 * 1. SheetSlotCache에서 기본 슬롯 가져오기
 * 2. ClassSlotOverride로 오버라이드 적용 (isHidden 제외)
 * 3. CustomClassSlot 추가
 * 4. 각 MergedSlot에 대해 Class 테이블에 UPSERT (slotKey 기준)
 * 5. programId가 없는 슬롯은 건너뜀 (Class.programId는 NOT NULL)
 *
 * $queryRawUnsafe / $executeRawUnsafe만 사용 (PgBouncer 트랜잭션 모드 호환)
 */
type SyncResult = {
    success: boolean;
    created: number;      // 새로 만든 Class 수
    updated: number;      // 업데이트한 Class 수
    skipped: number;      // programId 없어서 건너뛴 수
    totalSlots: number;   // 전체 슬롯 수
    classes: { slotKey: string; name: string; dayOfWeek: string; programName: string }[];  // 동기화된 Class 목록
    oldClasses: { id: string; name: string; slotKey: string | null }[];  // slotKey 없는 기존 수동 Class
    errors: string[];
};

export async function syncScheduleToClasses(): Promise<SyncResult> {
    await requireAdmin();
    const result: SyncResult = {
        success: false,
        created: 0,
        updated: 0,
        skipped: 0,
        totalSlots: 0,
        classes: [],
        oldClasses: [],
        errors: [],
    };

    try {
        // ── 1. 시간표 데이터 수집 ──

        // SheetSlotCache에서 기본 슬롯 목록 가져오기
        const cacheRows = await prisma.$queryRawUnsafe<any[]>(
            `SELECT "slotsJson" FROM "SheetSlotCache" WHERE id = 'singleton' LIMIT 1`
        );
        const rawSlots: SheetClassSlot[] = cacheRows[0]
            ? JSON.parse(cacheRows[0].slotsJson ?? cacheRows[0].slotsjson ?? "[]")
            : [];

        // ClassSlotOverride 목록 가져오기
        const overrides = await prisma.$queryRawUnsafe<any[]>(
            `SELECT cso.id, cso."slotKey", cso.label, cso.note, cso."isHidden", cso.capacity,
                    cso."startTimeOverride", cso."endTimeOverride", cso."coachId", cso."programId"
             FROM "ClassSlotOverride" cso`
        );
        const overrideMap = Object.fromEntries(
            overrides.map((o: any) => [o.slotKey ?? o.slotkey, o])
        );

        // CustomClassSlot 목록 가져오기
        const customSlots = await prisma.$queryRawUnsafe<any[]>(
            `SELECT cs.id, cs."dayKey", cs."startTime", cs."endTime", cs.label,
                    cs."gradeRange", cs.enrolled, cs.capacity, cs.note, cs."isHidden",
                    cs."coachId", cs."programId"
             FROM "CustomClassSlot" cs`
        );

        // ── 2. MergedSlot 생성 (시간표 페이지와 동일한 로직) ──

        // 각 MergedSlot의 핵심 정보만 담는 내부 타입
        type SlotInfo = {
            slotKey: string;
            dayKey: string;
            label: string;
            startTime: string;
            endTime: string;
            capacity: number;
            programId: string | null;
        };

        const mergedSlots: SlotInfo[] = [];

        // SheetSlotCache 기본 슬롯에 Override 적용
        for (const s of rawSlots) {
            const ov = overrideMap[s.slotKey];
            // isHidden인 슬롯은 제외
            if (ov && (ov.isHidden ?? ov.ishidden)) continue;

            mergedSlots.push({
                slotKey: s.slotKey,
                dayKey: s.dayKey,
                label: ov?.label || `${DAY_KEY_TO_LABEL[s.dayKey] || s.dayKey} ${s.period}교시`,
                startTime: (ov?.startTimeOverride ?? ov?.starttimeoverride) || s.startTime,
                endTime: (ov?.endTimeOverride ?? ov?.endtimeoverride) || s.endTime,
                capacity: Number(ov?.capacity ?? 12),
                programId: (ov?.programId ?? ov?.programid) || null,
            });
        }

        // CustomClassSlot 추가 (isHidden 제외)
        for (const cs of customSlots) {
            if (cs.isHidden ?? cs.ishidden) continue;
            mergedSlots.push({
                slotKey: `custom-${cs.id}`,
                dayKey: cs.dayKey ?? cs.daykey,
                label: cs.label,
                startTime: cs.startTime ?? cs.starttime,
                endTime: cs.endTime ?? cs.endtime,
                capacity: Number(cs.capacity ?? 12),
                programId: (cs.programId ?? cs.programid) || null,
            });
        }

        result.totalSlots = mergedSlots.length;

        // ── 3. Class 테이블과 동기화 ──

        // 프로그램 이름 조회용 캐시 (결과에 programName 포함하기 위해)
        const programs = await prisma.$queryRawUnsafe<any[]>(
            `SELECT id, name FROM "Program"`
        );
        const programNameMap = Object.fromEntries(
            programs.map((p: any) => [p.id, p.name])
        );

        for (const slot of mergedSlots) {
            try {
                // programId가 없는 슬롯은 skip (Class.programId는 NOT NULL)
                if (!slot.programId) {
                    result.skipped++;
                    continue;
                }

                // programId가 유효한지 확인 (FK 제약 위반 방지)
                if (!programNameMap[slot.programId]) {
                    result.skipped++;
                    result.errors.push(`슬롯 "${slot.label}" (${slot.slotKey}): 프로그램 ID "${slot.programId}"가 존재하지 않음`);
                    continue;
                }

                // slotKey로 기존 Class 검색
                const existing = await prisma.$queryRawUnsafe<any[]>(
                    `SELECT id FROM "Class" WHERE "slotKey" = $1 LIMIT 1`,
                    slot.slotKey,
                );

                if (existing.length > 0) {
                    // 기존 Class가 있으면 UPDATE
                    await prisma.$executeRawUnsafe(
                        `UPDATE "Class" SET
                            name = $1, "dayOfWeek" = $2, "startTime" = $3, "endTime" = $4,
                            capacity = $5, "programId" = $6, "updatedAt" = NOW()
                         WHERE "slotKey" = $7`,
                        slot.label,
                        slot.dayKey,
                        slot.startTime,
                        slot.endTime,
                        slot.capacity,
                        slot.programId,
                        slot.slotKey,
                    );
                    result.updated++;
                } else {
                    // 새 Class INSERT
                    await prisma.$executeRawUnsafe(
                        `INSERT INTO "Class" (id, "programId", name, "dayOfWeek", "startTime", "endTime", capacity, "slotKey", "createdAt", "updatedAt")
                         VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
                        slot.programId,
                        slot.label,
                        slot.dayKey,
                        slot.startTime,
                        slot.endTime,
                        slot.capacity,
                        slot.slotKey,
                    );
                    result.created++;
                }

                result.classes.push({
                    slotKey: slot.slotKey,
                    name: slot.label,
                    dayOfWeek: slot.dayKey,
                    programName: programNameMap[slot.programId] || "알 수 없음",
                });
            } catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                result.errors.push(`슬롯 "${slot.label}" (${slot.slotKey}) 동기화 실패: ${msg}`);
            }
        }

        // ── 4. slotKey가 없는 기존 수동 Class 목록 조회 ──
        const oldClasses = await prisma.$queryRawUnsafe<any[]>(
            `SELECT id, name, "slotKey" FROM "Class" WHERE "slotKey" IS NULL`
        );
        result.oldClasses = oldClasses.map((c: any) => ({
            id: c.id,
            name: c.name,
            slotKey: c.slotKey ?? c.slotkey ?? null,
        }));

        result.success = true;
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        result.errors.push(`동기화 전체 오류: ${msg}`);
    }

    // ── 5. 캐시 무효화 ──
    revalidatePath("/admin/students");
    revalidatePath("/admin/classes");

    return result;
}

/**
 * 동기화 미리보기: 실행 전에 어떤 Class가 생기고, 어떤 기존 Class가 있는지 확인
 *
 * - newClasses: 동기화하면 새로 생길/업데이트될 Class 목록
 * - oldClasses: slotKey 없는 기존 수동 Class + 각각의 Enrollment 수
 */
export async function getClassSyncPreview(): Promise<{
    newClasses: { slotKey: string; name: string; dayOfWeek: string; startTime: string; endTime: string; programId: string | null; programName: string | null; isNew: boolean }[];
    oldClasses: { id: string; name: string; dayOfWeek: string; enrollmentCount: number }[];
}> {
    await requireAdmin();
    try {
        // 시간표 데이터 수집 (syncScheduleToClasses와 동일 로직)
        const cacheRows = await prisma.$queryRawUnsafe<any[]>(
            `SELECT "slotsJson" FROM "SheetSlotCache" WHERE id = 'singleton' LIMIT 1`
        );
        const rawSlots: SheetClassSlot[] = cacheRows[0]
            ? JSON.parse(cacheRows[0].slotsJson ?? cacheRows[0].slotsjson ?? "[]")
            : [];

        const overrides = await prisma.$queryRawUnsafe<any[]>(
            `SELECT cso."slotKey", cso.label, cso."isHidden", cso.capacity,
                    cso."startTimeOverride", cso."endTimeOverride", cso."programId"
             FROM "ClassSlotOverride" cso`
        );
        const overrideMap = Object.fromEntries(
            overrides.map((o: any) => [o.slotKey ?? o.slotkey, o])
        );

        const customSlots = await prisma.$queryRawUnsafe<any[]>(
            `SELECT cs.id, cs."dayKey", cs."startTime", cs."endTime", cs.label,
                    cs."isHidden", cs.capacity, cs."programId"
             FROM "CustomClassSlot" cs`
        );

        // 프로그램 이름 매핑
        const programs = await prisma.$queryRawUnsafe<any[]>(
            `SELECT id, name FROM "Program"`
        );
        const programNameMap = Object.fromEntries(
            programs.map((p: any) => [p.id, p.name])
        );

        // 기존 Class의 slotKey 목록 조회 (이미 동기화된 것 확인용)
        const existingClasses = await prisma.$queryRawUnsafe<any[]>(
            `SELECT "slotKey" FROM "Class" WHERE "slotKey" IS NOT NULL`
        );
        const existingSlotKeys = new Set(
            existingClasses.map((c: any) => c.slotKey ?? c.slotkey)
        );

        // MergedSlot 생성
        type PreviewSlot = {
            slotKey: string;
            name: string;
            dayOfWeek: string;
            startTime: string;
            endTime: string;
            programId: string | null;
            programName: string | null;
            isNew: boolean;
        };

        const newClasses: PreviewSlot[] = [];

        for (const s of rawSlots) {
            const ov = overrideMap[s.slotKey];
            if (ov && (ov.isHidden ?? ov.ishidden)) continue;

            const programId = (ov?.programId ?? ov?.programid) || null;
            newClasses.push({
                slotKey: s.slotKey,
                name: ov?.label || `${DAY_KEY_TO_LABEL[s.dayKey] || s.dayKey} ${s.period}교시`,
                dayOfWeek: s.dayKey,
                startTime: (ov?.startTimeOverride ?? ov?.starttimeoverride) || s.startTime,
                endTime: (ov?.endTimeOverride ?? ov?.endtimeoverride) || s.endTime,
                programId,
                programName: programId ? (programNameMap[programId] || null) : null,
                isNew: !existingSlotKeys.has(s.slotKey),  // 이미 동기화된 것이면 false
            });
        }

        for (const cs of customSlots) {
            if (cs.isHidden ?? cs.ishidden) continue;
            const slotKey = `custom-${cs.id}`;
            const programId = (cs.programId ?? cs.programid) || null;
            newClasses.push({
                slotKey,
                name: cs.label,
                dayOfWeek: cs.dayKey ?? cs.daykey,
                startTime: cs.startTime ?? cs.starttime,
                endTime: cs.endTime ?? cs.endtime,
                programId,
                programName: programId ? (programNameMap[programId] || null) : null,
                isNew: !existingSlotKeys.has(slotKey),
            });
        }

        // 기존 수동 Class (slotKey 없음) + Enrollment 수
        const oldClasses = await prisma.$queryRawUnsafe<any[]>(
            `SELECT c.id, c.name, c."dayOfWeek",
                    COUNT(e.id)::int AS enrollment_count
             FROM "Class" c
             LEFT JOIN "Enrollment" e ON c.id = e."classId"
             WHERE c."slotKey" IS NULL
             GROUP BY c.id, c.name, c."dayOfWeek"`
        );

        return {
            newClasses,
            oldClasses: oldClasses.map((c: any) => ({
                id: c.id,
                name: c.name,
                dayOfWeek: c.dayOfWeek ?? c.dayofweek,
                enrollmentCount: Number(c.enrollment_count ?? 0),
            })),
        };
    } catch (e) {
        console.error("[getClassSyncPreview] failed:", e);
        return { newClasses: [], oldClasses: [] };
    }
}

