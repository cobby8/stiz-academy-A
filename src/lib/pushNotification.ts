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
