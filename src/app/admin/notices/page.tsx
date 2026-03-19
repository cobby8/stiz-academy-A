import { getNotices, getClasses } from "@/lib/queries";
import NoticesAdminClient from "./NoticesAdminClient";

export const dynamic = "force-dynamic";

export default async function AdminNoticesPage() {
    const [notices, classes] = await Promise.all([
        getNotices({ limit: 100 }),
        getClasses(),
    ]);
    return <NoticesAdminClient notices={notices} classes={classes} />;
}
