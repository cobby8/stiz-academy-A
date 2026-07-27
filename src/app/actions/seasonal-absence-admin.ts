"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";
import { isAssignableResolution, canConfirm } from "@/lib/seasonal/adminAbsenceRules";
import { getSeasonalAbsences, type SeasonalAbsenceRow } from "@/lib/seasonal/admin-absence";

// ── 0) 목록 재조회(시즌 필터) ──────────────────────────────────────────────
// 처리 후 / 시즌 필터 변경 시 클라이언트가 최신 목록을 다시 받기 위한 읽기 액션.
export async function loadSeasonalAbsences(input?: { seasonId?: string }): Promise<{ ok: true; rows: SeasonalAbsenceRow[] }> {
  await requireAdmin();
  const seasonId = input?.seasonId?.trim() || undefined;
  const rows = await getSeasonalAbsences(seasonId);
  return { ok: true, rows };
}

// ── 방학특강 "관리자 결석 신고 처리" 서버 액션 (4a-2 Step 3) ────────────────
// 모두 requireAdmin 게이트. 좌석 attendanceStatus(EXCUSED)는 이 단계에서 건드리지 않는다.
// (신고 상태/처리방식만 관리 — 셔틀 결석 제외는 EXCUSED 그대로 유지)
// $queryRawUnsafe/$executeRawUnsafe (PgBouncer 트랜잭션 모드 호환).

// 처리 후 관리자 화면 캐시를 무효화한다(force-dynamic 이라 큰 효과는 없지만 일관성 위해 호출).
function revalidateAbsenceViews() {
  revalidatePath("/admin/seasonal/absence");
}

// ── 1) 처리방식 변경(협의) ─────────────────────────────────────────────────
// resolution 을 MAKEUP/CARRYOVER/REFUND 중 하나로 지정한다.
// status 는 건드리지 않는다 — REPORTED/CONFIRMED 모두 변경 허용(확정 후에도 조정 가능).
// resolvedByUserId 에 처리한 관리자를 기록한다.
export async function resolveSeasonalAbsence(input: { absenceId: string; resolution: string }) {
  const admin = await requireAdmin();
  const absenceId = input?.absenceId?.trim();
  const resolution = input?.resolution;
  if (!absenceId) throw new Error("결석 신고를 찾을 수 없습니다.");
  if (!isAssignableResolution(resolution)) throw new Error("처리방식은 보강·이월·환불 중 하나여야 합니다.");

  // 취소된(CANCELLED) 신고는 처리 대상이 아니다. status<>'CANCELLED' 인 건만 갱신.
  const affected = await prisma.$executeRawUnsafe(
    `UPDATE "SpecialProgramAbsence"
        SET resolution = $2,
            "resolvedByUserId" = $3,
            "updatedAt" = now()
      WHERE id = $1 AND status <> 'CANCELLED'`,
    absenceId, resolution, admin.appUserId,
  );
  if (Number(affected) === 0) throw new Error("처리할 수 없는 결석 신고입니다.");

  revalidateAbsenceViews();
  return { ok: true, resolution };
}

// ── 2) 확정 (REPORTED → CONFIRMED) ─────────────────────────────────────────
// ★ 이 액션이 Step4 "이월 크레딧 적립" 훅이 붙을 자리다. 지금은 상태 전환만 한다.
// - resolution 이 PENDING 이면 확정 거부(먼저 처리방식 지정).
// - REPORTED 인 건만 CONFIRMED 로. (학부모 취소는 Step2에서 status='REPORTED' 만 허용하므로,
//   확정하는 순간 학부모 취소가 자동으로 잠긴다 — 추가 배선 불필요)
export async function confirmSeasonalAbsence(input: { absenceId: string }) {
  const admin = await requireAdmin();
  const absenceId = input?.absenceId?.trim();
  if (!absenceId) throw new Error("결석 신고를 찾을 수 없습니다.");

  // 현재 상태/처리방식을 서버에서 조회해 판정(클라이언트 값 불신뢰).
  const cur = await prisma.$queryRawUnsafe<any[]>(
    `SELECT status, resolution FROM "SpecialProgramAbsence" WHERE id = $1 LIMIT 1`,
    absenceId,
  );
  const row = cur[0];
  if (!row) throw new Error("결석 신고를 찾을 수 없습니다.");
  if (row.status === "CONFIRMED") throw new Error("이미 확정된 신고입니다.");
  if (row.status !== "REPORTED") throw new Error("확정할 수 없는 상태입니다.");
  if (!canConfirm(row.resolution)) throw new Error("먼저 처리방식(보강·이월·환불)을 지정해 주세요.");

  // 원자적 전환 — REPORTED 인 건만. (동시 취소 경합까지 여기서 차단)
  const affected = await prisma.$executeRawUnsafe(
    `UPDATE "SpecialProgramAbsence"
        SET status = 'CONFIRMED',
            "resolvedByUserId" = $2,
            "updatedAt" = now()
      WHERE id = $1 AND status = 'REPORTED'`,
    absenceId, admin.appUserId,
  );
  if (Number(affected) === 0) throw new Error("확정할 수 없는 상태입니다.");

  // ※ Step4: 여기서 결제여부 게이트를 통과한 건에 대해 SpecialProgramCredit 적립 훅을 호출할 예정.
  //    (지금 범위 아님 — resolution/status 전환만)

  revalidateAbsenceViews();
  return { ok: true };
}

// ── 3) 확정 취소 (CONFIRMED → REPORTED) ────────────────────────────────────
// 확정을 되돌린다. resolution 은 유지(그대로 두고 다시 협의 가능).
export async function revertSeasonalAbsenceConfirm(input: { absenceId: string }) {
  const admin = await requireAdmin();
  const absenceId = input?.absenceId?.trim();
  if (!absenceId) throw new Error("결석 신고를 찾을 수 없습니다.");

  const affected = await prisma.$executeRawUnsafe(
    `UPDATE "SpecialProgramAbsence"
        SET status = 'REPORTED',
            "resolvedByUserId" = $2,
            "updatedAt" = now()
      WHERE id = $1 AND status = 'CONFIRMED'`,
    absenceId, admin.appUserId,
  );
  if (Number(affected) === 0) throw new Error("확정 상태인 신고만 되돌릴 수 있습니다.");

  revalidateAbsenceViews();
  return { ok: true };
}
