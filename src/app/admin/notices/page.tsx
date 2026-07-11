import NoticesAdminClient from "./NoticesAdminClient";
import { getCachedAdminNoticesPayload } from "@/lib/adminReadPayloads";

export const revalidate = 30;

export default async function AdminNoticesPage() {
    const { notices, classes } = await getCachedAdminNoticesPayload();

    return <NoticesAdminClient notices={notices} classes={classes} />;
}
