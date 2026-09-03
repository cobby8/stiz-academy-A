"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-guard";
import { decideEnrollmentChangeRequest, issueProrationInvoice } from "@/lib/enrollment/admin-change-request";

/**
 * 수강 변경 신청 승인/거절. 원장·부원장만.
 *
 * 승인은 접수 결정이며 적용일 도래 시 세 시스템 동기화 검토 원장으로 이동한다.
 * 실제 수강 변경과 학부모 알림은 별도 승인·검증 전까지 보류한다.
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
