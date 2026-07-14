import { prisma } from "@/lib/prisma";
import { sendPushToUser, type PushDeliveryResult } from "@/lib/pushNotification";

export type ParentRecipient = {
  studentId: string;
  studentName: string;
  userId: string;
};

export type ParentNotificationResult = {
  sent: boolean;
  duplicate: boolean;
  inAppCreated: boolean;
  push: PushDeliveryResult | null;
};

export async function getClassParentRecipients(classId: string, studentIds?: string[]) {
  return prisma.$queryRawUnsafe<ParentRecipient[]>(
    `SELECT DISTINCT s.id AS "studentId", s.name AS "studentName", s."parentId" AS "userId"
     FROM "Enrollment" e
     JOIN "Student" s ON s.id = e."studentId"
     WHERE e."classId" = $1 AND e.status = 'ACTIVE'
       AND ($2::text[] IS NULL OR s.id = ANY($2::text[]))
       AND s."parentId" IS NOT NULL`,
    classId,
    studentIds?.length ? studentIds : null,
  );
}

/** 앱 알림과 푸시를 서로 다른 장부 행으로 기록해 채널별 실제 결과를 보존합니다. */
export async function deliverParentNotification(input: {
  eventType: string;
  dedupeKey: string;
  recipient: ParentRecipient;
  title: string;
  message: string;
  linkUrl: string;
  sessionId?: string;
  attendanceId?: string;
  noticeId?: string;
}): Promise<ParentNotificationResult> {
  const inAppClaimed = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `WITH delivery AS (
       INSERT INTO "NotificationDelivery" (
         id, "eventType", "sessionId", "attendanceId", "noticeId", "studentId",
         "recipientUserId", channel, "dedupeKey", status, "attemptCount", "sentAt", "createdAt", "updatedAt"
       ) VALUES (
         gen_random_uuid()::text, $1, $2, $3, $4, $5, $6,
         'IN_APP', $7, 'SENT', 1, NOW(), NOW(), NOW()
       ) ON CONFLICT ("dedupeKey") DO NOTHING
       RETURNING id
     ), notification AS (
       INSERT INTO "Notification" (id, "userId", type, title, message, "linkUrl", "isRead", "createdAt")
       SELECT gen_random_uuid()::text, $6, $1, $8, $9, $10, false, NOW()
       FROM delivery
     ) SELECT id FROM delivery`,
    input.eventType,
    input.sessionId ?? null,
    input.attendanceId ?? null,
    input.noticeId ?? null,
    input.recipient.studentId,
    input.recipient.userId,
    input.dedupeKey,
    input.title,
    input.message,
    input.linkUrl,
  );

  const pushClaimed = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `INSERT INTO "NotificationDelivery" (
       id, "eventType", "sessionId", "attendanceId", "noticeId", "studentId",
       "recipientUserId", channel, "dedupeKey", status, "attemptCount", "createdAt", "updatedAt"
     ) VALUES (
       gen_random_uuid()::text, $1, $2, $3, $4, $5, $6,
       'PUSH', $7, 'PENDING', 1, NOW(), NOW()
     ) ON CONFLICT ("dedupeKey") DO NOTHING
     RETURNING id`,
    input.eventType,
    input.sessionId ?? null,
    input.attendanceId ?? null,
    input.noticeId ?? null,
    input.recipient.studentId,
    input.recipient.userId,
    `${input.dedupeKey}:push`,
  );

  // 두 장부가 모두 이미 있으면 같은 이벤트의 재호출이므로 다시 발송하지 않습니다.
  if (!pushClaimed[0]) {
    return {
      sent: false,
      duplicate: !inAppClaimed[0],
      inAppCreated: Boolean(inAppClaimed[0]),
      push: null,
    };
  }

  try {
    const push = await sendPushToUser(input.recipient.userId, {
      title: input.title,
      body: input.message,
      url: input.linkUrl,
      tag: input.eventType,
    });
    const deliveryStatus =
      push.status === "SENT"
        ? "SENT"
        : push.status === "PARTIAL"
          ? "PARTIAL"
        : push.status === "NO_SUBSCRIPTION" || push.status === "NOT_CONFIGURED"
          ? "SKIPPED"
          : "FAILED";
    const errorCode = push.status === "SENT" ? null : push.errorCode ?? push.status;

    await prisma.$executeRawUnsafe(
      `UPDATE "NotificationDelivery"
       SET status = $2,
           "sentAt" = CASE WHEN $2 IN ('SENT', 'PARTIAL') THEN NOW() ELSE NULL END,
           "failedAt" = CASE WHEN $2 IN ('FAILED', 'PARTIAL') THEN NOW() ELSE NULL END,
           "errorCode" = $3,
           "updatedAt" = NOW()
       WHERE id = $1`,
      pushClaimed[0].id,
      deliveryStatus,
      errorCode,
    );
    return {
      sent: push.sentCount > 0,
      duplicate: false,
      inAppCreated: Boolean(inAppClaimed[0]),
      push,
    };
  } catch (error) {
    const errorCode = error instanceof Error ? error.message.slice(0, 200) : "PUSH_FAILED";
    await prisma.$executeRawUnsafe(
      `UPDATE "NotificationDelivery"
       SET status = 'FAILED', "failedAt" = NOW(), "errorCode" = $2, "updatedAt" = NOW()
       WHERE id = $1`,
      pushClaimed[0].id,
      errorCode,
    );
    return {
      sent: false,
      duplicate: false,
      inAppCreated: Boolean(inAppClaimed[0]),
      push: {
        status: "FAILED",
        subscriptionCount: 0,
        sentCount: 0,
        failedCount: 1,
        removedCount: 0,
        errorCode,
      },
    };
  }
}
