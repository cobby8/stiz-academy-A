"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireStaffClassAccess } from "@/lib/staff-class-access";

type SessionStartRow = {
  id: string;
  classId: string;
  status: string;
  startedAt: Date | string | null;
};

export type StartClassSessionResult =
  | {
      ok: true;
      sessionId: string;
      classId: string;
      status: "IN_PROGRESS";
      startedAt: string;
      resumed: boolean;
    }
  | {
      ok: false;
      code: "INVALID_INPUT" | "FORBIDDEN" | "COMPLETED" | "DB_NOT_READY" | "UNKNOWN";
      message: string;
    };

function isValidDateKey(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

function toIsoString(value: Date | string | null) {
  if (!value) throw new Error("수업 시작 시각이 기록되지 않았습니다.");
  return new Date(value).toISOString();
}

function isLifecycleSchemaMissing(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("sessionKey") ||
    message.includes("startedAt") ||
    message.includes("startedByUserId") ||
    message.includes('column "status"')
  );
}

/**
 * 확인 모달의 '수업 시작' 버튼이 호출하는 서버 기능입니다.
 * 휴대폰 시간이 아니라 DB의 NOW()를 기록해 모든 기기에서 같은 스톱워치 기준을 사용합니다.
 */
export async function startClassSession(input: {
  classId: string;
  date: string;
}): Promise<StartClassSessionResult> {
  const classId = input.classId?.trim();
  const date = input.date?.trim();

  if (!classId || !isValidDateKey(date)) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: "수업과 날짜 정보를 다시 확인해 주세요.",
    };
  }

  try {
    // 화면에서 다른 수업 ID를 보내더라도 서버에서 담당 수업인지 다시 검사합니다.
    const access = await requireStaffClassAccess(classId);
    const sessionKey = `${classId}:${date}`;

    // 첫 요청만 새 Session을 만듭니다. 같은 키의 재요청은 아무것도 생성하지 않습니다.
    const inserted = await prisma.$queryRawUnsafe<SessionStartRow[]>(
      `INSERT INTO "Session" (
         id, "classId", date, "sessionKey", status, "coachId",
         "startedAt", "startedByUserId", "createdAt", "updatedAt"
       )
       VALUES (
         gen_random_uuid()::text, $1, $2::date, $3, 'IN_PROGRESS', $4,
         NOW(), $5, NOW(), NOW()
       )
       ON CONFLICT ("sessionKey") DO NOTHING
       RETURNING id, "classId", status, "startedAt"`,
      classId,
      date,
      sessionKey,
      access.coachId,
      access.staff.appUserId,
    );

    if (inserted[0]) {
      revalidatePath("/staff");
      return {
        ok: true,
        sessionId: inserted[0].id,
        classId: inserted[0].classId,
        status: "IN_PROGRESS",
        startedAt: toIsoString(inserted[0].startedAt),
        resumed: false,
      };
    }

    // 사전에 작성된 PLANNED Session이 있으면 시작 상태로 한 번만 변경합니다.
    const started = await prisma.$queryRawUnsafe<SessionStartRow[]>(
      `UPDATE "Session"
       SET status = 'IN_PROGRESS',
           "startedAt" = COALESCE("startedAt", NOW()),
           "startedByUserId" = COALESCE("startedByUserId", $2),
           "coachId" = COALESCE("coachId", $3),
           "updatedAt" = NOW()
       WHERE "sessionKey" = $1
         AND status = 'PLANNED'
       RETURNING id, "classId", status, "startedAt"`,
      sessionKey,
      access.staff.appUserId,
      access.coachId,
    );

    if (started[0]) {
      revalidatePath("/staff");
      return {
        ok: true,
        sessionId: started[0].id,
        classId: started[0].classId,
        status: "IN_PROGRESS",
        startedAt: toIsoString(started[0].startedAt),
        resumed: false,
      };
    }

    // 빠른 중복 클릭이면 최초 시작 시각을 유지한 채 기존 수업으로 복귀합니다.
    const existing = await prisma.$queryRawUnsafe<SessionStartRow[]>(
      `SELECT id, "classId", status, "startedAt"
       FROM "Session"
       WHERE "sessionKey" = $1
       LIMIT 1`,
      sessionKey,
    );

    if (existing[0]?.status === "IN_PROGRESS") {
      return {
        ok: true,
        sessionId: existing[0].id,
        classId: existing[0].classId,
        status: "IN_PROGRESS",
        startedAt: toIsoString(existing[0].startedAt),
        resumed: true,
      };
    }

    if (existing[0]?.status === "COMPLETED") {
      return {
        ok: false,
        code: "COMPLETED",
        message: "이미 종료된 수업입니다.",
      };
    }

    return {
      ok: false,
      code: "UNKNOWN",
      message: "수업을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    };
  } catch (error) {
    if (isLifecycleSchemaMissing(error)) {
      return {
        ok: false,
        code: "DB_NOT_READY",
        message: "수업 시작 기능을 준비 중입니다. 관리자에게 문의해 주세요.",
      };
    }

    const message = error instanceof Error ? error.message : "수업 시작 권한을 확인하지 못했습니다.";
    const isPermissionError =
      message.includes("담당 수업") ||
      message.includes("코치 정보") ||
      message.includes("권한") ||
      message.includes("permission");

    if (isPermissionError) {
      return { ok: false, code: "FORBIDDEN", message };
    }

    console.error("[startClassSession] failed:", error);
    return {
      ok: false,
      code: "UNKNOWN",
      message: "수업을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    };
  }
}
