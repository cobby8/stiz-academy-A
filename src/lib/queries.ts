/**
 * 순수 DB 조회 함수들 (mutations 제외)
 * react.cache() 로 감싸 동일 요청 내 중복 DB 호출을 자동 제거 (request-level memoization)
 * "use server" 없음 — 일반 서버 모듈로 import 가능
 */
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import type { SheetClassSlot } from "@/lib/googleSheetsSchedule";

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
        if (rows[0]) {
            const r = rows[0];
            return {
                id: r.id,
                introductionTitle: r.introductionTitle ?? r.introductiontitle ?? null,
                introductionText: r.introductionText ?? r.introductiontext ?? null,
                shuttleInfoText: r.shuttleInfoText ?? r.shuttleinfotext ?? null,
                contactPhone: r.contactPhone ?? r.contactphone ?? null,
                address: r.address ?? null,
                pageDesignJSON: r.pageDesignJSON ?? r.pagedesignjson ?? null,
                googleCalendarIcsUrl: r.googleCalendarIcsUrl ?? r.googlecalendaricsurl ?? null,
                googleSheetsScheduleUrl: r.googleSheetsScheduleUrl ?? r.googlesheetsscheduleurl ?? null,
                classDays: r.classDays ?? r.classdays ?? null,
                siteBodyFont: r.siteBodyFont ?? r.sitebodyfont ?? "system",
                siteHeadingFont: r.siteHeadingFont ?? r.siteheadingfont ?? "system",
                termsOfService: r.termsOfService ?? r.termsofservice ?? null,
                trialTitle: r.trialTitle ?? r.trialtitle ?? "체험수업 안내",
                trialContent: r.trialContent ?? r.trialcontent ?? null,
                trialFormUrl: r.trialFormUrl ?? r.trialformurl ?? null,
                enrollTitle: r.enrollTitle ?? r.enrolltitle ?? "수강신청 안내",
                enrollContent: r.enrollContent ?? r.enrollcontent ?? null,
                enrollFormUrl: r.enrollFormUrl ?? r.enrollformurl ?? null,
                youtubeUrl: r.youtubeUrl ?? r.youtubeurl ?? null,
                philosophyText: r.philosophyText ?? r.philosophytext ?? null,
                facilitiesText: r.facilitiesText ?? r.facilitiestext ?? null,
                facilitiesImagesJSON: r.facilitiesImagesJSON ?? r.facilitiesimagesjson ?? null,
            } as any;
        }
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
    // Use $queryRawUnsafe (simple query protocol) for PgBouncer transaction mode compatibility
    try {
        const rows = await prisma.$queryRawUnsafe<any[]>(
            `SELECT id, name, "targetAge", frequency, "weeklyFrequency", description,
                    price, "order", days, "priceWeek1", "priceWeek2", "priceWeek3",
                    "priceDaily", "shuttleFeeOverride", "createdAt", "updatedAt"
             FROM "Program" ORDER BY "order" ASC, "createdAt" DESC`
        );
        return rows.map((r: any) => ({
            ...r,
            price: Number(r.price ?? 0),
            order: Number(r.order ?? 0),
            priceWeek1: r.priceWeek1 != null ? Number(r.priceWeek1) : null,
            priceWeek2: r.priceWeek2 != null ? Number(r.priceWeek2) : null,
            priceWeek3: r.priceWeek3 != null ? Number(r.priceWeek3) : null,
            priceDaily: r.priceDaily != null ? Number(r.priceDaily) : null,
            shuttleFeeOverride: r.shuttleFeeOverride != null ? Number(r.shuttleFeeOverride) : null,
        }));
    } catch (e) {
        console.error("[getPrograms] failed:", e);
        return [];
    }
});

export const getClasses = cache(async () => {
    try {
        const rows = await prisma.$queryRawUnsafe<any[]>(
            `SELECT c.id, c."programId", c."instructorId", c.name, c."dayOfWeek",
                    c."startTime", c."endTime", c.location, c.capacity,
                    c."createdAt", c."updatedAt",
                    p.id AS p_id, p.name AS p_name
             FROM "Class" c
             LEFT JOIN "Program" p ON c."programId" = p.id
             ORDER BY c."createdAt" DESC`
        );
        return rows.map((r: any) => ({
            id: r.id,
            programId: r.programId ?? r.programid,
            instructorId: r.instructorId ?? r.instructorid ?? null,
            name: r.name,
            dayOfWeek: r.dayOfWeek ?? r.dayofweek,
            startTime: r.startTime ?? r.starttime ?? "",
            endTime: r.endTime ?? r.endtime ?? "",
            location: r.location ?? null,
            capacity: Number(r.capacity ?? 0),
            createdAt: r.createdAt ?? r.createdat,
            updatedAt: r.updatedAt ?? r.updatedat,
            program: r.p_id ? { id: r.p_id, name: r.p_name } : null,
        }));
    } catch (e) {
        console.error("[getClasses] failed:", e);
        return [];
    }
});

