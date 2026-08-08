"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-guard";
import { decideEnrollmentChangeRequest } from "@/lib/enrollment/admin-change-request";

/**
 * 수강 변경 신청 승인/거절. 원장·부원장만.
 *
 * 승인해도 그 자리에서 반이 바뀌지는 않는다 — 적용일(다음 달 1일)이 되면 크론이 옮긴다.
 * 적용일이 이미 지난 건(늦게 승인)은 바로 반영된다.
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
