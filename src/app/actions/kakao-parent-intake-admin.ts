"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { operationsRequestKey, SYNC_TARGETS, type OperationsKind } from "@/lib/operationsSync";
import { ensureOperationsSyncInfrastructure } from "@/lib/operationsSyncInfrastructure";

export type KakaoIntakeDecision = "TRANSFER" | "NEEDS_DETAILS" | "REJECT" | "CONSULTATION";

const REVIEWABLE_STATUSES = ["SUBMITTED", "HELD", "FAILED", "NEEDS_DETAILS"] as const;

const OPERATIONS_KIND: Record<string, OperationsKind | null> = {
  PAUSE: "PAUSE",
  WITHDRAW: "WITHDRAW",
  RESUME: "RESUME",
  CLASS_CHANGE: "CLASS_CHANGE",
  CLASS_ADD: "CLASS_ADD",
  SHUTTLE_START_STOP: "SHUTTLE_CHANGE",
  SHUTTLE_CHANGE: "SHUTTLE_CHANGE",
  SHUTTLE_FEE: "SHUTTLE_EXEMPT",
  CONTACT_CHANGE: "CONTACT_UPDATE",
  BILLING_CORRECTION: "BILLING_CORRECTION",
};

type IntakeForReview = {
  id: string;
  kind: string;
  sourceText: string;
  status: string;
  studentId: string | null;
  studentName: string | null;
  parentUserId: string | null;
  identityStatus: string;
  structuredJson: Record<string, unknown> | null;
  targetMonth: string;
  operationsRequestId: string | null;
};

function cleanNote(value: string | undefined) {
  const note = (value ?? "").trim();
  if (note.length > 500) throw new Error("검토 메모는 500자 이하로 입력해 주세요.");
  return note;
}

function nonTransferStatus(decision: Exclude<KakaoIntakeDecision, "TRANSFER">) {
  if (decision === "NEEDS_DETAILS") return "NEEDS_DETAILS";
  if (decision === "REJECT") return "REJECTED";
  return "CONSULTATION";
}