/** 원생 목록 조회 (학부모 정보 포함) */
export const getStudents = cache(async () => {
    try {
        const rows = await prisma.$queryRawUnsafe<any[]>(
            `SELECT s.id, s.name, s."birthDate", s.gender, s."parentId",
                    s."createdAt", s."updatedAt",
                    u.name AS parent_name, u.phone AS parent_phone, u.email AS parent_email
             FROM "Student" s
             LEFT JOIN "User" u ON s."parentId" = u.id
             ORDER BY s."createdAt" DESC`
        );
        return rows.map((r: any) => ({
            id: r.id,
            name: r.name,
            birthDate: r.birthDate ?? r.birthdate,
            gender: r.gender ?? null,
            parentId: r.parentId ?? r.parentid,
            createdAt: r.createdAt ?? r.createdat,
            updatedAt: r.updatedAt ?? r.updatedat,
            parent: {
                name: r.parent_name ?? null,
                phone: r.parent_phone ?? null,
                email: r.parent_email ?? null,
            },
        }));
    } catch (e) {
        console.error("[getStudents] failed:", e);
        return [];
    }
});

/** 원생 상세 조회 (수강 내역 포함) */
export const getStudentWithEnrollments = cache(async (id: string) => {
    try {
        // 원생 기본 정보
        const sRows = await prisma.$queryRawUnsafe<any[]>(
            `SELECT s.id, s.name, s."birthDate", s.gender, s."parentId",
                    s."createdAt", s."updatedAt",
                    u.name AS parent_name, u.phone AS parent_phone, u.email AS parent_email
             FROM "Student" s
             LEFT JOIN "User" u ON s."parentId" = u.id
             WHERE s.id = $1`,
            id
        );
        if (!sRows[0]) return null;
        const r = sRows[0];
        // 수강 내역
        const eRows = await prisma.$queryRawUnsafe<any[]>(
            `SELECT e.id, e."classId", e.status, e."createdAt",
                    c.name AS class_name, c."dayOfWeek", c."startTime", c."endTime",
                    p.name AS program_name
             FROM "Enrollment" e
             LEFT JOIN "Class" c ON e."classId" = c.id
             LEFT JOIN "Program" p ON c."programId" = p.id
             WHERE e."studentId" = $1
             ORDER BY e."createdAt" DESC`,
            id
        );
        return {
            id: r.id,
            name: r.name,
            birthDate: r.birthDate ?? r.birthdate,
            gender: r.gender ?? null,
            parentId: r.parentId ?? r.parentid,
            createdAt: r.createdAt ?? r.createdat,
            updatedAt: r.updatedAt ?? r.updatedat,
            parent: {
                name: r.parent_name ?? null,
                phone: r.parent_phone ?? null,
                email: r.parent_email ?? null,
            },
            enrollments: eRows.map((e: any) => ({
                id: e.id,
                classId: e.classId ?? e.classid,
                status: e.status,
                createdAt: e.createdAt ?? e.createdat,
                className: e.class_name,
                dayOfWeek: e.dayOfWeek ?? e.dayofweek,
                startTime: e.startTime ?? e.starttime,
                endTime: e.endTime ?? e.endtime,
                programName: e.program_name,
            })),
        };
    } catch (e) {
        console.error("[getStudentWithEnrollments] failed:", e);
        return null;
    }
});

