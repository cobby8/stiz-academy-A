import { getPaymentParentRequests } from "@/lib/payments/admin-payment-request";
import PaymentRequestsClient from "./PaymentRequestsClient";

export const dynamic = "force-dynamic";

export default async function PaymentRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const params = await searchParams;
  const status =
    params?.status === "ALL" || params?.status === "DONE" || params?.status === "REJECTED"
      ? params.status
      : "PENDING";
  const rows = await getPaymentParentRequests(status);
  return <PaymentRequestsClient rows={rows} status={status} />;
}
