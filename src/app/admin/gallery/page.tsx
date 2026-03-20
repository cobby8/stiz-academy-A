import { getGalleryPosts, getClasses } from "@/lib/queries";
import GalleryAdminClient from "./GalleryAdminClient";

// 30초 캐시: 아무도 수정 안 할 때 캐시 유지, Server Action 호출 시 즉시 무효화
export const revalidate = 30;

export default async function AdminGalleryPage() {
    const [posts, classes] = await Promise.all([
        getGalleryPosts({ limit: 100 }),
        getClasses(),
    ]);
    return <GalleryAdminClient posts={posts} classes={classes} />;
}
