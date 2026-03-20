import { getNotices, getClasses } from "@/lib/queries";
import NoticesAdminClient from "./NoticesAdminClient";

// 30초 캐시: 아무도 수정 안 할 때 캐시 유지, Server Action 호출 시 즉시 무효화
export const revalidate = 30;

export default async function AdminNoticesPage() {
    const [notices, classes] = await Promise.all([
        getNotices({ limit: 100 }),
        getClasses(),
    ]);
    return <NoticesAdminClient notices={notices} classes={classes} />;
}
