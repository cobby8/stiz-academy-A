import ScheduleAdminClient from "./ScheduleAdminClient";
import { getCachedAdminSchedulePayload } from "@/lib/adminReadPayloads";

export const revalidate = 30;

export default async function AdminSchedulePage() {
    const payload = await getCachedAdminSchedulePayload();

    return <ScheduleAdminClient {...payload} />;
}
