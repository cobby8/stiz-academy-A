/**
 * 서버에서 웹 푸시 알림을 발송하는 유틸
 * web-push 라이브러리 사용
 */
import webpush from "web-push";
import { prisma } from "@/lib/prisma";

// VAPID 설정 (환경변수에서 읽음)
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
        "mailto:admin@stiz.kr",  // 연락처 (형식만 맞으면 됨)
        VAPID_PUBLIC_KEY,
        VAPID_PRIVATE_KEY,
    );
}

/**
 * 특정 사용자에게 푸시 알림 발송
 * DB에 저장된 해당 사용자의 모든 구독(기기)에 전송
 */
export async function sendPushToUser(userId: string, payload: {
    title: string;
    body: string;
    url?: string;
    tag?: string;
}) {
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return;

    try {
        // 해당 사용자의 모든 푸시 구독 조회
        const subs = await prisma.$queryRawUnsafe<any[]>(
            `SELECT id, endpoint, p256dh, auth FROM "PushSubscription" WHERE "userId" = $1`,
            userId,
        );

        for (const sub of subs) {
            const pushSubscription = {
                endpoint: sub.endpoint,
                keys: {
                    p256dh: sub.p256dh,
                    auth: sub.auth,
                },
            };

            try {
                await webpush.sendNotification(
                    pushSubscription,
                    JSON.stringify(payload),
                );
            } catch (err: any) {
                // 410 Gone = 구독 만료됨 → DB에서 삭제
                if (err.statusCode === 410 || err.statusCode === 404) {
                    await prisma.$executeRawUnsafe(
                        `DELETE FROM "PushSubscription" WHERE id = $1`, sub.id
                    );
                } else {
                    console.error(`Push to ${sub.endpoint} failed:`, err.message);
                }
            }
        }
    } catch (e) {
        console.error("sendPushToUser error:", e);
    }
}

/**
 * 모든 학부모(PARENT)에게 푸시 알림 발송 — 공지사항 등 전체 대상 알림용
 * 구독(기기)을 단일 쿼리로 모아서 동시에(concurrent) 전송한다.
 * 사용자별로 순차 호출하던 방식(sendPushToUser 반복)의 성능 문제를 해결.
 * 구독이 없거나 VAPID 미설정이면 즉시 아무 것도 하지 않는다.
 */
export async function sendPushToAllParents(payload: {
    title: string;
    body: string;
    url?: string;
    tag?: string;
}) {
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return;

    try {
        // 모든 학부모의 푸시 구독을 한 번에 조회 (JOIN)
        const subs = await prisma.$queryRawUnsafe<any[]>(
            `SELECT ps.id, ps.endpoint, ps.p256dh, ps.auth
             FROM "PushSubscription" ps
             JOIN "User" u ON u.id = ps."userId"
             WHERE u.role = 'PARENT'`,
        );
        if (subs.length === 0) return;

        const body = JSON.stringify(payload);
        // 동시 전송 — 하나가 실패해도 나머지에 영향 없음
        await Promise.allSettled(
            subs.map(async (sub) => {
                try {
                    await webpush.sendNotification(
                        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                        body,
                    );
                } catch (err: any) {
                    // 410 Gone / 404 = 만료된 구독 → 정리
                    if (err.statusCode === 410 || err.statusCode === 404) {
                        await prisma.$executeRawUnsafe(
                            `DELETE FROM "PushSubscription" WHERE id = $1`, sub.id,
                        );
                    }
                }
            }),
        );
    } catch (e) {
        console.error("sendPushToAllParents error:", e);
    }
}
