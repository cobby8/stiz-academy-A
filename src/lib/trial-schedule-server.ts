import { prisma } from "@/lib/prisma";
import { resolveTrialScheduleFromRow, type TrialScheduleResolutionRow } from "@/lib/trial-schedule-time";
import { formatTrialSmsDateTime } from "@/lib/trial-sms-time";

export class TrialScheduleResolutionError extends Error {}

export async function resolveCanonicalTrialSchedule(input: { selectedDate: string; slotKey: string; scheduledClassId?: string | null }) {
  const rows = await prisma.$queryRawUnsafe<TrialScheduleResolutionRow[]>(
    `SELECT o."startTimeOverride" AS "overrideStart",o."isHidden" AS "overrideHidden",
            ss."startTime" AS "scheduleStart",ss."dayKey" AS "scheduleDay",ss."isHidden" AS "scheduleHidden",
            ss."activeFrom" AS "scheduleActiveFrom",ss."activeTo" AS "scheduleActiveTo",
            cs."startTime" AS "customStart",cs."dayKey" AS "customDay",cs."isHidden" AS "customHidden",
            c."startTime" AS "classStart",c."dayOfWeek" AS "classDay",c."slotKey" AS "classSlotKey",c.name AS "className"
       FROM (SELECT $1::text AS "slotKey") key
       LEFT JOIN "ClassSlotOverride" o ON o."slotKey"=key."slotKey"
       LEFT JOIN "ScheduleSlot" ss ON ss."slotKey"=key."slotKey"
       LEFT JOIN "CustomClassSlot" cs ON (cs.id=key."slotKey" OR ('custom-' || cs.id)=key."slotKey")
       LEFT JOIN LATERAL (
         SELECT name,"startTime","dayOfWeek","slotKey" FROM "Class"
          WHERE ($2::text IS NOT NULL AND id=$2) OR ($2::text IS NULL AND "slotKey"=key."slotKey")
          ORDER BY CASE WHEN id=$2 THEN 0 ELSE 1 END,id LIMIT 1
       ) c ON true`, input.slotKey.trim(), input.scheduledClassId || null,
  );
  if (!rows[0]) throw new TrialScheduleResolutionError("수업 시간표를 찾지 못했습니다.");
  try {
    const resolved = resolveTrialScheduleFromRow(rows[0], input);
    return { ...resolved, formattedDate: formatTrialSmsDateTime(resolved.scheduledDate) };
  } catch (error) {
    throw new TrialScheduleResolutionError(error instanceof Error ? error.message : "체험 시간을 확정할 수 없습니다.");
  }
}
