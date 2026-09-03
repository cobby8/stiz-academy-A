import { prisma } from "@/lib/prisma";
import { createHash } from "node:crypto";
import { CHANGE_KIND_LABEL, type ChangeKind } from "@/lib/enrollment/changeRequestRules";
import { computeClassChangeProration, describeProration, type ProrationResult } from "@/lib/enrollment/proration";
import { getMonthlyClassDates, loadAnnualPlanEvents } from "@/lib/enrollment/monthlyClassDates";

// ── 원장의 수강 변경 승인/거절 + 적용일이 된 건 반영 ────────────────────────
//
// 승인은 "예약"이다. 8월에 승인해도 실제 반 이동은 적용일(다음 달 1일)에 일어난다.
// 바로 옮기면 그달 남은 수업의 출석부와 청구가 어긋난다.

export type AdminChangeRequestRow = {
  id: string;
  studentName: string;
  kind: string;
  kindLabel: string;
  fromClassName: string | null;
  toClassName: string | null;
  effectiveFrom: string;
  resumeOn: string | null;
  reason: string | null;
  status: string;
  waitlisted: boolean;
  toClassFull: boolean;
  createdAt: string;
  appliedAt: string | null;
  decisionNote: string | null;
  /** 반 변경일 때만. 계획표 기준 일할 계산 결과와 근거 문장. */
  proration: (ProrationResult & { lines: string[] }) | null;
  /** 이미 발행한 차액 청구서가 있으면 그 id. 두 번 발행을 막는다. */
  invoicedPaymentId: string | null;
  invoicePreviewKey: string;
};

export async function getEnrollmentChangeRequests(status = "PENDING"): Promise<AdminChangeRequestRow[]> {
  const rows = await prisma.$queryRawUnsafe<any[]>(
    // 정원은 신청 당시가 아니라 **지금** 기준으로 다시 센다. 그 사이 자리가 났을 수 있다.
    `SELECT r.id, s.name AS "studentName", s."parentId", r.kind,
            fc.name AS "fromClassName", tc.name AS "toClassName",
            to_char(r."effectiveFrom",'YYYY-MM-DD') AS "effectiveFrom",
            to_char(r."resumeOn",'YYYY-MM-DD') AS "resumeOn",
            r.reason, r.status, r.waitlisted, r."decisionNote", r."invoicedPaymentId",
            r."studentId", r."fromClassId", r."toClassId", fc."dayOfWeek" AS "fromDay", tc."dayOfWeek" AS "toDay",
            fp.price AS "fromFee", tp.price AS "toFee",
            to_char(r."createdAt" AT TIME ZONE 'Asia/Seoul','YYYY-MM-DD HH24:MI') AS "createdAt",
            to_char(r."appliedAt" AT TIME ZONE 'Asia/Seoul','YYYY-MM-DD HH24:MI') AS "appliedAt",
            CASE WHEN tc.id IS NULL THEN false ELSE
              (SELECT count(*) FROM "Enrollment" x WHERE x."classId" = tc.id AND x.status = 'ACTIVE') >= tc.capacity
            END AS "toClassFull"
       FROM "EnrollmentChangeRequest" r
       JOIN "Student" s ON s.id = r."studentId"
       LEFT JOIN "Class" fc ON fc.id = r."fromClassId"
       LEFT JOIN "Class" tc ON tc.id = r."toClassId"
       LEFT JOIN "Program" fp ON fp.id = fc."programId"
       LEFT JOIN "Program" tp ON tp.id = tc."programId"
      WHERE ($1 = 'ALL' OR r.status = $1)
      ORDER BY r."createdAt" DESC
      LIMIT 200`,
    status,
  );
  // 계획표(구글 캘린더)는 한 번만 읽어 모든 건에 재사용한다.
  const needsPlan = rows.some((row) => row.kind === "CLASS_CHANGE" && row.toDay && row.fromDay);
  const planEvents = needsPlan ? await loadAnnualPlanEvents().catch(() => []) : [];

  return rows.map((row) => ({
    id: row.id,
    studentName: row.studentName,
    kind: row.kind,
    kindLabel: CHANGE_KIND_LABEL[row.kind as ChangeKind] ?? row.kind,
    fromClassName: row.fromClassName ?? null,
    toClassName: row.toClassName ?? null,
    effectiveFrom: row.effectiveFrom,
    resumeOn: row.resumeOn ?? null,
    reason: row.reason ?? null,
    status: row.status,
    waitlisted: Boolean(row.waitlisted),
    toClassFull: Boolean(row.toClassFull),
    createdAt: row.createdAt,
    appliedAt: row.appliedAt ?? null,
    decisionNote: row.decisionNote ?? null,
    invoicedPaymentId: row.invoicedPaymentId ?? null,
    invoicePreviewKey: invoicePreviewKey(row, buildProration(row, planEvents)),
    proration: buildProration(row, planEvents),
  }));
}

