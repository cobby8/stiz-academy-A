/**
 * 알림 통합 유틸 — DB 인앱 알림 + 웹 Push + SMS 발송을 한 곳에서 관리
 *
 * admin.ts에 있던 createNotificationRecord를 공용으로 분리.
 * public.ts (비로그인 신청)에서도 관리자 알림을 보낼 수 있도록.
 */

import { prisma } from "@/lib/prisma";
import { sendPushToUser } from "@/lib/pushNotification";
import { sendSms } from "@/lib/sms";
import { renderSmsTemplate } from "@/lib/smsTemplate";

// ── 슬롯 → 담당 코치 전화번호 조회 ─────────────────────────────────────────
// slotKey 배열로 해당 슬롯에 배정된 코치의 phone을 조회한다.
// ClassSlotOverride(기본 슬롯)와 CustomClassSlot(커스텀 슬롯) 양쪽 모두 확인.
// phone이 있는 코치만 반환하며, 중복 번호는 제거한다.
async function getCoachPhonesBySlotKeys(slotKeys: string[]): Promise<string[]> {
    if (slotKeys.length === 0) return [];

    try {
        const phones = new Set<string>();

        // 1) ClassSlotOverride에서 slotKey로 코치 조회
        // slotKey가 "Mon-4" 같은 기본 슬롯인 경우
        const placeholders1 = slotKeys.map((_, i) => `$${i + 1}`).join(",");
        const overrideCoaches = await prisma.$queryRawUnsafe<{ phone: string }[]>(
            `SELECT DISTINCT c.phone
             FROM "ClassSlotOverride" o
             JOIN "Coach" c ON c.id = o."coachId"
             WHERE o."slotKey" IN (${placeholders1})
               AND c.phone IS NOT NULL AND c.phone != ''`,
            ...slotKeys,
        );
        for (const row of overrideCoaches) {
            if (row.phone) phones.add(row.phone);
        }

        // 2) CustomClassSlot에서 id로 코치 조회
        // slotKey가 "custom-uuid" 형태인 경우 CustomClassSlot.id로 매칭
        const customKeys = slotKeys.filter(k => k.startsWith("custom-"));
        if (customKeys.length > 0) {
            const placeholders2 = customKeys.map((_, i) => `$${i + 1}`).join(",");
            const customCoaches = await prisma.$queryRawUnsafe<{ phone: string }[]>(
                `SELECT DISTINCT c.phone
                 FROM "CustomClassSlot" cs
                 JOIN "Coach" c ON c.id = cs."coachId"
                 WHERE cs.id IN (${placeholders2})
                   AND c.phone IS NOT NULL AND c.phone != ''`,
                ...customKeys,
            );
            for (const row of customCoaches) {
                if (row.phone) phones.add(row.phone);
            }
        }

        return Array.from(phones);
    } catch (e) {
        console.error("[getCoachPhonesBySlotKeys] failed:", e);
        return [];
    }
}

// ── DB 인앱 알림 생성 + 푸시 발송 ───────────────────────────────────────────
// Notification 테이블에 레코드 저장 후, 해당 사용자에게 웹 Push도 전송
export async function createNotificationRecord(data: {
    userId: string;
    type: string;      // ATTENDANCE, NOTICE, PAYMENT, TRIAL_APPLICATION, ENROLL_APPLICATION 등
    title: string;
    message: string;
    linkUrl?: string;
}) {
    try {
        // 1. DB에 인앱 알림 저장 ($queryRawUnsafe — PgBouncer 호환)
        await prisma.$executeRawUnsafe(
            `INSERT INTO "Notification" (id, "userId", type, title, message, "linkUrl", "isRead", "createdAt")
             VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, false, NOW())`,
            data.userId, data.type, data.title, data.message, data.linkUrl || null,
        );
        // 2. 웹 Push 발송 (실패해도 무시 — 알림 저장은 이미 완료됨)
        sendPushToUser(data.userId, {
            title: data.title,
            body: data.message,
            url: data.linkUrl || "/admin",
            tag: data.type,
        }).catch(() => {});
    } catch (e) {
        console.error("[createNotificationRecord] failed:", e);
    }
}

