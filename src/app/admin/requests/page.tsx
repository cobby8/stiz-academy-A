import RequestsAdminClient from "./RequestsAdminClient";
import { getCachedAdminRequestsPayload } from "@/lib/adminReadPayloads";

export const revalidate = 30;

export default async function RequestsPage() {
    const { requests } = await getCachedAdminRequestsPayload();

    return <RequestsAdminClient requests={requests} />;
}
