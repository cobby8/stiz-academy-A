"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";
import { getRegularAbsences, type RegularAbsenceRow } from "@/lib/regular/admin-regular-absence";

// 정규 수업 사전 결석 — 관리자 확정 서버 액션(#3 Step B).
// 모두 requireAdmin 게이트. $executeRawUnsafe (PgBouncer 트랜잭션 모드 호환).
// MVP 범위: 크레딧/보강 없음. 상태(REPORTED/CONFIRMED/CANCELLED)만 관리한다.

function revalidateViews() {
  revalidatePath("/admin/absence");
}

// ── 0) 목록 재조회(필터) ────────────────────────────────────────────────
export async function loadRegularAbsences(input?: {
  date?: string;
  classId?: string;
}): Promise<{ ok: true; rows: RegularAbsenceRow[] }> {
  await requireAdmin();
  const rows = await getRegularAbsences({
    date: input?.date?.trim() || undefined,
    classId: input?.classId?.trim() || undefined,
  });
  return { ok: true, rows };
}

// ── 1) 확정 (REPORTED → CONFIRMED) ─────────────────────────────────────
// 확정하면 학부모 취소가 자동으로 잠긴다(학부모 cancel 은 REPORTED 만 허용).
export async function confirmRegularAbsence(input: { id: string }) {
  const admin = await requireAdmin();
  const id = input?.id?.trim();
  if (!id) throw new Error("결석 신고를 찾을 수 없습니다.");

  const affected = await prisma.$executeRawUnsafe(
    `UPDATE "RegularAbsence"
        SET status = 'CONFIRMED',
            "resolvedByUserId" = $2,
            "updatedAt" = now()
      WHERE id = $1 AND status = 'REPORTED'`,
    id, admin.appUserId,
  );
  if (Number(affected) === 0) throw new Error("확정할 수 없는 상태입니다.");

  revalidateViews();
  return { ok: true };
}

// ── 2) 확정 취소 (CONFIRMED → REPORTED) ────────────────────────────────
export async function revertRegularAbsence(input: { id: string }) {
  const admin = await requireAdmin();
  const id = input?.id?.trim();
  if (!id) throw new Error("결석 신고를 찾을 수 없습니다.");

  const affected = await prisma.$executeRawUnsafe(
    `UPDATE "RegularAbsence"
        SET status = 'REPORTED',
            "resolvedByUserId" = $2,
            "updatedAt" = now()
      WHERE id = $1 AND status = 'CONFIRMED'`,
    id, admin.appUserId,
  );
  if (Number(affected) === 0) throw new Error("확정 상태인 신고만 되돌릴 수 있습니다.");

  revalidateViews();
  return { ok: true };
}

// ── 3) 관리자용 취소 (→ CANCELLED) ─────────────────────────────────────
// 신고 자체를 무효 처리. REPORTED/CONFIRMED 어느 상태든 관리자는 취소 가능.
export async function cancelRegularAbsenceByAdmin(input: { id: string }) {
  const admin = await requireAdmin();
  const id = input?.id?.trim();
  if (!id) throw new Error("결석 신고를 찾을 수 없습니다.");

  const affected = await prisma.$executeRawUnsafe(
    `UPDATE "RegularAbsence"
        SET status = 'CANCELLED',
            "resolvedByUserId" = $2,
            "updatedAt" = now()
      WHERE id = $1 AND status <> 'CANCELLED'`,
    id, admin.appUserId,
  );
  if (Number(affected) === 0) throw new Error("취소할 수 없는 상태입니다.");

  revalidateViews();
  return { ok: true };
}
