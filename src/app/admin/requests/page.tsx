import RequestsAdminClient from "./RequestsAdminClient";
import { getCachedAdminRequestsPayload } from "@/lib/adminReadPayloads";

export const revalidate = 30;

export default async function RequestsPage() {
    const { requests, counts, pagination, statusFilter } = await getCachedAdminRequestsPayload();

    return <RequestsAdminClient requests={requests} counts={counts} pagination={pagination} statusFilter={statusFilter} />;
}