// ── 모든 관리자(ADMIN)에게 알림 발송 ────────────────────────────────────────
// 인앱 알림 + 웹 Push + SMS(전화번호 있으면) 동시 발송
// 추가: Coach 중 phone이 등록된 코치에게도 SMS 발송 (인앱 알림은 User 계정이 없으므로 생략)
//
// smsOptions: 템플릿 기반 SMS를 사용할 경우 adminTrigger/coachTrigger + variables 전달
// 미전달 시 기존 하드코딩 방식으로 발송 (하위 호환)
export async function notifyAdmins(
    type: string,
    title: string,
    message: string,
    linkUrl?: string,
    smsOptions?: {
        adminTrigger?: string;      // 관리자용 SMS 템플릿 트리거
        coachTrigger?: string;      // 코치용 SMS 템플릿 트리거
        variables?: Record<string, string>; // 템플릿 변수
        slotKeys?: string[];        // 해당 슬롯 키 — 있으면 담당 코치에게만 SMS, 없으면 전체 코치
    },
) {
    try {
        // ADMIN + VICE_ADMIN 역할 사용자 조회 (phone도 가져옴 — SMS 발송용)
        // 부원장(VICE_ADMIN)도 관리자 알림을 받아야 함
        const admins = await prisma.$queryRawUnsafe<{ id: string; phone: string | null }[]>(
            `SELECT id, phone FROM "User" WHERE role IN ('ADMIN', 'VICE_ADMIN')`
        );

        // 관리자용 SMS 메시지 결정: 템플릿 우선, 없으면 하드코딩 fallback
        let adminSmsMsg: string | null = null;
        if (smsOptions?.adminTrigger && smsOptions.variables) {
            adminSmsMsg = await renderSmsTemplate(smsOptions.adminTrigger, smsOptions.variables);
        }
        // 템플릿이 비활성이거나 없으면 기존 방식 fallback
        const adminFallback = `[STIZ] ${title}\n${message}`;

        for (const admin of admins) {
            // 인앱 알림 + 웹 Push
            await createNotificationRecord({
                userId: admin.id,
                type,
                title,
                message,
                linkUrl,
            });

            // SMS 발송 (전화번호가 있을 때만, 실패해도 무시)
            if (admin.phone) {
                sendSms(admin.phone, adminSmsMsg || adminFallback).catch(() => {});
            }
        }

        // Coach SMS 발송: slotKeys가 있으면 해당 슬롯 담당 코치에게만, 없으면 전체 코치에게
        let coachPhones: string[];
        if (smsOptions?.slotKeys && smsOptions.slotKeys.length > 0) {
            // 슬롯에 배정된 담당 코치의 전화번호만 조회
            coachPhones = await getCoachPhonesBySlotKeys(smsOptions.slotKeys);
        } else {
            // 전체 코치에게 발송 (기존 동작)
            const coaches = await prisma.$queryRawUnsafe<{ phone: string }[]>(
                `SELECT phone FROM "Coach" WHERE phone IS NOT NULL AND phone != ''`
            );
            coachPhones = coaches.map(c => c.phone).filter(Boolean);
        }

        // 코치용 SMS 메시지 결정
        let coachSmsMsg: string | null = null;
        if (smsOptions?.coachTrigger && smsOptions.variables) {
            coachSmsMsg = await renderSmsTemplate(smsOptions.coachTrigger, smsOptions.variables);
        }
        const coachFallback = `[STIZ] ${title}\n${message}`;

        // ADMIN 사용자 phone과 중복되는 번호는 제외 (같은 번호로 두 번 발송 방지)
        const adminPhones = new Set(admins.map(a => a.phone).filter(Boolean));
        for (const phone of coachPhones) {
            if (phone && !adminPhones.has(phone)) {
                sendSms(phone, coachSmsMsg || coachFallback).catch(() => {});
            }
        }
    } catch (e) {
        // 알림 실패가 비즈니스 로직을 중단시키면 안 됨
        console.error("[notifyAdmins] failed:", e);
    }
}

// ── 학부모에게 SMS 직접 발송 (전화번호 기반, 인앱 알림 아님) ─────────────────
// 학부모 PARENT 템플릿 발송용: parentPhone으로 직접 SMS 발송
// 실패해도 메인 로직에 영향 없음 (fire-and-forget)
export async function sendParentSms(
    parentPhone: string,
    trigger: string,
    variables: Record<string, string>,
): Promise<void> {
    try {
        const msg = await renderSmsTemplate(trigger, variables);
        if (msg && parentPhone) {
            sendSms(parentPhone, msg).catch(() => {});
        }
    } catch (e) {
        console.error(`[sendParentSms] trigger=${trigger} failed:`, e);
    }
}

// ── 특정 학생들의 학부모에게 알림 ───────────────────────────────────────────
// admin.ts에서도 사용하던 함수 — 여기로 이동하여 공용화
export async function notifyParentsOfStudents(
    studentIds: string[],
    type: string,
    title: string,
    message: string,
    linkUrl?: string,
) {
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
        console.error("[notifyParentsOfStudents] failed:", e);
    }
}

// ── 모든 학부모에게 알림 (공지사항 등) ──────────────────────────────────────
export async function notifyAllParents(
    type: string,
    title: string,
    message: string,
    linkUrl?: string,
) {
    try {
        const parents = await prisma.$queryRawUnsafe<any[]>(
            `SELECT id FROM "User" WHERE role = 'PARENT'`
        );
        for (const p of parents) {
            await createNotificationRecord({ userId: p.id, type, title, message, linkUrl });
        }
    } catch (e) {
        console.error("[notifyAllParents] failed:", e);
    }
}
