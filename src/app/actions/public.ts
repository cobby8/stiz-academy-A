"use server";

/**
 * 공개 Server Actions — 로그인 없이 접근 가능
 * admin.ts와 분리: requireAdmin() 없음
 * 체험수업 신청 폼 등 비회원이 사용하는 기능
 */

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { ensureTrialLeadTable } from "@/app/actions/admin";
import { notifyAdmins } from "@/lib/notification";

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
                "enrollmentMonths" TEXT,
                "preferredSlotKeys" TEXT,
                "assignedClassId" TEXT,
                "basketballExp" TEXT,
                "uniformSize" TEXT,
                "shuttleNeeded" BOOLEAN DEFAULT false,
                "shuttlePickup" TEXT,
                "shuttleTime" TEXT,
                "shuttleDropoff" TEXT,
                "paymentMethod" TEXT,
                "referralSource" TEXT,
                memo TEXT,
                "agreedTerms" BOOLEAN DEFAULT false,
                "agreedPrivacy" BOOLEAN DEFAULT false,
                "applicationNoticeConfirmed" BOOLEAN DEFAULT false,
                "shuttleNoticeConfirmed" BOOLEAN DEFAULT false,
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
        const extendedColumns: [string, string][] = [
            ['"enrollmentMonths"', "TEXT"],
            ['"applicationNoticeConfirmed"', "BOOLEAN DEFAULT false"],
            ['"shuttleNoticeConfirmed"', "BOOLEAN DEFAULT false"],
        ];
        for (const [col, type] of extendedColumns) {
            await prisma.$executeRawUnsafe(
                `ALTER TABLE "EnrollmentApplication" ADD COLUMN IF NOT EXISTS ${col} ${type}`
            );
        }
    } catch (e) {
        console.warn("[DDL] EnrollmentApplication ensure failed:", (e as Error).message);
    }
    _enrollTableEnsured = true;
}

