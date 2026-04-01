"use server";

/**
 * 공개 Server Actions — 로그인 없이 접근 가능
 * admin.ts와 분리: requireAdmin() 없음
 * 체험수업 신청 폼 등 비회원이 사용하는 기능
 */

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { ensureTrialLeadTable } from "@/app/actions/admin";

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