function invoicePreviewKey(row: any, proration: unknown) {
  return createHash("sha256").update(JSON.stringify({
    requestId: row.id, studentId: row.studentId, parentId: row.parentId, fromClassId: row.fromClassId,
    toClassId: row.toClassId, effectiveFrom: row.effectiveFrom, proration,
  })).digest("hex");
}

/** 반 변경 건의 일할 계산. 계획표를 못 읽었으면 계산 불가로 표시된다(추측하지 않는다). */
function buildProration(row: any, planEvents: any[]): (ProrationResult & { lines: string[] }) | null {
  if (row.kind !== "CLASS_CHANGE" || !row.fromDay || !row.toDay) return null;
  const yearMonth = String(row.effectiveFrom).slice(0, 7);
  const result = computeClassChangeProration({
    effectiveFrom: row.effectiveFrom,
    from: {
      monthlyFee: Number(row.fromFee ?? 0),
      classDates: getMonthlyClassDates(planEvents, yearMonth, row.fromDay),
    },
    to: {
      monthlyFee: Number(row.toFee ?? 0),
      classDates: getMonthlyClassDates(planEvents, yearMonth, row.toDay),
    },
  });
  return {
    ...result,
    lines: describeProration(result, {
      from: row.fromClassName ?? "기존 반",
      to: row.toClassName ?? "새 반",
    }),
  };
}

export async function decideEnrollmentChangeRequest(input: {
  adminUserId: string;
  requestId: string;
  approve: boolean;
  note?: string | null;
}) {
  const note = (input.note ?? "").trim().slice(0, 500) || null;
  const rows = await prisma.$transaction(async (tx) => {
  const decided = await tx.$queryRawUnsafe<any[]>(
    // 결정과 발송 보류 기록은 함께 저장한다.
    `UPDATE "EnrollmentChangeRequest"
        SET status = $2, "decidedByUserId" = $3, "decidedAt" = now(),
            "decisionNote" = $4, "updatedAt" = now()
      WHERE id = $1 AND status = 'PENDING'
      RETURNING id, "studentId", kind, to_char("effectiveFrom",'YYYY-MM-DD') AS "effectiveFrom"`,
    input.requestId, input.approve ? "APPROVED" : "REJECTED", input.adminUserId, note,
  );
  if (decided[0]) await tx.operationsAuditLog.create({ data: {
    action: "ENROLLMENT_CHANGE_NOTIFICATION_HELD", actorType: "ADMIN", actorUserId: input.adminUserId,
    detailsJson: { requestId: input.requestId, studentId: decided[0].studentId,
      kind: decided[0].kind, approved: input.approve, effectiveFrom: decided[0].effectiveFrom,
      notificationStatus: "HELD", reason: "정확한 수신자와 문구 미리보기 승인 필요" },
  }});
  return decided;
  });
  if (!rows[0]) return { ok: false as const, message: "이미 처리된 신청입니다." };

  // 적용일이 이미 지났으면(예: 늦게 승인) 바로 반영한다.
  if (input.approve) await applyDueEnrollmentChanges();
  return { ok: true as const, appliedNow: false, notificationStatus: "HELD" as const };
}

/**
 * 적용일이 된 건은 3개 시스템 검증 대기 원장으로 옮긴다.
 * 사이트만 변경하거나 appliedAt을 먼저 찍지 않는다.
 */