// ── 체험수업 신청 입력 타입 ──────────────────────────────────────────────────
interface TrialApplicationInput {
    trialDate?: string;          // Google Form: 체험수업 희망일
    trialDay?: string;           // Google Form: 요일
    trialPeriod?: string;        // Google Form: 교시
    childName: string;
    childBirthDate?: string;     // 이전 자체 폼 호환
    childGrade: string;
    childGender?: string;
    childSchool?: string;
    basketballExp?: string;
    parentName?: string;
    parentPhone: string;
    preferredSlotKey?: string;    // 희망 슬롯 "Mon-4"
    hopeNote?: string;
    source: string;               // 가입 경로
    trialFeeConfirmed?: boolean;
    agreedTerms?: boolean;
    agreedPrivacy?: boolean;
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

const TRIAL_DAY_KEY_BY_LABEL: Record<string, string> = {
    월: "Mon",
    화: "Tue",
    수: "Wed",
    목: "Thu",
    금: "Fri",
    토: "Sat",
    일: "Sun",
};

function resolveTrialSlotKey(data: TrialApplicationInput): string | null {
    const directSlotKey = data.preferredSlotKey?.trim();
    if (directSlotKey) return directSlotKey;

    const dayKey = TRIAL_DAY_KEY_BY_LABEL[data.trialDay?.trim() || ""];
    const period = data.trialPeriod?.trim();
    if (!dayKey || !period) return null;

    return `${dayKey}-${period}`;
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
    const parentName = data.parentName?.trim() || "미입력";
    const parentPhone = data.parentPhone?.trim();

    if (!data.trialDate) throw new Error("체험수업 희망일을 선택해주세요.");
    if (!data.trialDay) throw new Error("요일을 선택해주세요.");
    if (!data.trialPeriod) throw new Error("교시를 선택해주세요.");
    if (!childName) throw new Error("아이 이름을 입력해주세요.");
    if (!data.childGender) throw new Error("성별을 선택해주세요.");
    if (!data.childSchool?.trim()) throw new Error("학교를 입력해주세요.");
    if (!data.childGrade) throw new Error("학년을 선택해주세요.");
    if (!parentPhone) throw new Error("학부모 연락처를 입력해주세요.");
    if (!data.source) throw new Error("신청경로를 선택해주세요.");
    if (!data.trialFeeConfirmed) throw new Error("체험수업 비용 확인에 체크해주세요.");

    // 전화번호 형식 검증 (숫자만 추출 후 11자리 확인)
    const phoneDigits = parentPhone.replace(/\D/g, "");
    if (phoneDigits.length < 10 || phoneDigits.length > 11) {
        throw new Error("올바른 전화번호를 입력해주세요.");
    }

    // DDL ensure — 테이블/컬럼이 없으면 자동 생성
    await ensureTrialLeadTable();

    try {
        const normalizedParentPhone = normalizePhone(parentPhone);
        const preferredSlotKey = resolveTrialSlotKey(data);

        // TrialLead INSERT — status='NEW'로 생성
        const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(
            `INSERT INTO "TrialLead" (
                id, "childName", "childAge", "childBirthDate", "childGrade", "childGender", "childSchool",
                "basketballExp", "parentName", "parentPhone",
                "scheduledDate", "preferredDays", "preferredSlotKey", "preferredDay", "preferredPeriod", "trialDate",
                "hopeNote", source, "trialFeeConfirmed",
                "agreedTerms", "agreedPrivacy",
                status, "createdAt", "updatedAt"
            ) VALUES (
                gen_random_uuid()::text, $1, $2, $3::timestamptz, $4, $5, $6,
                $7, $8, $9,
                $10::timestamptz, $11, $12, $13, $14, $15::timestamptz,
                $16, $17, $18,
                $19, $20,
                'NEW', NOW(), NOW()
            ) RETURNING id`,
            childName,
            data.childGrade || null,                              // childAge에 학년 저장 (기존 호환)
            data.childBirthDate || null,                          // childBirthDate
            data.childGrade || null,                              // childGrade
            data.childGender || null,                             // childGender
            data.childSchool?.trim() || null,                     // childSchool
            data.basketballExp || null,                           // basketballExp
            parentName,
            normalizedParentPhone,
            data.trialDate || null,                               // scheduledDate
            data.trialDay || null,                                // preferredDays
            preferredSlotKey,                                      // preferredSlotKey
            data.trialDay || null,                                // preferredDay
            data.trialPeriod || null,                             // preferredPeriod
            data.trialDate || null,                               // trialDate
            data.hopeNote?.trim() || null,                        // hopeNote
            data.source || "WEBSITE",                             // source
            data.trialFeeConfirmed ?? false,                      // trialFeeConfirmed
            data.agreedTerms ?? false,                            // agreedTerms
            data.agreedPrivacy ?? false,                          // agreedPrivacy
        );

        // 관리자 페이지 캐시 무효화 (새 신청이 바로 보이도록)
        revalidatePath("/admin/trial");
        revalidatePath("/admin");
        revalidatePath("/admin/apply");
        revalidatePath("/admin/trial");

        // SMS 템플릿 변수 — 관리자/코치/학부모 공통으로 사용
        const smsVars = {
            childName,
            childGrade: data.childGrade || "학년 미입력",
            parentName,
            parentPhone: normalizedParentPhone,
        };
        const trialLeadId = rows[0]?.id || "ok";

        // 관리자/학부모 문자 발송은 신청 저장 후 병렬 처리한다.
        // 실패해도 신청 자체는 유지되며, 발송 결과는 NotificationDelivery에 남긴다.
        // 템플릿 기반 SMS: TRIAL_NEW_ADMIN(관리자), TRIAL_NEW_COACH(코치)
        // slotKeys: 희망 슬롯이 있으면 해당 슬롯 담당 코치에게만 SMS 발송
        await Promise.allSettled([
            notifyAdmins(
                "TRIAL_APPLICATION",
                "새 체험수업 신청",
                `${childName} (${data.childGrade || "학년 미입력"}) — ${parentName}`,
                "/admin/trial",
                {
                    adminTrigger: "TRIAL_NEW_ADMIN",
                    coachTrigger: "TRIAL_NEW_COACH",
                    variables: smsVars,
                    slotKeys: preferredSlotKey ? [preferredSlotKey] : undefined,
                    eventId: trialLeadId,
                },
            ),

            // 학부모에게 접수 확인 SMS 발송. academyPhone은 DB에서 조회하여 포함한다.
            sendParentSmsWithAcademyPhone(
                normalizedParentPhone,
                "TRIAL_CONFIRM_PARENT",
                { childName, parentName },
                { eventType: "TRIAL_APPLICATION", eventId: trialLeadId },
            ),
        ]);

        return { success: true, id: trialLeadId };
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
    enrollmentMonths?: string;   // 콤마 구분 "2026년 7월,2026년 8월"
    preferredSlotKeys?: string;  // 콤마 구분 "Mon-4,Wed-6"
    basketballExp?: string;      // 농구 경험 (없음/1년 미만/1~3년/3년 이상)
    uniformSize?: string;
    shuttleNeeded?: boolean;
    shuttlePickup?: string;
    shuttleTime?: string;        // 셔틀 희망 시간
    shuttleDropoff?: string;     // 셔틀 하차 장소
    paymentMethod?: string;
    referralSource?: string;
    memo?: string;
    agreedTerms: boolean;
    agreedPrivacy: boolean;
    applicationNoticeConfirmed?: boolean;
    shuttleNoticeConfirmed?: boolean;
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
    if (!data.childPhone?.trim()) throw new Error("수강생 전화번호를 입력해주세요.");
    if (!parentName) throw new Error("보호자 이름을 입력해주세요.");
    if (!parentPhone) throw new Error("보호자 연락처를 입력해주세요.");
    if (!data.childSchool?.trim()) throw new Error("학교명을 입력해주세요.");
    if (!data.enrollmentMonths?.trim()) throw new Error("수강신청 월을 선택해주세요.");
    if (!data.referralSource) throw new Error("가입경로를 선택해주세요.");
    if (data.shuttleNeeded && (!data.shuttlePickup?.trim() || !data.shuttleTime || !data.shuttleDropoff?.trim())) {
        throw new Error("셔틀 탑승을 선택한 경우 탑승 장소, 희망 시간, 하차 장소를 모두 입력해주세요.");
    }
    if (data.shuttleNeeded && !data.shuttleNoticeConfirmed) {
        throw new Error("셔틀 주의사항을 확인해주세요.");
    }
    if (!data.agreedTerms || !data.agreedPrivacy) {
        throw new Error("이용약관과 개인정보 수집/이용에 모두 동의해주세요.");
    }
    if (!data.applicationNoticeConfirmed) {
        throw new Error("수강신청확정 안내를 확인해주세요.");
    }

    // 전화번호 형식 검증
    const phoneDigits = parentPhone.replace(/\D/g, "");
    if (phoneDigits.length < 10 || phoneDigits.length > 11) {
        throw new Error("올바른 전화번호를 입력해주세요.");
    }

    // DDL ensure — 테이블이 없으면 자동 생성
    await ensureEnrollmentApplicationTable();

    let matchedTrialLeadId = data.trialLeadId || null;

    // trialLeadId가 있으면 존재 여부 확인
    if (data.trialLeadId) {
        try {
            const lead = await prisma.$queryRawUnsafe<{ id: string }[]>(
                `SELECT id FROM "TrialLead" WHERE id = $1 LIMIT 1`,
                data.trialLeadId
            );
            if (lead.length === 0) {
                // 존재하지 않는 trialLeadId는 null로 처리 (에러 대신 무시)
                matchedTrialLeadId = null;
            }
        } catch {
            matchedTrialLeadId = null;
        }
    }

    if (!matchedTrialLeadId) {
        try {
            await ensureTrialLeadTable();
            const phoneDigits = normalizePhone(parentPhone).replace(/\D/g, "");
            const matches = await prisma.$queryRawUnsafe<{ id: string }[]>(
                `SELECT id
                 FROM "TrialLead"
                 WHERE TRIM("childName") = $1
                   AND regexp_replace(COALESCE("parentPhone", ''), '[^0-9]', '', 'g') = $2
                   AND status IN ('ATTENDED', 'SCHEDULED', 'CONTACTED', 'NEW')
                 ORDER BY
                   CASE status
                     WHEN 'ATTENDED' THEN 1
                     WHEN 'SCHEDULED' THEN 2
                     WHEN 'CONTACTED' THEN 3
                     ELSE 4
                   END,
                   COALESCE("attendedDate", "trialDate", "scheduledDate", "createdAt") DESC
                 LIMIT 1`,
                childName,
                phoneDigits,
            );
            matchedTrialLeadId = matches[0]?.id ?? null;
        } catch (matchError) {
            console.warn("[submitEnrollApplication] trial lead auto match failed:", matchError);
        }
    }

    try {
        // EnrollmentApplication INSERT — status='PENDING'으로 생성
        // Google Form 항목 parity: 수강신청 월/확정 안내/셔틀 주의사항 확인까지 저장
        const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(
            `INSERT INTO "EnrollmentApplication" (
                id, "trialLeadId",
                "childName", "childBirthDate", "childGender", "childGrade", "childSchool", "childPhone",
                "parentName", "parentPhone", "parentRelation", address,
                "enrollmentMonths", "preferredSlotKeys", "basketballExp", "uniformSize",
                "shuttleNeeded", "shuttlePickup", "shuttleTime", "shuttleDropoff",
                "paymentMethod", "referralSource", memo,
                "agreedTerms", "agreedPrivacy", "applicationNoticeConfirmed", "shuttleNoticeConfirmed",
                status, "createdAt", "updatedAt"
            ) VALUES (
                gen_random_uuid()::text, $1,
                $2, $3::timestamptz, $4, $5, $6, $7,
                $8, $9, $10, $11,
                $12, $13, $14, $15,
                $16, $17, $18, $19,
                $20, $21, $22,
                $23, $24, $25, $26,
                'PENDING', NOW(), NOW()
            ) RETURNING id`,
            matchedTrialLeadId || null,         // $1
            childName,                          // $2
            data.childBirthDate,                // $3
            data.childGender || null,           // $4
            data.childGrade || null,            // $5
            data.childSchool || null,           // $6
            data.childPhone || null,            // $7
            parentName,                         // $8
            normalizePhone(parentPhone),        // $9
            data.parentRelation || null,        // $10
            data.address?.trim() || null,       // $11
            data.enrollmentMonths || null,      // $12
            data.preferredSlotKeys || null,     // $13
            data.basketballExp || null,         // $14
            data.uniformSize || null,           // $15
            data.shuttleNeeded ?? false,        // $16
            data.shuttlePickup?.trim() || null, // $17
            data.shuttleTime || null,           // $18
            data.shuttleDropoff?.trim() || null,// $19
            data.paymentMethod || null,         // $20
            data.referralSource || null,        // $21
            data.memo?.trim() || null,          // $22
            data.agreedTerms,                   // $23
            data.agreedPrivacy,                 // $24
            data.applicationNoticeConfirmed ?? false, // $25
            data.shuttleNoticeConfirmed ?? false,     // $26
        );

        if (matchedTrialLeadId && rows[0]?.id) {
            await prisma.$executeRawUnsafe(
                `UPDATE "TrialLead"
                 SET "enrollApplicationReceivedAt" = COALESCE("enrollApplicationReceivedAt", NOW()),
                     "enrollApplicationId" = $1,
                     "updatedAt" = NOW()
                 WHERE id = $2`,
                rows[0].id,
                matchedTrialLeadId,
            );
        }

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
        // slotKeys: 희망 슬롯이 있으면 해당 슬롯 담당 코치에게만 SMS 발송
        revalidatePath("/admin");
        revalidatePath("/admin/apply");
        revalidatePath("/admin/trial");

        const enrollSlotKeys = data.preferredSlotKeys
            ? data.preferredSlotKeys.split(",").map(k => k.trim()).filter(Boolean)
            : undefined;
        notifyAdmins(
            "ENROLL_APPLICATION",
            "새 수강 신청",
            `${childName} (${data.childGrade || "학년 미입력"}) — ${parentName}`,
            "/admin/apply",
            {
                adminTrigger: "ENROLL_NEW_ADMIN",
                coachTrigger: "ENROLL_NEW_COACH",
                variables: smsVars,
                slotKeys: enrollSlotKeys,
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
    childSchool: string | null;
    childPhone: string | null;
    basketballExp: string | null;
    preferredSlotKey: string | null;
    parentName: string;
    parentPhone: string;
    source: string;
}

let _trialLeadChildPhoneColumnEnsured = false;
async function ensureTrialLeadChildPhoneColumn() {
    if (_trialLeadChildPhoneColumnEnsured) return;
    await prisma.$executeRawUnsafe(`ALTER TABLE "TrialLead" ADD COLUMN IF NOT EXISTS "childPhone" TEXT`);
    _trialLeadChildPhoneColumnEnsured = true;
}

/**
 * getTrialLeadForEnroll — 체험 거친 사람의 데이터를 수강 폼에 자동 채움
 *
 * 공개용이므로 관리자 메모 등 민감 정보는 제외하고
 * 이름, 생년월일, 학년, 성별, 학교, 연락처, 농구 경험, 희망 수업, 보호자 정보만 반환
 */
export async function getTrialLeadForEnroll(trialId: string): Promise<TrialLeadForEnroll | null> {
    if (!trialId) return null;

    try {
        // TrialLead 테이블이 존재하는지 먼저 확인
        await ensureTrialLeadTable();
        await ensureTrialLeadChildPhoneColumn();

        const rows = await prisma.$queryRawUnsafe<any[]>(
            `SELECT "childName", "childBirthDate", "childGrade", "childGender",
                    "childSchool", "childPhone", "basketballExp", "preferredSlotKey",
                    "parentName", "parentPhone", source
             FROM "TrialLead"
             WHERE id = $1
             LIMIT 1`,
            trialId
        );

        if (rows.length === 0) return null;

        const r = rows[0];
        const parentName = (r.parentName ?? r.parentname ?? "").trim();
        return {
            childName: r.childName ?? r.childname ?? "",
            childBirthDate: r.childBirthDate ?? r.childbirthdate
                ? new Date(r.childBirthDate ?? r.childbirthdate).toISOString().split("T")[0]
                : null,
            childGrade: r.childGrade ?? r.childgrade ?? null,
            childGender: r.childGender ?? r.childgender ?? null,
            childSchool: r.childSchool ?? r.childschool ?? null,
            childPhone: r.childPhone ?? r.childphone ?? null,
            basketballExp: r.basketballExp ?? r.basketballexp ?? null,
            preferredSlotKey: r.preferredSlotKey ?? r.preferredslotkey ?? null,
            parentName: parentName === "미입력" ? "" : parentName,
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
    options?: { eventType?: string; eventId?: string },
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
        await sps(parentPhone, trigger, vars, options);
    } catch (e) {
        console.error(`[sendParentSmsWithAcademyPhone] trigger=${trigger} failed:`, e);
    }
}
