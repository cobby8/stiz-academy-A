"use server";

import { prisma } from "@/lib/prisma";
import { requireStaffClassAccess } from "@/lib/staff-class-access";
import { deliverParentNotification, getClassParentRecipients } from "@/lib/staff-notifications";
import { getStaffClassContacts } from "@/lib/staff-contacts";

export async function loadStaffClassContacts(classId: string) {
  return getStaffClassContacts(classId);
}

export async function createStaffClassNotice(input: { classId: string; title: string; content: string }) {
  const classId = input.classId.trim();
  const title = input.title.trim();
  const content = input.content.trim();
  if (!classId || !title || !content) return { ok: false as const, message: "공지 제목과 내용을 입력해 주세요." };

  const access = await requireStaffClassAccess(classId);
  const notices = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `INSERT INTO "Notice" (id, "authorUserId", title, content, "targetType", "targetClassIds", "sentAt", "createdAt", "updatedAt")
     VALUES (gen_random_uuid()::text, $1, $2, $3, 'CLASS', $4, NOW(), NOW(), NOW()) RETURNING id`,
    access.staff.appUserId, title, content, JSON.stringify([classId]),
  );
  const noticeId = notices[0].id;
  const recipients = await getClassParentRecipients(classId);
  const deliveries = await Promise.all(recipients.map((recipient) => deliverParentNotification({
    eventType: "CLASS_NOTICE",
    dedupeKey: `notice:${noticeId}:student:${recipient.studentId}:user:${recipient.userId}`,
    recipient,
    title,
    message: content,
    linkUrl: "/notices",
    noticeId,
  })));
  const pushSentCount = deliveries.filter((delivery) => delivery.sent).length;
  const inAppCreatedCount = deliveries.filter((delivery) => delivery.inAppCreated).length;
  const duplicateCount = deliveries.filter((delivery) => delivery.duplicate).length;
  const noSubscriptionCount = deliveries.filter(
    (delivery) => delivery.push?.status === "NO_SUBSCRIPTION",
  ).length;
  const pushFailedCount = deliveries.filter(
    (delivery) => delivery.push?.status === "FAILED" || delivery.push?.status === "PARTIAL",
  ).length;
  const pushSkippedCount = deliveries.filter(
    (delivery) => delivery.push?.status === "NOT_CONFIGURED",
  ).length;

  return {
    ok: true as const,
    noticeId,
    recipientCount: recipients.length,
    inAppCreatedCount,
    pushSentCount,
    pushFailedCount,
    pushSkippedCount,
    noSubscriptionCount,
    duplicateCount,
  };
}
