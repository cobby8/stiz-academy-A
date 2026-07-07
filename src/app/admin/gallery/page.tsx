import { getAcademySettings, getGalleryPosts, getClasses } from "@/lib/queries";
import { getInstagramRuntimeStatus } from "@/lib/instagram";
import GalleryAdminClient from "./GalleryAdminClient";

export const dynamic = "force-dynamic";

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
