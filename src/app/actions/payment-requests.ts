"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-guard";
import { decidePaymentParentRequest } from "@/lib/payments/admin-payment-request";

/**
 * 입금 확인·영수증 요청 처리. 원장·부원장만.
 *
 * 입금 확인을 승인하면 실제로 납부 처리까지 간다(기존 납부 경로 재사용).
 */
export async function decidePaymentRequest(input: {
  requestId: string;
  approve: boolean;
  note?: string;
  receiptUrl?: string;
}) {
  const admin = await requireAdmin();
  const result = await decidePaymentParentRequest({
    adminUserId: admin.appUserId,
    requestId: input.requestId,
    approve: input.approve,
    note: input.note ?? null,
    receiptUrl: input.receiptUrl ?? null,
  });
  revalidatePath("/admin/payment-requests");
  revalidatePath("/admin/finance");
  return result;
}
