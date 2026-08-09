import { redirect } from "next/navigation";
import { requireVerifiedParent } from "@/lib/auth-guard";
import { getParentPaymentRequests } from "@/lib/payments/parent-payment-request";
import PaymentRequestClient from "./PaymentRequestClient";

export const dynamic = "force-dynamic";

export default async function ParentPaymentsPage() {
  const parent = await requireVerifiedParent().catch(() => null);
  // bounced=1 로 목적지를 지운다. 여기로 되돌려보내면 거절 → 판별 → 거절이 무한 반복된다.
  if (!parent) redirect("/mypage/continue?bounced=1");

  const rows = await getParentPaymentRequests(parent.appUserId);
  return <PaymentRequestClient rows={rows} />;
}