export async function decideKakaoParentIntake(input: {
  intakeId: string;
  decision: KakaoIntakeDecision;
  note?: string;
}) {
  const admin = await requireAdmin();
  const note = cleanNote(input.note);
  if (!input.intakeId) return { ok: false as const, message: "요청을 찾지 못했습니다." };
  if (input.decision !== "TRANSFER" && !note) {
    return { ok: false as const, message: "보류·거절·상담 전환 사유를 입력해 주세요." };
  }

  await ensureOperationsSyncInfrastructure();
  const rows = await prisma.$queryRawUnsafe<IntakeForReview[]>(
    `SELECT r.id,r.kind,r."sourceText",r.status,r."studentId",r."structuredJson",
            r."operationsRequestId",i."parentUserId",i.status AS "identityStatus",
            s.name AS "studentName",
            to_char(r."createdAt" AT TIME ZONE 'Asia/Seoul','YYYY-MM') AS "targetMonth"
       FROM "KakaoParentIntake" r
       JOIN "KakaoParentIdentity" i ON i.id=r."identityId"
       LEFT JOIN "Student" s ON s.id=r."studentId" AND s."mergedIntoStudentId" IS NULL
      WHERE r.id=$1 LIMIT 1`,
    input.intakeId,
  );
  const intake = rows[0];
  if (!intake) return { ok: false as const, message: "요청을 찾지 못했습니다." };
  if (!REVIEWABLE_STATUSES.includes(intake.status as (typeof REVIEWABLE_STATUSES)[number])) {
    return { ok: false as const, message: "이미 처리됐거나 다른 관리자가 검토 중인 요청입니다." };
  }

  if (input.decision !== "TRANSFER") {
    const nextStatus = nonTransferStatus(input.decision);
    const changed = await prisma.$transaction(async (tx) => {
      const claimed = await tx.$executeRawUnsafe(
        `UPDATE "KakaoParentIntake"
            SET status=$2,"decidedByUserId"=$3,"decidedAt"=now(),"decisionNote"=$4,"updatedAt"=now()
          WHERE id=$1 AND status = ANY($5::text[])`,
        intake.id, nextStatus, admin.appUserId, note, [...REVIEWABLE_STATUSES],
      );
      if (claimed !== 1) return false;
      await tx.$executeRawUnsafe(
        `INSERT INTO "KakaoParentIntakeAudit"
          (id,"intakeId",action,"actorUserId","fromStatus","toStatus",note,"detailsJson")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)`,
        crypto.randomUUID(), intake.id, input.decision, admin.appUserId, intake.status, nextStatus, note,
        JSON.stringify({ externalMessageSent: false, operationsCreated: false }),
      );
      return true;
    });
    if (!changed) return { ok: false as const, message: "다른 관리자가 먼저 처리했습니다. 새로고침해 주세요." };
    revalidatePath("/admin/kakao-requests");
    return { ok: true as const, status: nextStatus };
  }

  if (intake.identityStatus !== "ACTIVE" || !intake.parentUserId) {
    return { ok: false as const, message: "최초 인증이 완료된 보호자 요청만 운영 원장으로 이관할 수 있습니다." };
  }
  if (!intake.studentId || !intake.studentName) {
    return { ok: false as const, message: "학생 안정 ID를 확인한 뒤 이관해 주세요." };
  }
  const structuredStudentId = typeof intake.structuredJson?.studentId === "string" ? intake.structuredJson.studentId : "";
  if (structuredStudentId !== intake.studentId) {
    return { ok: false as const, message: "대화에서 선택한 학생과 저장된 학생 ID가 일치하지 않습니다." };
  }
  const operationsKind = OPERATIONS_KIND[intake.kind];
  if (!operationsKind) {
    return { ok: false as const, message: "이 요청은 전용 화면 처리 또는 상담 전환이 필요합니다." };
  }

  const requestId = crypto.randomUUID();
  const commandId = crypto.randomUUID();
  const holdReason = "카카오 자유문장에서 적용일·반·셔틀 방향 등 필수값을 관리자 확인해야 합니다.";
  const idempotencyKey = operationsRequestKey({
    sourceText: intake.sourceText,
    studentName: intake.studentName,
    kind: operationsKind,
    effectiveMonth: intake.targetMonth,
    scope: `KAKAO_INTAKE:${intake.id}`,
  });

  const created = await prisma.$transaction(async (tx) => {
    const claimed = await tx.$executeRawUnsafe(
      `UPDATE "KakaoParentIntake"
          SET status='PROCESSING',"updatedAt"=now()
        WHERE id=$1 AND status = ANY($2::text[]) AND "operationsRequestId" IS NULL`,
      intake.id, [...REVIEWABLE_STATUSES],
    );
    if (claimed !== 1) return false;
    await tx.$executeRawUnsafe(
      `INSERT INTO "OperationsRequest" (id,"sourceText","targetMonth",status,"requestedByUserId","submittedAt")
       VALUES ($1,$2,$3,'DRAFT',$4,now())`,
      requestId, intake.sourceText, intake.targetMonth, admin.appUserId,
    );
    await tx.$executeRawUnsafe(
      `INSERT INTO "OperationsCommand"
        (id,"requestId","idempotencyKey","sourceText","studentId","studentName",kind,"effectiveMonth",confidence,status,"holdReason","afterJson","billingStatus","notificationStatus")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'LOW','HELD',$9,$10::jsonb,'HELD','HELD')`,
      commandId, requestId, idempotencyKey, intake.sourceText, intake.studentId, intake.studentName,
      operationsKind, intake.targetMonth, holdReason,
      JSON.stringify({ source: "KAKAO", intakeId: intake.id, parentConfirmed: true, structured: intake.structuredJson ?? {} }),
    );
    for (const target of SYNC_TARGETS) {
      await tx.$executeRawUnsafe(
        `INSERT INTO "OperationsSyncAttempt" (id,"commandId",target,status) VALUES ($1,$2,$3,'PENDING')`,
        crypto.randomUUID(), commandId, target,
      );
    }
    await tx.$executeRawUnsafe(
      `UPDATE "KakaoParentIntake"
          SET status='APPROVED',"decidedByUserId"=$2,"decidedAt"=now(),"decisionNote"=$3,
              "operationsRequestId"=$4,"updatedAt"=now()
        WHERE id=$1 AND status='PROCESSING'`,
      intake.id, admin.appUserId, note || null, requestId,
    );
    await tx.$executeRawUnsafe(
      `INSERT INTO "KakaoParentIntakeAudit"
        (id,"intakeId",action,"actorUserId","fromStatus","toStatus",note,"detailsJson")
       VALUES ($1,$2,'TRANSFER',$3,$4,'APPROVED',$5,$6::jsonb)`,
      crypto.randomUUID(), intake.id, admin.appUserId, intake.status, note || null,
      JSON.stringify({ operationsRequestId: requestId, commandStatus: "HELD", externalWrites: false, notificationsSent: false }),
    );
    await tx.$executeRawUnsafe(
      `INSERT INTO "OperationsAuditLog" (id,"requestId",action,"actorType","actorUserId","detailsJson")
       VALUES ($1,$2,'KAKAO_INTAKE_TRANSFERRED','ADMIN',$3,$4::jsonb)`,
      crypto.randomUUID(), requestId, admin.appUserId,
      JSON.stringify({ intakeId: intake.id, commandStatus: "HELD", externalWrites: false, notificationsSent: false }),
    );
    return true;
  });
  if (!created) return { ok: false as const, message: "다른 관리자가 먼저 처리했습니다. 새로고침해 주세요." };

  revalidatePath("/admin/kakao-requests");
  revalidatePath("/admin/operations-sync");
  return { ok: true as const, status: "APPROVED", operationsRequestId: requestId };
}
