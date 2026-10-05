"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-guard";
import { decideEnrollmentChangeRequest, issueProrationInvoice } from "@/lib/enrollment/admin-change-request";
import { revalidateEnrollmentStatusCaches } from "@/lib/enrollment/change-cache";

/**
 * 수강 변경 신청 승인/거절. 원장·부원장만.
 *
 * 승인은 접수 결정이다. 적용일이 되면 휴원·퇴원은 사이트에 자동 적용되고(적용일이 지난 건은 승인 즉시),
 * 시트·랠리즈는 이 화면의 "확인 필요"에서 관리자가 반영·확인한다.
 * 반 변경은 세 시스템 동기화 검토 원장(HELD)으로 이동한다. 학부모 알림은 별도 승인 전까지 보류한다.
 */
export async function decideEnrollmentChange(input: {
  requestId: string;
  approve: boolean;
  note?: string;
}) {
  const admin = await requireAdmin();
  const result = await decideEnrollmentChangeRequest({
    adminUserId: admin.appUserId,
    requestId: input.requestId,
    approve: input.approve,
    note: input.note ?? null,
  });
  revalidatePath("/admin/enrollment-changes");
  // 승인 직후 처리에서 이 신청이든 다른 밀린 신청이든 한 건이라도 사이트에 적용됐으면
  // 관리자 즉시 변경과 같은 범위의 캐시를 비운다.
  if (result.ok && result.appliedCount > 0) revalidateEnrollmentStatusCaches();
  return result;
}

/**
 * 반 변경 차액 청구서 발행. 금액은 서버가 다시 계산한다(화면 값을 믿지 않는다).
 * 원장 결정: 자동 발행하지 않고 원장이 금액과 근거를 보고 누른다.
 */
export async function issueEnrollmentChangeInvoice(requestId: string, expectedPreviewKey: string) {
  const admin = await requireAdmin();
  const result = await issueProrationInvoice({ adminUserId: admin.appUserId, requestId, expectedPreviewKey });
  revalidatePath("/admin/enrollment-changes");
  revalidatePath("/admin/finance");
  return result;
}
