import { getEnrollmentChangeRequests } from "@/lib/enrollment/admin-change-request";
import EnrollmentChangesClient from "./EnrollmentChangesClient";

export const dynamic = "force-dynamic";

export default async function EnrollmentChangesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const params = await searchParams;
  const status = params?.status === "ALL" || params?.status === "APPROVED" || params?.status === "REJECTED"
    ? params.status
    : "PENDING";
  const rows = await getEnrollmentChangeRequests(status);
  return <EnrollmentChangesClient rows={rows} status={status} />;
}