export const getClassSlotOverrides = cache(async () => {
    try {
        const rows = await prisma.$queryRawUnsafe<any[]>(
            `SELECT
                cso.id, cso."slotKey", cso.label, cso.note, cso."isHidden", cso.capacity,
                cso."startTimeOverride", cso."endTimeOverride",
                cso."coachId", cso."programId", cso."createdAt", cso."updatedAt",
                c.id AS c_id, c.name AS c_name, c.role AS c_role,
                c."imageUrl" AS c_imageurl, c.description AS c_desc, c."order" AS c_order
             FROM "ClassSlotOverride" cso
             LEFT JOIN "Coach" c ON cso."coachId" = c.id
             ORDER BY cso."slotKey" ASC`
        );
        return rows.map((r: any) => ({
            id: r.id,
            slotKey: r.slotKey ?? r.slotkey,
            label: r.label ?? null,
            note: r.note ?? null,
            isHidden: r.isHidden ?? r.ishidden ?? false,
            capacity: Number(r.capacity ?? 12),
            coachId: r.coachId ?? r.coachid ?? null,
            startTimeOverride: r.startTimeOverride ?? r.starttimeoverride ?? null,
            endTimeOverride: r.endTimeOverride ?? r.endtimeoverride ?? null,
            programId: r.programId ?? r.programid ?? null,
            createdAt: r.createdAt ?? r.createdat,
            updatedAt: r.updatedAt ?? r.updatedat,
            coach: r.c_id ? {
                id: r.c_id, name: r.c_name, role: r.c_role,
                imageUrl: r.c_imageurl ?? null, description: r.c_desc ?? null,
                order: Number(r.c_order ?? 0),
                createdAt: new Date(), updatedAt: new Date(), slots: [], customSlots: [],
            } : null,
        }));
    } catch (e) {
        console.error("[getClassSlotOverrides] failed:", e);
        return [];
    }
});

export const getCoaches = cache(async () => {
    try {
        const rows = await prisma.$queryRawUnsafe<any[]>(
            `SELECT id, name, role, description, "imageUrl", "order", "createdAt", "updatedAt"
             FROM "Coach" ORDER BY "order" ASC`
        );
        return rows.map((r: any) => ({ ...r, order: Number(r.order ?? 0) }));
    } catch (e) {
        console.error("[getCoaches] failed:", e);
        return [];
    }
});

export const getCustomClassSlots = cache(async () => {
    try {
        const rows = await prisma.$queryRawUnsafe<any[]>(
            `SELECT
                cs.id, cs."dayKey", cs."startTime", cs."endTime", cs.label,
                cs."gradeRange", cs.enrolled, cs.capacity, cs.note, cs."isHidden",
                cs."coachId", cs."programId", cs."createdAt", cs."updatedAt",
                c.id AS c_id, c.name AS c_name, c.role AS c_role,
                c."imageUrl" AS c_imageurl, c.description AS c_desc, c."order" AS c_order
             FROM "CustomClassSlot" cs
             LEFT JOIN "Coach" c ON cs."coachId" = c.id
             ORDER BY cs."dayKey" ASC, cs."startTime" ASC`
        );
        return rows.map((r: any) => ({
            id: r.id,
            dayKey: r.dayKey ?? r.daykey,
            startTime: r.startTime ?? r.starttime,
            endTime: r.endTime ?? r.endtime,
            label: r.label ?? "",
            gradeRange: r.gradeRange ?? r.graderange ?? null,
            enrolled: Number(r.enrolled ?? 0),
            capacity: Number(r.capacity ?? 12),
            note: r.note ?? null,
            isHidden: r.isHidden ?? r.ishidden ?? false,
            coachId: r.coachId ?? r.coachid ?? null,
            programId: r.programId ?? r.programid ?? null,
            createdAt: r.createdAt ?? r.createdat,
            updatedAt: r.updatedAt ?? r.updatedat,
            coach: r.c_id ? {
                id: r.c_id, name: r.c_name, role: r.c_role,
                imageUrl: r.c_imageurl ?? null, description: r.c_desc ?? null,
                order: Number(r.c_order ?? 0),
                createdAt: new Date(), updatedAt: new Date(), slots: [], customSlots: [],
            } : null,
            program: null,
        }));
    } catch (e) {
        console.error("[getCustomClassSlots] failed:", e);
        return [];
    }
});

/** 연간일정 DB 조회 */
export const getAnnualEvents = cache(async () => {
    try {
        const rows = await prisma.$queryRawUnsafe<any[]>(
            `SELECT id, title, date, "endDate", description, category, "createdAt", "updatedAt"
             FROM "AnnualEvent" ORDER BY date ASC`
        );
        return rows.map((r: any) => ({
            id: r.id,
            title: r.title,
            date: r.date,
            endDate: r.endDate ?? r.enddate ?? null,
            description: r.description ?? null,
            category: r.category ?? "일반",
            createdAt: r.createdAt ?? r.createdat,
            updatedAt: r.updatedAt ?? r.updatedat,
        }));
    } catch (e) {
        console.error("[getAnnualEvents] failed:", e);
        return [];
    }
});