export async function applyDueEnrollmentChanges(): Promise<number> {
  const due = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT id FROM "EnrollmentChangeRequest" r WHERE status = 'APPROVED'
      AND "appliedAt" IS NULL AND "effectiveFrom" <= (now() AT TIME ZONE 'Asia/Seoul')::date
      AND NOT EXISTS (SELECT 1 FROM "OperationsCommand" c
        WHERE c."idempotencyKey" = 'enrollment-change:' || r.id)
      ORDER BY "effectiveFrom" LIMIT 200`,
  );
  for (const candidate of due) {
    try {
    await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRawUnsafe<any[]>(
        `SELECT *, to_char("effectiveFrom", 'YYYY-MM-DD') AS "effectiveDate"
         FROM "EnrollmentChangeRequest" WHERE id = $1 AND status = 'APPROVED'
         AND "appliedAt" IS NULL FOR UPDATE`, candidate.id);
      const row = rows[0];
      if (!row) return;
      const key = `enrollment-change:${row.id}`;
      if (await tx.operationsCommand.findUnique({ where: { idempotencyKey: key } })) return;
      const enrollment = await tx.enrollment.findUnique({ where: { id: row.enrollmentId } });
      const student = await tx.student.findUnique({ where: { id: row.studentId }, select: { parentId: true, name: true } });
      // 본인 자녀로 제출한 동일 요청만 학부모 확인 근거로 인정한다.
      const parentConfirmed = Boolean(student?.parentId && student.parentId === row.requestedByUserId);
      let reason = "시트·Rallyz 반영 및 세 시스템 재조회 승인 대기";
      if (!enrollment || enrollment.studentId !== row.studentId ||
          enrollment.classId !== row.fromClassId || enrollment.status !== "ACTIVE") {
        reason = "신청 이후 현재 수강 상태가 변경됨: 관리자 재확인 필요";
      } else if (row.kind === "CLASS_CHANGE") {
        const target = row.toClassId ? await tx.class.findUnique({
          where: { id: row.toClassId }, include: { program: true, _count: { select: { enrollments: { where: { status: "ACTIVE" } } } } },
        }) : null;
        if (!target || target.program.deletedAt || target.id === row.fromClassId) reason = "희망 반이 유효하지 않음";
        else if (target._count.enrollments >= target.capacity) reason = "희망 반 정원 초과: 관리자 재확인 필요";
      } else if (!["PAUSE", "WITHDRAW"].includes(row.kind)) reason = "지원되지 않는 수강 변경";
      if (!parentConfirmed) reason = "신청 보호자와 현재 학생 연결 재확인 필요";
      const actor = row.decidedByUserId;
      if (!actor) throw new Error("수강 변경 승인자 누락");
      await tx.operationsRequest.create({ data: {
        sourceText: `수강 변경 신청 ${row.id}`, targetMonth: row.effectiveDate.slice(0, 7),
        status: "HELD", requestedByUserId: actor,
        commands: { create: {
          idempotencyKey: key, sourceText: `수강 변경 신청 ${row.id}`,
          studentId: row.studentId, studentName: student?.name ?? null, kind: row.kind, effectiveMonth: row.effectiveDate.slice(0, 7),
          confidence: "HIGH", status: "HELD", holdReason: reason,
          beforeJson: { enrollmentId: row.enrollmentId, classId: enrollment?.classId ?? null, status: enrollment?.status ?? null },
          afterJson: { enrollmentChangeRequestId: row.id, fromClassId: row.fromClassId,
            toClassId: row.toClassId, parentConfirmed, effectiveDate: row.effectiveDate },
          billingStatus: "HELD", notificationStatus: "HELD",
          syncAttempts: { create: ["SHEET", "RALLYZ", "WEBSITE"].map(target => ({ target, status: "PENDING" })) },
        }},
        auditLogs: { create: { action: "ENROLLMENT_CHANGE_SYNC_HELD", actorType: "ADMIN", actorUserId: actor,
          detailsJson: { enrollmentChangeRequestId: row.id, reason } } },
      }});
    });
    } catch {
      // 원장은 원래 신청에서 재시도할 수 있다. 개인정보나 원문 오류는 로그에 남기지 않는다.
      console.error("[applyDueEnrollmentChanges] 운영 원장 등록 실패", candidate.id);
    }
  }
  // 대기 원장 작성은 실제 반영 건수에 포함하지 않는다.
  return 0;
}

/**
 * 반 변경 차액 청구서를 발행한다(원장이 눌러야 발행된다 — 원장 결정).
 *
 * 금액은 화면이 보낸 값을 쓰지 않고 **여기서 다시 계산한다.** 화면 값을 믿으면
 * 브라우저에서 숫자를 바꿔 원하는 금액으로 청구서를 만들 수 있다.
 */
export async function issueProrationInvoice(input: { adminUserId: string; requestId: string; expectedPreviewKey: string }) {
  // 네트워크 일정 조회는 잠금 전에 마치고, 생성과 연결은 하나의 거래로 묶는다.
  const planEvents = await loadAnnualPlanEvents().catch(() => []);
  return prisma.$transaction(async (tx) => {
  const rows = await tx.$queryRawUnsafe<any[]>(
    `SELECT r.id, r.kind, r."studentId", s."parentId", r."fromClassId", r."toClassId", r."invoicedPaymentId", r.status,
            to_char(r."effectiveFrom",'YYYY-MM-DD') AS "effectiveFrom",
            fc.name AS "fromClassName", tc.name AS "toClassName",
            fc."dayOfWeek" AS "fromDay", tc."dayOfWeek" AS "toDay",
            fp.price AS "fromFee", tp.price AS "toFee"
       FROM "EnrollmentChangeRequest" r
       JOIN "Student" s ON s.id = r."studentId"
       LEFT JOIN "Class" fc ON fc.id = r."fromClassId"
       LEFT JOIN "Class" tc ON tc.id = r."toClassId"
       LEFT JOIN "Program" fp ON fp.id = fc."programId"
       LEFT JOIN "Program" tp ON tp.id = tc."programId"
      WHERE r.id = $1 LIMIT 1 FOR UPDATE OF r, s`,
    input.requestId,
  );
  const row = rows[0];
  if (!row) return { ok: false as const, message: "신청을 찾을 수 없습니다." };
  if (row.status !== "APPROVED") return { ok: false as const, message: "승인된 신청만 청구할 수 있습니다." };
  // 두 번 누르면 학부모에게 같은 금액이 두 번 청구된다.
  if (row.invoicedPaymentId) return { ok: false as const, message: "이미 차액 청구서를 발행했습니다." };

  const proration = buildProration(row, planEvents);
  if (!input.expectedPreviewKey || input.expectedPreviewKey !== invoicePreviewKey(row, proration)) {
    return { ok: false as const, message: "미리보기 이후 금액·일정·대상이 변경되었습니다. 새로고침 후 다시 확인해 주세요." };
  }
  if (!proration) return { ok: false as const, message: "반 변경 건만 차액을 청구할 수 있습니다." };
  if (proration.scheduleUnavailable) {
    return { ok: false as const, message: "연간 계획표에 그달 수업일이 없어 자동 계산할 수 없습니다." };
  }
  if (proration.diff <= 0) {
    // 원장 결정: 마이너스는 다음 달 청구에서 차감한다. 환불 청구서를 만들지 않는다.
    return { ok: false as const, message: "추가로 받을 금액이 없습니다. 다음 달 청구에서 차감해 주세요." };
  }

  const [year, month] = proration.yearMonth.split("-").map(Number);
  const description =
    `반 변경 차액 (${proration.yearMonth} · ${row.fromClassName ?? "기존 반"} → ${row.toClassName ?? "새 반"})`;

  const created = await tx.$queryRawUnsafe<{ id: string }[]>(
    // classId 는 비운다. 적용일 전까지 학생은 아직 새 반 소속이 아니라서
    // 반 기준 검증·집계에 잘못 잡힌다. 어느 반 사이인지는 description 에 남긴다.
    `INSERT INTO "Payment" (id, "studentId", "classId", amount, status, "dueDate", year, month, type, description, "createdAt", "updatedAt")
     VALUES (gen_random_uuid()::text, $1, NULL, $2, 'PENDING', $3::timestamp, $4, $5, 'MONTHLY', $6, NOW(), NOW())
     RETURNING id`,
    row.studentId, proration.diff, row.effectiveFrom, year, month, description,
  );

  await tx.$executeRawUnsafe(
    `UPDATE "EnrollmentChangeRequest" SET "invoicedPaymentId" = $2, "updatedAt" = now() WHERE id = $1`,
    input.requestId, created[0].id,
  );

  const invoice = await tx.paymentInvoice.create({ data: {
    paymentId: created[0].id, studentId: row.studentId, parentId: row.parentId,
    invoiceNo: `STIZ-CHANGE-${row.id}`, status: "ISSUED", amount: proration.diff,
    title: description, description,
    dueDate: new Date(`${row.effectiveFrom}T00:00:00+09:00`),
  }});
  await tx.paymentAuditLog.create({ data: {
    paymentId: created[0].id, invoiceId: invoice.id, actorType: "ADMIN", actorId: input.adminUserId,
    action: "ENROLLMENT_PRORATION_INVOICE_ISSUED",
    message: "승인된 미리보기 기준 사이트 차액 청구서 생성. 외부 동기화 및 알림 별도 승인 대기",
    metadata: { requestId: row.id, previewKey: input.expectedPreviewKey, amount: proration.diff,
      notificationStatus: "HELD", sheetStatus: "PENDING", rallyzStatus: "PENDING" },
  }});

  return { ok: true as const, paymentId: created[0].id, amount: proration.diff,
    invoiceId: invoice.id, invoiceStatus: "ISSUED" as const, notificationStatus: "HELD" as const };
  });
}
