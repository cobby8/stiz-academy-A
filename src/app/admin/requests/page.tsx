import { getAllRequests } from "@/lib/queries";
import RequestsAdminClient from "./RequestsAdminClient";

export const dynamic = "force-dynamic";

export default async function RequestsPage() {
    const requests = await getAllRequests();
    return <RequestsAdminClient requests={requests} />;
}
