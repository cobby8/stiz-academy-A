/**
 * 알림 통합 유틸 — DB 인앱 알림 + 웹 Push + SMS 발송을 한 곳에서 관리
 *
 * admin.ts에 있던 createNotificationRecord를 공용으로 분리.
 * public.ts (비로그인 신청)에서도 관리자 알림을 보낼 수 있도록.
 */

import { prisma } from "@/lib/prisma";
import { sendPushToUser } from "@/lib/pushNotification";
import { sendSms } from "@/lib/sms";

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
export async function notifyAdmins(
    type: string,
    title: string,
    message: string,
    linkUrl?: string,
) {
    try {
        // ADMIN 역할 사용자 조회 (phone도 가져옴 — SMS 발송용)
        const admins = await prisma.$queryRawUnsafe<{ id: string; phone: string | null }[]>(
            `SELECT id, phone FROM "User" WHERE role = 'ADMIN'`
        );

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
                sendSms(admin.phone, `[STIZ] ${title}\n${message}`).catch(() => {});
            }
        }

        // Coach 중 phone이 있는 코치에게도 SMS 발송 (User 계정이 없으므로 인앱 알림은 불가)
        const coaches = await prisma.$queryRawUnsafe<{ phone: string }[]>(
            `SELECT phone FROM "Coach" WHERE phone IS NOT NULL AND phone != ''`
        );
        // ADMIN 사용자 phone과 중복되는 번호는 제외 (같은 번호로 두 번 발송 방지)
        const adminPhones = new Set(admins.map(a => a.phone).filter(Boolean));
        for (const coach of coaches) {
            if (coach.phone && !adminPhones.has(coach.phone)) {
                sendSms(coach.phone, `[STIZ] ${title}\n${message}`).catch(() => {});
            }
        }
    } catch (e) {
        // 알림 실패가 비즈니스 로직을 중단시키면 안 됨
        console.error("[notifyAdmins] failed:", e);
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
