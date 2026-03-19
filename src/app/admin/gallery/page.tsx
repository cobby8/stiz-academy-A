import { getGalleryPosts, getClasses } from "@/lib/queries";
import GalleryAdminClient from "./GalleryAdminClient";

export const dynamic = "force-dynamic";

export default async function AdminGalleryPage() {
    const [posts, classes] = await Promise.all([
        getGalleryPosts({ limit: 100 }),
        getClasses(),
    ]);
    return <GalleryAdminClient posts={posts} classes={classes} />;
}
