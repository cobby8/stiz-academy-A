import { prisma } from "@/lib/prisma";
import { sendPushToUser } from "@/lib/pushNotification";

export type ParentRecipient = {
  studentId: string;
  studentName: string;
  userId: string;
};

export async function getClassParentRecipients(classId: string, studentIds?: string[]) {
  const rows = await prisma.$queryRawUnsafe<ParentRecipient[]>(
    `SELECT DISTINCT s.id AS "studentId", s.name AS "studentName", s."parentId" AS "userId"
     FROM "Enrollment" e
     JOIN "Student" s ON s.id = e."studentId"
     WHERE e."classId" = $1 AND e.status = 'ACTIVE'
       AND ($2::text[] IS NULL OR s.id = ANY($2::text[]))
       AND s."parentId" IS NOT NULL`,
    classId,
    studentIds?.length ? studentIds : null,
  );
  return rows;
}

/** DB의 고유 dedupeKey를 먼저 선점한 요청만 앱 알림과 푸시를 발송합니다. */
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
}) {
  const claimed = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `WITH delivery AS (
       INSERT INTO "NotificationDelivery" (
         id, "eventType", "sessionId", "attendanceId", "noticeId", "studentId",
         "recipientUserId", channel, "dedupeKey", status, "attemptCount", "createdAt", "updatedAt"
       ) VALUES (
         gen_random_uuid()::text, $1, $2, $3, $4, $5, $6,
         'IN_APP', $7, 'PENDING', 1, NOW(), NOW()
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

  if (!claimed[0]) return { sent: false, duplicate: true };

  try {
    await sendPushToUser(input.recipient.userId, {
      title: input.title,
      body: input.message,
      url: input.linkUrl,
      tag: input.eventType,
    });
    await prisma.$executeRawUnsafe(
      `UPDATE "NotificationDelivery" SET status = 'SENT', "sentAt" = NOW(), "updatedAt" = NOW() WHERE id = $1`,
      claimed[0].id,
    );
    return { sent: true, duplicate: false };
  } catch (error) {
    await prisma.$executeRawUnsafe(
      `UPDATE "NotificationDelivery" SET status = 'FAILED', "failedAt" = NOW(), "errorCode" = $2, "updatedAt" = NOW() WHERE id = $1`,
      claimed[0].id,
      error instanceof Error ? error.message.slice(0, 200) : "PUSH_FAILED",
    );
    return { sent: false, duplicate: false };
  }
}
