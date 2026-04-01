"use server";

/**
 * 공개 Server Actions — 로그인 없이 접근 가능
 * admin.ts와 분리: requireAdmin() 없음
 * 체험수업 신청 폼 등 비회원이 사용하는 기능
 */

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { ensureTrialLeadTable } from "@/app/actions/admin";
import { notifyAdmins, sendParentSms } from "@/lib/notification";

// ── EnrollmentApplication DDL ensure (idempotent) ───────────────────────────
// 테이블이 없으면 자동으로 생성 — DB push 없이도 동작하도록
let _enrollTableEnsured = false;
export async function ensureEnrollmentApplicationTable() {
    if (_enrollTableEnsured) return;
    try {
        await prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "EnrollmentApplication" (
                id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
                "trialLeadId" TEXT,
                "childName" TEXT NOT NULL,
                "childBirthDate" TIMESTAMPTZ NOT NULL,
                "childGender" TEXT,
                "childGrade" TEXT,
                "childSchool" TEXT,
                "childPhone" TEXT,
                "parentName" TEXT NOT NULL,
                "parentPhone" TEXT NOT NULL,
                "parentRelation" TEXT,
                address TEXT,
                "preferredSlotKeys" TEXT,
                "assignedClassId" TEXT,
                "uniformSize" TEXT,
                "shuttleNeeded" BOOLEAN DEFAULT false,
                "shuttlePickup" TEXT,
                "paymentMethod" TEXT,
                "referralSource" TEXT,
                memo TEXT,
                "agreedTerms" BOOLEAN DEFAULT false,
                "agreedPrivacy" BOOLEAN DEFAULT false,
                status TEXT DEFAULT 'PENDING',
                "processedAt" TIMESTAMPTZ,
                "processedNote" TEXT,
                "convertedStudentId" TEXT,
                "createdAt" TIMESTAMPTZ DEFAULT NOW(),
                "updatedAt" TIMESTAMPTZ DEFAULT NOW()
            )
        `);
        // 인덱스 생성 (상태별/trialLeadId/생성일 필터 최적화)
        await prisma.$executeRawUnsafe(
            `CREATE INDEX IF NOT EXISTS "EnrollmentApplication_status_idx" ON "EnrollmentApplication" (status)`
        );
        await prisma.$executeRawUnsafe(
            `CREATE INDEX IF NOT EXISTS "EnrollmentApplication_trialLeadId_idx" ON "EnrollmentApplication" ("trialLeadId")`
        );
        await prisma.$executeRawUnsafe(
            `CREATE INDEX IF NOT EXISTS "EnrollmentApplication_createdAt_idx" ON "EnrollmentApplication" ("createdAt")`
        );
    } catch (e) {
        console.warn("[DDL] EnrollmentApplication ensure failed:", (e as Error).message);
    }
    _enrollTableEnsured = true;
}

// ── 체험수업 신청 입력 타입 ──────────────────────────────────────────────────
interface TrialApplicationInput {
    childName: string;
    childBirthDate: string;      // ISO 문자열 "2018-05-15"
    childGrade: string;
    childGender?: string;
    basketballExp: string;
    parentName: string;
    parentPhone: string;
    preferredSlotKey?: string;    // 희망 슬롯 "Mon-4"
    hopeNote?: string;
    source: string;               // 가입 경로
    agreedTerms: boolean;
    agreedPrivacy: boolean;
    honeypot?: string;            // 스팸 방지용 — 빈값이어야 정상
}

// ── 전화번호 정규화 ──────────────────────────────────────────────────────────
// 010-1234-5678, 01012345678, 010 1234 5678 등 다양한 형태를 010-1234-5678로 통일
function normalizePhone(raw: string): string {
    const digits = raw.replace(/\D/g, "");
    if (digits.length === 11 && digits.startsWith("010")) {
        return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
    }
    return raw.trim();
}

/**
 * submitTrialApplication — 체험수업 신청 (공개, 비로그인)
 *
 * 검증 사항:
 * 1. honeypot 필드가 비어있어야 함 (스팸봇 차단)
 * 2. 이름, 전화번호 필수
 * 3. 약관 동의 필수
 */
export async function submitTrialApplication(data: TrialApplicationInput) {
    // 스팸봇 차단: honeypot 필드에 값이 있으면 봇으로 판단
    if (data.honeypot) {
        // 봇에게는 성공한 것처럼 보여줌 (봇이 다시 시도하지 않도록)
        return { success: true, id: "ok" };
    }

    // 필수값 검증
    const childName = data.childName?.trim();
    const parentName = data.parentName?.trim();
    const parentPhone = data.parentPhone?.trim();

    if (!childName) throw new Error("아이 이름을 입력해주세요.");
    if (!parentName) throw new Error("보호자 이름을 입력해주세요.");
    if (!parentPhone) throw new Error("보호자 연락처를 입력해주세요.");
    if (!data.agreedTerms || !data.agreedPrivacy) {
        throw new Error("이용약관과 개인정보 수집/이용에 모두 동의해주세요.");
    }

    // 전화번호 형식 검증 (숫자만 추출 후 11자리 확인)
    const phoneDigits = parentPhone.replace(/\D/g, "");
    if (phoneDigits.length < 10 || phoneDigits.length > 11) {
        throw new Error("올바른 전화번호를 입력해주세요.");
    }

    // DDL ensure — 테이블/컬럼이 없으면 자동 생성
    await ensureTrialLeadTable();

    try {
        // TrialLead INSERT — status='NEW'로 생성
        const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(
            `INSERT INTO "TrialLead" (
                id, "childName", "childAge", "childBirthDate", "childGrade", "childGender",
                "basketballExp", "parentName", "parentPhone",
                "preferredSlotKey", "hopeNote", source,
                "agreedTerms", "agreedPrivacy",
                status, "createdAt", "updatedAt"
            ) VALUES (
                gen_random_uuid()::text, $1, $2, $3::timestamptz, $4, $5,
                $6, $7, $8,
                $9, $10, $11,
                $12, $13,
                'NEW', NOW(), NOW()
            ) RETURNING id`,
            childName,
            data.childGrade || null,                              // childAge에 학년 저장 (기존 호환)
            data.childBirthDate || null,                          // childBirthDate
            data.childGrade || null,                              // childGrade
            data.childGender || null,                             // childGender
            data.basketballExp || null,                           // basketballExp
            parentName,
            normalizePhone(parentPhone),
            data.preferredSlotKey || null,                        // preferredSlotKey
            data.hopeNote?.trim() || null,                        // hopeNote
            data.source || "WEBSITE",                             // source
            data.agreedTerms,                                     // agreedTerms
            data.agreedPrivacy,                                   // agreedPrivacy
        );

        // 관리자 페이지 캐시 무효화 (새 신청이 바로 보이도록)
        revalidatePath("/admin/trial");
        revalidatePath("/admin");

        // SMS 템플릿 변수 — 관리자/코치/학부모 공통으로 사용
        const smsVars = {
            childName,
            childGrade: data.childGrade || "학년 미입력",
            parentName,
            parentPhone: normalizePhone(parentPhone),
        };

        // 관리자에게 알림 발송 (fire-and-forget: 실패해도 신청은 정상 완료)
        // 템플릿 기반 SMS: TRIAL_NEW_ADMIN(관리자), TRIAL_NEW_COACH(코치)
        notifyAdmins(
            "TRIAL_APPLICATION",
            "새 체험수업 신청",
            `${childName} (${data.childGrade || "학년 미입력"}) — ${parentName}`,
            "/admin/trial",
            {
                adminTrigger: "TRIAL_NEW_ADMIN",
                coachTrigger: "TRIAL_NEW_COACH",
                variables: smsVars,
            },
        ).catch(() => {});

        // 학부모에게 접수 확인 SMS 발송 (fire-and-forget)
        // academyPhone은 DB에서 비동기 조회하여 포함
        sendParentSmsWithAcademyPhone(
            normalizePhone(parentPhone),
            "TRIAL_CONFIRM_PARENT",
            { childName, parentName },
        ).catch(() => {});

        return { success: true, id: rows[0]?.id || "ok" };
    } catch (e) {
        console.error("[submitTrialApplication] failed:", e);
        throw new Error("신청 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    }
}

// ── 빈자리 슬롯 조회 타입 ────────────────────────────────────────────────────
export interface AvailableSlot {
    slotKey: string;
    dayOfWeek: string;      // "Mon", "Tue", ...
    dayLabel: string;       // "월", "화", ...
    className: string;      // 수업 이름
    startTime: string;
    endTime: string;
    capacity: number;
    enrolled: number;
    available: number;      // capacity - enrolled
}

// 요일 코드 → 한글 라벨 매핑
const DAY_LABELS: Record<string, string> = {
    Mon: "월", Tue: "화", Wed: "수", Thu: "목", Fri: "금", Sat: "토", Sun: "일",
};

/**
 * getAvailableTrialSlots — 빈자리 있는 수업 슬롯 목록 (공개용)
 *
 * Class 테이블에서 Enrollment(ACTIVE) 수를 세고,
 * capacity - enrolled > 0 인 슬롯만 반환
 */
export async function getAvailableTrialSlots(): Promise<AvailableSlot[]> {
    try {
        const rows = await prisma.$queryRawUnsafe<any[]>(`
            SELECT
                c."slotKey",
                c."dayOfWeek",
                c.name AS class_name,
                c."startTime",
                c."endTime",
                c.capacity,
                COUNT(CASE WHEN e.status = 'ACTIVE' THEN 1 END)::int AS enrolled
            FROM "Class" c
            LEFT JOIN "Enrollment" e ON c.id = e."classId"
            WHERE c."slotKey" IS NOT NULL
            GROUP BY c.id
            ORDER BY
                CASE c."dayOfWeek"
                    WHEN 'Mon' THEN 1
                    WHEN 'Tue' THEN 2
                    WHEN 'Wed' THEN 3
                    WHEN 'Thu' THEN 4
                    WHEN 'Fri' THEN 5
                    WHEN 'Sat' THEN 6
                    WHEN 'Sun' THEN 7
                END,
                c."startTime"
        `);

        return rows.map((r) => ({
            slotKey: r.slotKey ?? r.slotkey,
            dayOfWeek: r.dayOfWeek ?? r.dayofweek,
            dayLabel: DAY_LABELS[(r.dayOfWeek ?? r.dayofweek)] || (r.dayOfWeek ?? r.dayofweek),
            className: r.class_name,
            startTime: r.startTime ?? r.starttime,
            endTime: r.endTime ?? r.endtime,
            capacity: r.capacity,
            enrolled: r.enrolled,
            available: r.capacity - r.enrolled,
        }));
    } catch (e) {
        console.error("[getAvailableTrialSlots] failed:", e);
        return [];
    }
}

// ── 수강 신청 입력 타입 ──────────────────────────────────────────────────────
interface EnrollApplicationInput {
    trialLeadId?: string;        // 체험 거친 경우 TrialLead ID
    childName: string;
    childBirthDate: string;      // ISO 문자열 "2018-05-15"
    childGender?: string;
    childGrade?: string;
    childSchool?: string;
    childPhone?: string;
    parentName: string;
    parentPhone: string;
    parentRelation?: string;
    address?: string;
    preferredSlotKeys?: string;  // 콤마 구분 "Mon-4,Wed-6"
    uniformSize?: string;
    shuttleNeeded?: boolean;
    shuttlePickup?: string;
    paymentMethod?: string;
    referralSource?: string;
    memo?: string;
    agreedTerms: boolean;
    agreedPrivacy: boolean;
    honeypot?: string;           // 스팸 방지용 — 빈값이어야 정상
}

/**
 * submitEnrollApplication — 수강 신청 (공개, 비로그인)
 *
 * 검증 사항:
 * 1. honeypot 필드가 비어있어야 함 (스팸봇 차단)
 * 2. 이름, 생년월일, 보호자이름, 전화번호 필수
 * 3. 약관 동의 필수
 * 4. trialLeadId가 있으면 해당 TrialLead 존재 여부 확인
 */
export async function submitEnrollApplication(data: EnrollApplicationInput) {
    // 스팸봇 차단: honeypot 필드에 값이 있으면 봇으로 판단
    if (data.honeypot) {
        return { success: true, id: "ok" };
    }

    // 필수값 검증
    const childName = data.childName?.trim();
    const parentName = data.parentName?.trim();
    const parentPhone = data.parentPhone?.trim();

    if (!childName) throw new Error("아이 이름을 입력해주세요.");
    if (!data.childBirthDate) throw new Error("아이 생년월일을 입력해주세요.");
    if (!parentName) throw new Error("보호자 이름을 입력해주세요.");
    if (!parentPhone) throw new Error("보호자 연락처를 입력해주세요.");
    if (!data.agreedTerms || !data.agreedPrivacy) {
        throw new Error("이용약관과 개인정보 수집/이용에 모두 동의해주세요.");
    }

    // 전화번호 형식 검증
    const phoneDigits = parentPhone.replace(/\D/g, "");
    if (phoneDigits.length < 10 || phoneDigits.length > 11) {
        throw new Error("올바른 전화번호를 입력해주세요.");
    }

    // DDL ensure — 테이블이 없으면 자동 생성
    await ensureEnrollmentApplicationTable();

    // trialLeadId가 있으면 존재 여부 확인
    if (data.trialLeadId) {
        try {
            const lead = await prisma.$queryRawUnsafe<{ id: string }[]>(
                `SELECT id FROM "TrialLead" WHERE id = $1 LIMIT 1`,
                data.trialLeadId
            );
            if (lead.length === 0) {
                // 존재하지 않는 trialLeadId는 null로 처리 (에러 대신 무시)
                data.trialLeadId = undefined;
            }
        } catch {
            data.trialLeadId = undefined;
        }
    }

    try {
        // EnrollmentApplication INSERT — status='PENDING'으로 생성
        const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(
            `INSERT INTO "EnrollmentApplication" (
                id, "trialLeadId",
                "childName", "childBirthDate", "childGender", "childGrade", "childSchool", "childPhone",
                "parentName", "parentPhone", "parentRelation", address,
                "preferredSlotKeys", "uniformSize", "shuttleNeeded", "shuttlePickup",
                "paymentMethod", "referralSource", memo,
                "agreedTerms", "agreedPrivacy",
                status, "createdAt", "updatedAt"
            ) VALUES (
                gen_random_uuid()::text, $1,
                $2, $3::timestamptz, $4, $5, $6, $7,
                $8, $9, $10, $11,
                $12, $13, $14, $15,
                $16, $17, $18,
                $19, $20,
                'PENDING', NOW(), NOW()
            ) RETURNING id`,
            data.trialLeadId || null,
            childName,
            data.childBirthDate,
            data.childGender || null,
            data.childGrade || null,
            data.childSchool || null,
            data.childPhone || null,
            parentName,
            normalizePhone(parentPhone),
            data.parentRelation || null,
            data.address?.trim() || null,
            data.preferredSlotKeys || null,
            data.uniformSize || null,
            data.shuttleNeeded || false,
            data.shuttlePickup?.trim() || null,
            data.paymentMethod || null,
            data.referralSource || null,
            data.memo?.trim() || null,
            data.agreedTerms,
            data.agreedPrivacy,
        );

        // 관리자 페이지 캐시 무효화
        revalidatePath("/admin");

        // SMS 템플릿 변수
        const smsVars = {
            childName,
            childGrade: data.childGrade || "학년 미입력",
            parentName,
            parentPhone: normalizePhone(parentPhone),
        };

        // 관리자에게 알림 발송 (fire-and-forget: 실패해도 신청은 정상 완료)
        // 템플릿 기반 SMS: ENROLL_NEW_ADMIN(관리자), ENROLL_NEW_COACH(코치)
        notifyAdmins(
            "ENROLL_APPLICATION",
            "새 수강 신청",
            `${childName} (${data.childGrade || "학년 미입력"}) — ${parentName}`,
            "/admin/apply",
            {
                adminTrigger: "ENROLL_NEW_ADMIN",
                coachTrigger: "ENROLL_NEW_COACH",
                variables: smsVars,
            },
        ).catch(() => {});

        // 학부모에게 접수 확인 SMS 발송 (fire-and-forget)
        sendParentSmsWithAcademyPhone(
            normalizePhone(parentPhone),
            "ENROLL_CONFIRM_PARENT",
            { childName, parentName },
        ).catch(() => {});

        return { success: true, id: rows[0]?.id || "ok" };
    } catch (e) {
        console.error("[submitEnrollApplication] failed:", e);
        throw new Error("수강 신청 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    }
}

// ── 체험 데이터 자동 채움용 타입 ─────────────────────────────────────────────
export interface TrialLeadForEnroll {
    childName: string;
    childBirthDate: string | null;
    childGrade: string | null;
    childGender: string | null;
    parentName: string;
    parentPhone: string;
    source: string;
}

/**
 * getTrialLeadForEnroll — 체험 거친 사람의 데이터를 수강 폼에 자동 채움
 *
 * 공개용이므로 관리자 메모 등 민감 정보는 제외하고
 * 이름, 생년월일, 학년, 성별, 보호자 정보만 반환
 */
export async function getTrialLeadForEnroll(trialId: string): Promise<TrialLeadForEnroll | null> {
    if (!trialId) return null;

    try {
        // TrialLead 테이블이 존재하는지 먼저 확인
        await ensureTrialLeadTable();

        const rows = await prisma.$queryRawUnsafe<any[]>(
            `SELECT "childName", "childBirthDate", "childGrade", "childGender",
                    "parentName", "parentPhone", source
             FROM "TrialLead"
             WHERE id = $1
             LIMIT 1`,
            trialId
        );

        if (rows.length === 0) return null;

        const r = rows[0];
        return {
            childName: r.childName ?? r.childname ?? "",
            childBirthDate: r.childBirthDate ?? r.childbirthdate
                ? new Date(r.childBirthDate ?? r.childbirthdate).toISOString().split("T")[0]
                : null,
            childGrade: r.childGrade ?? r.childgrade ?? null,
            childGender: r.childGender ?? r.childgender ?? null,
            parentName: r.parentName ?? r.parentname ?? "",
            parentPhone: r.parentPhone ?? r.parentphone ?? "",
            source: r.source ?? "WEBSITE",
        };
    } catch (e) {
        console.error("[getTrialLeadForEnroll] failed:", e);
        return null;
    }
}

// ── 학부모 SMS 발송 (academyPhone 자동 조회 포함) ─────────────────────────────
// 학부모 PARENT 템플릿에는 {{academyPhone}} 변수가 포함된 경우가 많다.
// AcademySettings.contactPhone을 DB에서 조회하여 variables에 자동 추가한다.
// fire-and-forget 패턴: 실패해도 메인 로직에 영향 없음
async function sendParentSmsWithAcademyPhone(
    parentPhone: string,
    trigger: string,
    baseVars: Record<string, string>,
) {
    try {
        // 학원 전화번호 조회
        const settings = await prisma.$queryRawUnsafe<any[]>(
            `SELECT "contactPhone" FROM "AcademySettings" WHERE id = 'singleton' LIMIT 1`
        );
        const academyPhone = settings[0]?.contactPhone ?? settings[0]?.contactphone ?? "";

        // 변수에 academyPhone 추가
        const vars = { ...baseVars, academyPhone };

        // sendParentSms 호출 (notification.ts)
        const { sendParentSms: sps } = await import("@/lib/notification");
        await sps(parentPhone, trigger, vars);
    } catch (e) {
        console.error(`[sendParentSmsWithAcademyPhone] trigger=${trigger} failed:`, e);
    }
}
