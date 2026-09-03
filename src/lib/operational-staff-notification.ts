import { createNotificationRecord } from "@/lib/notification";
import { prisma } from "@/lib/prisma";

export type OperationalRecipientSummary = {
  admin: "NOTIFIED" | "NOT_FOUND";
  coach: "NOTIFIED" | "NOT_FOUND" | "NOT_APPLICABLE";
  driver: "NOTIFIED" | "NOT_FOUND" | "NOT_APPLICABLE";
  recipientCount: number;
};

type Recipient = { id: string; role: string };

async function resolveRecipients(input: { classId?: string; includeCoach: boolean; includeDriver: boolean }) {
  return prisma.$queryRawUnsafe<Recipient[]>(
    `WITH recipients AS (
       SELECT u.id, u.role::text AS role FROM "User" u WHERE u.role IN ('ADMIN','VICE_ADMIN')
       UNION
       SELECT u.id, u.role::text AS role FROM "Class" c
         JOIN "User" u ON u.id=c."instructorId" AND u.role='INSTRUCTOR'
        WHERE $1::boolean AND c.id=$2
       UNION
       SELECT u.id, u.role::text AS role FROM "Class" c
         JOIN "ScheduleSlot" ss ON ss."slotKey"=c."slotKey"
         JOIN "Coach" co ON co.id=ss."coachId"
         JOIN "User" u ON u.id=co."userId" AND u.role='INSTRUCTOR'
        WHERE $1::boolean AND c.id=$2
       UNION
       SELECT u.id, u.role::text AS role FROM "Class" c
         JOIN "ClassSlotOverride" o ON o."slotKey"=c."slotKey"
         JOIN "Coach" co ON co.id=o."coachId"
         JOIN "User" u ON u.id=co."userId" AND u.role='INSTRUCTOR'
        WHERE $1::boolean AND c.id=$2
       UNION
       SELECT u.id, u.role::text AS role FROM "User" u
        WHERE $3::boolean AND u.role='DRIVER'
     ) SELECT DISTINCT id, role FROM recipients`,
    input.includeCoach,
    input.classId ?? null,
    input.includeDriver,
  );
}

/** 원장·담당 코치·기사 계정에 인앱 알림을 만들고 웹 푸시를 시도한다. */
export async function notifyOperationalStaff(input: {
  type: string;
  title: string;
  message: string;
  linkUrl: string;
  staffLinkUrl?: string;
  classId?: string;
  includeCoach?: boolean;
  includeDriver?: boolean;
}): Promise<OperationalRecipientSummary> {
  const includeCoach = input.includeCoach === true;
  const includeDriver = input.includeDriver === true;
  const recipients = await resolveRecipients({ classId: input.classId, includeCoach, includeDriver });

  await Promise.all(recipients.map((recipient) => createNotificationRecord({
    userId: recipient.id,
    type: input.type,
    title: input.title,
    message: input.message,
    linkUrl: recipient.role === "ADMIN" || recipient.role === "VICE_ADMIN"
      ? input.linkUrl
      : (input.staffLinkUrl ?? input.linkUrl),
  })));

  const roles = new Set(recipients.map((recipient) => recipient.role));
  return {
    admin: roles.has("ADMIN") || roles.has("VICE_ADMIN") ? "NOTIFIED" : "NOT_FOUND",
    coach: includeCoach ? (roles.has("INSTRUCTOR") ? "NOTIFIED" : "NOT_FOUND") : "NOT_APPLICABLE",
    driver: includeDriver ? (roles.has("DRIVER") ? "NOTIFIED" : "NOT_FOUND") : "NOT_APPLICABLE",
    recipientCount: recipients.length,
  };
}