/** 대시보드 통계 쿼리 */
export const getDashboardStats = cache(async () => {
    const zero = { studentCount: 0, programCount: 0, coachCount: 0, classCount: 0 };
    try {
        const rows = await prisma.$queryRawUnsafe<any[]>(`
            SELECT
                (SELECT COUNT(*)::int FROM "Student") AS "studentCount",
                (SELECT COUNT(*)::int FROM "Program") AS "programCount",
                (SELECT COUNT(*)::int FROM "Coach") AS "coachCount",
                (SELECT COUNT(*)::int FROM "Class") AS "classCount"
        `);
        if (!rows[0]) return zero;
        return {
            studentCount: Number(rows[0].studentCount ?? 0),
            programCount: Number(rows[0].programCount ?? 0),
            coachCount: Number(rows[0].coachCount ?? 0),
            classCount: Number(rows[0].classCount ?? 0),
        };
    } catch (e) {
        console.error("[getDashboardStats] failed:", e);
        return zero;
    }
});

/** 출결: 특정 날짜+반의 세션 및 출석 데이터 조회 */
export const getAttendanceByDateAndClass = cache(async (date: string, classId: string) => {
    try {
        // 세션 조회
        const sessions = await prisma.$queryRawUnsafe<any[]>(
            `SELECT id, "classId", date, notes FROM "Session"
             WHERE "classId" = $1 AND date::date = $2::date LIMIT 1`,
            classId, date
        );
        const session = sessions[0] ?? null;

        // 해당 반 수강생 목록
        const enrolled = await prisma.$queryRawUnsafe<any[]>(
            `SELECT e."studentId", s.name AS student_name
             FROM "Enrollment" e
             JOIN "Student" s ON e."studentId" = s.id
             WHERE e."classId" = $1 AND e.status = 'ACTIVE'
             ORDER BY s.name ASC`,
            classId
        );

        // 세션이 있으면 출석 기록 조회
        let attendances: any[] = [];
        if (session) {
            attendances = await prisma.$queryRawUnsafe<any[]>(
                `SELECT id, "studentId", status FROM "Attendance" WHERE "sessionId" = $1`,
                session.id
            );
        }

        return {
            session,
            students: enrolled.map((e: any) => ({
                studentId: e.studentId ?? e.studentid,
                studentName: e.student_name,
                status: attendances.find(
                    (a: any) => (a.studentId ?? a.studentid) === (e.studentId ?? e.studentid)
                )?.status ?? null,
                attendanceId: attendances.find(
                    (a: any) => (a.studentId ?? a.studentid) === (e.studentId ?? e.studentid)
                )?.id ?? null,
            })),
        };
    } catch (e) {
        console.error("[getAttendanceByDateAndClass] failed:", e);
        return { session: null, students: [] };
    }
});

/** 수납: 월별 수납 내역 조회 */
export const getPayments = cache(async (year?: number, month?: number) => {
    try {
        let where = "";
        const params: any[] = [];
        if (year && month) {
            where = `WHERE EXTRACT(YEAR FROM p."dueDate") = $1 AND EXTRACT(MONTH FROM p."dueDate") = $2`;
            params.push(year, month);
        }
        const rows = await prisma.$queryRawUnsafe<any[]>(
            `SELECT p.id, p."studentId", p.amount, p.status, p."dueDate", p."paidDate",
                    p."createdAt", s.name AS student_name
             FROM "Payment" p
             JOIN "Student" s ON p."studentId" = s.id
             ${where}
             ORDER BY p."dueDate" DESC`,
            ...params
        );
        return rows.map((r: any) => ({
            id: r.id,
            studentId: r.studentId ?? r.studentid,
            studentName: r.student_name,
            amount: Number(r.amount),
            status: r.status,
            dueDate: r.dueDate ?? r.duedate,
            paidDate: r.paidDate ?? r.paiddate ?? null,
            createdAt: r.createdAt ?? r.createdat,
        }));
    } catch (e) {
        console.error("[getPayments] failed:", e);
        return [];
    }
});

/** Google Sheets 동기화 캐시 조회 (SheetSlotCache 테이블 싱글턴 row) */
export const getSheetSlotCache = cache(async (): Promise<SheetClassSlot[] | null> => {
    try {
        const rows = await prisma.$queryRawUnsafe<any[]>(
            `SELECT "slotsJson" FROM "SheetSlotCache" WHERE id = 'singleton' LIMIT 1`
        );
        if (!rows[0]) return null;
        const json = rows[0].slotsJson ?? rows[0].slotsjson ?? "[]";
        return JSON.parse(json) as SheetClassSlot[];
    } catch {
        return null;
    }
});
