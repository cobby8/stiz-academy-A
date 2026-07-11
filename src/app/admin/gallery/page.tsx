import GalleryAdminClient from "./GalleryAdminClient";
import { getCachedAdminGalleryPayload } from "@/lib/adminReadPayloads";

export const revalidate = 30;

export default async function AdminGalleryPage() {
    const { posts, classes, instagramStatus, socialDrafts } = await getCachedAdminGalleryPayload();

    return (
        <GalleryAdminClient
            posts={posts}
            classes={classes}
            instagramStatus={instagramStatus}
            socialDrafts={socialDrafts}
        />
    );
}
