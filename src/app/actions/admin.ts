"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

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
                await prisma.$executeRawUnsafe(`UPDATE "Program" SET "order" = ${i} WHERE id = '${orderedIds[i]}'`);
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
}) {
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
        if (ids.length === 0) return;
        const cases = ids.map((id, index) => `WHEN '${id}' THEN ${index}`).join(" ");
        const inList = ids.map((id) => `'${id}'`).join(", ");
        await prisma.$executeRawUnsafe(
            `UPDATE "Coach" SET "order" = CASE id ${cases} END WHERE id IN (${inList})`
        );
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
    try {
        await prisma.$executeRawUnsafe(
            `INSERT INTO "AnnualEvent" (id, title, date, "endDate", description, category, "createdAt", "updatedAt")
             VALUES (gen_random_uuid()::text, $1, $2::timestamp, $3::timestamp, $4, $5, NOW(), NOW())`,
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
    revalidatePath("/admin/annual");
    revalidatePath("/annual");
}

export async function deleteAnnualEvent(id: string) {
    try {
        await prisma.$executeRawUnsafe(
            `DELETE FROM "AnnualEvent" WHERE id = $1`,
            id,
        );
    } catch (e) {
        console.error("Failed to delete annual event:", e);
        throw new Error("일정 삭제 실패");
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
}) {
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

        // 원생 생성
        await prisma.$executeRawUnsafe(
            `INSERT INTO "Student" (id, name, "birthDate", gender, "parentId", "createdAt", "updatedAt")
             VALUES (gen_random_uuid()::text, $1, $2::timestamp, $3, $4, NOW(), NOW())`,
            data.name, data.birthDate, data.gender || null, parentId,
        );
    } catch (e) {
        console.error("Failed to create student:", e);
        throw new Error("원생 등록 실패");
    }
    revalidatePath("/admin/students");
    revalidatePath("/admin");
}

export async function updateStudent(id: string, data: {
    name: string;
    birthDate: string;
    gender?: string | null;
    parentName: string;
    parentPhone?: string | null;
}) {
    try {
        await prisma.$executeRawUnsafe(
            `UPDATE "Student" SET name = $1, "birthDate" = $2::timestamp, gender = $3, "updatedAt" = NOW()
             WHERE id = $4`,
            data.name, data.birthDate, data.gender || null, id,
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
    } catch (e) {
        console.error("Failed to save attendance:", e);
        throw new Error("출결 저장 실패");
    }
    revalidatePath("/admin/attendance");
}

// ── 수납 관리 ──────────────────────────────────────────────────────────────────
export async function createPayment(data: {
    studentId: string;
    amount: number;
    dueDate: string;
    status?: string;
}) {
    try {
        await prisma.$executeRawUnsafe(
            `INSERT INTO "Payment" (id, "studentId", amount, status, "dueDate", "createdAt", "updatedAt")
             VALUES (gen_random_uuid()::text, $1, $2, $3, $4::timestamp, NOW(), NOW())`,
            data.studentId, data.amount, data.status || "PENDING", data.dueDate,
        );
    } catch (e) {
        console.error("Failed to create payment:", e);
        throw new Error("수납 기록 생성 실패");
    }
    revalidatePath("/admin/finance");
}

export async function updatePaymentStatus(id: string, status: string) {
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
    try {
        await prisma.$executeRawUnsafe(`DELETE FROM "Payment" WHERE id = $1`, id);
    } catch (e) {
        console.error("Failed to delete payment:", e);
        throw new Error("수납 기록 삭제 실패");
    }
    revalidatePath("/admin/finance");
}

