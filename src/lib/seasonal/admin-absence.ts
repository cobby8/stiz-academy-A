import { prisma } from "@/lib/prisma";
import { REASON_LABEL } from "@/lib/seasonal/parentAbsenceRules";
import {
  RESOLUTION_LABEL,
  ABSENCE_STATUS_LABEL,
  perSessionAmount,
} from "@/lib/seasonal/adminAbsenceRules";

// ── 방학특강 "관리자 결석 신고 처리" 조회 (4a-2 Step 3) ─────────────────────
// 학부모가 신고한 결석 건(SpecialProgramAbsence)을 관리자가 검토·처리방식 변경·확정하는
// 화면에 필요한 목록을 만든다. 읽기 전용(DB 무변경). 인증은 소비하는 서버 액션/페이지가
// requireAdmin 으로 처리하고, 여기서는 시즌 스코프로만 조회한다(IDOR 무관 — 관리자 전용).

// 회차 날짜 라벨: "7/28(화) 15:00"
function seoulDateTimeLabel(value: Date | string | null) {
  if (!value) return null;
  const d = typeof value === "string" ? new Date(value) : value;
  const f = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "numeric",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  return `${Number(p.month)}/${Number(p.day)}(${(p.weekday || "").replace("요일", "")}) ${p.hour}:${p.minute}`;
}

// 신고일 라벨: "7/25 14:03"
function seoulReportedLabel(value: Date | string | null) {
  if (!value) return null;
  const d = typeof value === "string" ? new Date(value) : value;
  const f = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  return `${Number(p.month)}/${Number(p.day)} ${p.hour}:${p.minute}`;
}

// ── 시즌 목록(필터용) ──────────────────────────────────────────────────────
export async function getSeasonalAbsenceSeasons() {
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT id, title, status
       FROM "SpecialProgramSeason"
      ORDER BY "startsAt" DESC`,
  );
  return rows.map((r) => ({ id: r.id, title: r.title, status: r.status }));
}

export type SeasonalAbsenceRow = {
  absenceId: string;
  enrollmentDateId: string;
  seasonId: string | null;
  offeringTitle: string;
  childName: string;
  parentName: string | null;
  parentPhone: string | null;
  dateLabel: string | null;
  startsAt: string | null;
  reason: string | null;
  reasonLabel: string | null;
  resolution: string; // PENDING | MAKEUP | CARRYOVER | REFUND
  resolutionLabel: string;
  status: string; // REPORTED | CONFIRMED | CANCELLED
  statusLabel: string;
  reportedAtLabel: string | null;
  paid: boolean; // 그 신청항목 결제 완료 여부
  perSessionAmount: number | null; // 회차 금액(표시용)
  priceSnapshot: number | null;
  roundCount: number;
};

// ── 결석 신고 목록 ─────────────────────────────────────────────────────────
// 취소된 신고(status='CANCELLED')는 처리 대상이 아니므로 제외한다.
// 각 건에 결제여부·회차금액을 함께 계산해 붙인다.
export async function getSeasonalAbsences(seasonId?: string): Promise<SeasonalAbsenceRow[]> {
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT ab.id AS "absenceId",
            ab."enrollmentDateId" AS "enrollmentDateId",
            ab.reason AS reason,
            ab.resolution AS resolution,
            ab.status AS status,
            ab."createdAt" AS "reportedAt",
            o."seasonId" AS "seasonId",
            o.title AS "offeringTitle",
            a."childName" AS "childName",
            a."parentName" AS "parentName",
            a."parentPhone" AS "parentPhone",
            sd."startsAt" AS "startsAt",
            it."priceSnapshot" AS "priceSnapshot",
            -- 그 항목 전체 회차수(취소 좌석 제외). 회차 금액의 분모.
            (SELECT COUNT(*) FROM "SpecialProgramEnrollmentDate" ed
               WHERE ed."applicationItemId" = it.id AND ed.status <> 'CANCELLED')::int AS "roundCount",
            -- 결제 완료 여부: 이 항목의 결제/청구서 상태가 PAID/COMPLETED 중 하나이면 완료.
            (payment.status IN ('PAID','COMPLETED') OR invoice.status IN ('PAID','COMPLETED')) AS "paid"
       FROM "SpecialProgramAbsence" ab
       JOIN "SpecialProgramEnrollmentDate" e ON e.id = ab."enrollmentDateId"
       JOIN "SpecialProgramApplicationItem" it ON it.id = e."applicationItemId"
       JOIN "SpecialProgramApplication" a ON a.id = it."applicationId"
       JOIN "SpecialProgramSessionDate" sd ON sd.id = e."sessionDateId"
       JOIN "SpecialProgramOffering" o ON o.id = e."offeringId"
       LEFT JOIN "Payment" payment ON payment.id = it."paymentId"
       LEFT JOIN "PaymentInvoice" invoice ON invoice."paymentId" = it."paymentId"
      WHERE ab.status <> 'CANCELLED'
        AND ($1::text IS NULL OR o."seasonId" = $1)
      ORDER BY sd."startsAt" ASC, ab."createdAt" ASC`,
    seasonId ?? null,
  );

  return rows.map((r) => {
    const resolution = r.resolution || "PENDING";
    const status = r.status || "REPORTED";
    const price = r.priceSnapshot == null ? null : Number(r.priceSnapshot);
    const roundCount = Number(r.roundCount ?? 0);
    return {
      absenceId: r.absenceId,
      enrollmentDateId: r.enrollmentDateId,
      seasonId: r.seasonId ?? null,
      offeringTitle: r.offeringTitle,
      childName: r.childName,
      parentName: r.parentName ?? null,
      parentPhone: r.parentPhone ?? null,
      dateLabel: seoulDateTimeLabel(r.startsAt),
      startsAt: r.startsAt ? new Date(r.startsAt).toISOString() : null,
      reason: r.reason || null,
      reasonLabel: r.reason ? REASON_LABEL[r.reason] || r.reason : null,
      resolution,
      resolutionLabel: RESOLUTION_LABEL[resolution] || resolution,
      status,
      statusLabel: ABSENCE_STATUS_LABEL[status] || status,
      reportedAtLabel: seoulReportedLabel(r.reportedAt),
      paid: r.paid === true,
      perSessionAmount: perSessionAmount(price, roundCount),
      priceSnapshot: price,
      roundCount,
    };
  });
}
