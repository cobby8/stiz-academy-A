import { getAcademySettings, getGalleryPosts, getClasses } from "@/lib/queries";
import { getInstagramRuntimeStatus } from "@/lib/instagram";
import GalleryAdminClient from "./GalleryAdminClient";

// 30초 캐시: 아무도 수정 안 할 때 캐시 유지, Server Action 호출 시 즉시 무효화
export const revalidate = 30;

export default async function AdminGalleryPage() {
    const [posts, classes, settings] = await Promise.all([
        getGalleryPosts({ limit: 100 }),
        getClasses(),
        getAcademySettings(),
    ]);
    const instagramStatus = {
        profileUrl: (settings as any)?.instagramUrl ?? "",
        businessAccountId: (settings as any)?.instagramBusinessAccountId ?? "",
        autoPublishEnabled: (settings as any)?.instagramAutoPublishEnabled === true,
        ...getInstagramRuntimeStatus((settings as any)?.instagramBusinessAccountId),
    };

    return <GalleryAdminClient posts={posts} classes={classes} instagramStatus={instagramStatus} />;
}
