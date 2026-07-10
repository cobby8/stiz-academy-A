import { Suspense } from "react";
import { getAcademySettings, getGalleryPosts, getClasses } from "@/lib/queries";
import { getInstagramRuntimeStatus } from "@/lib/instagram";
import { getPendingSocialPostDrafts } from "@/lib/socialDrafts";
import GalleryAdminClient from "./GalleryAdminClient";

export const dynamic = "force-dynamic";

function GalleryLoadingFallback() {
    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                    <div className="h-8 w-44 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                    <div className="mt-2 h-4 w-80 max-w-full rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
                </div>
                <div className="flex flex-wrap gap-2">
                    <div className="h-10 w-32 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse" />
                    <div className="h-10 w-28 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
                </div>
            </div>
            <section className="rounded-lg border border-gray-100 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="space-y-2">
                        <div className="h-5 w-36 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                        <div className="h-4 w-96 max-w-full rounded bg-gray-100 dark:bg-gray-700 animate-pulse" />
                    </div>
                    <div className="h-9 w-32 rounded-lg bg-gray-100 dark:bg-gray-700 animate-pulse" />
                </div>
            </section>
            <section className="rounded-lg border border-orange-100 bg-orange-50/40 p-4 dark:border-gray-700 dark:bg-gray-800">
                <div className="flex items-center justify-between gap-3">
                    <div className="space-y-2">
                        <div className="h-5 w-32 rounded bg-orange-100 dark:bg-gray-700 animate-pulse" />
                        <div className="h-4 w-72 max-w-full rounded bg-orange-100/80 dark:bg-gray-700 animate-pulse" />
                    </div>
                    <div className="h-8 w-20 rounded-full bg-orange-100 dark:bg-gray-700 animate-pulse" />
                </div>
            </section>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, index) => (
                    <div
                        key={index}
                        className="overflow-hidden rounded-lg border border-gray-100 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800"
                    >
                        <div className="aspect-video bg-gray-100 dark:bg-gray-700 animate-pulse" />
                        <div className="space-y-3 p-4">
                            <div className="h-5 w-3/4 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                            <div className="h-4 w-full rounded bg-gray-100 dark:bg-gray-700 animate-pulse" />
                            <div className="h-4 w-2/3 rounded bg-gray-100 dark:bg-gray-700 animate-pulse" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

async function GalleryDataSection() {
    const [posts, classes, settings, socialDrafts] = await Promise.all([
        getGalleryPosts({ limit: 100 }),
        getClasses(),
        getAcademySettings(),
        getPendingSocialPostDrafts(30),
    ]);
    const instagramStatus = {
        profileUrl: (settings as any)?.instagramUrl ?? "",
        businessAccountId: (settings as any)?.instagramBusinessAccountId ?? "",
        autoPublishEnabled: (settings as any)?.instagramAutoPublishEnabled === true,
        ...getInstagramRuntimeStatus((settings as any)?.instagramBusinessAccountId),
    };

    return (
        <GalleryAdminClient
            posts={posts}
            classes={classes}
            instagramStatus={instagramStatus}
            socialDrafts={socialDrafts}
        />
    );
}

export default function AdminGalleryPage() {
    return (
        <Suspense fallback={<GalleryLoadingFallback />}>
            <GalleryDataSection />
        </Suspense>
    );
}
