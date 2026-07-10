import { Suspense } from "react";
import { getNotices, getClasses } from "@/lib/queries";
import NoticesAdminClient from "./NoticesAdminClient";

// 30초 캐시: 아무도 수정 안 할 때 캐시 유지, Server Action 호출 시 즉시 무효화
export const revalidate = 30;

function NoticesLoadingFallback() {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between gap-4">
                <div>
                    <div className="h-8 w-40 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                    <div className="mt-2 h-4 w-64 rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
                </div>
                <div className="h-11 w-28 rounded-xl bg-gray-200 dark:bg-gray-700 animate-pulse" />
            </div>
            <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, index) => (
                    <div
                        key={index}
                        className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800"
                    >
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 space-y-3">
                                <div className="h-5 w-2/3 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                                <div className="h-4 w-full rounded bg-gray-100 dark:bg-gray-700 animate-pulse" />
                                <div className="h-4 w-3/4 rounded bg-gray-100 dark:bg-gray-700 animate-pulse" />
                                <div className="flex gap-2">
                                    <div className="h-6 w-16 rounded-full bg-gray-100 dark:bg-gray-700 animate-pulse" />
                                    <div className="h-6 w-20 rounded-full bg-gray-100 dark:bg-gray-700 animate-pulse" />
                                </div>
                            </div>
                            <div className="hidden gap-2 sm:flex">
                                <div className="h-8 w-8 rounded-lg bg-gray-100 dark:bg-gray-700 animate-pulse" />
                                <div className="h-8 w-8 rounded-lg bg-gray-100 dark:bg-gray-700 animate-pulse" />
                                <div className="h-8 w-8 rounded-lg bg-gray-100 dark:bg-gray-700 animate-pulse" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

async function NoticesDataSection() {
    const [notices, classes] = await Promise.all([
        getNotices({ limit: 100 }),
        getClasses(),
    ]);
    return <NoticesAdminClient notices={notices} classes={classes} />;
}

export default function AdminNoticesPage() {
    return (
        <Suspense fallback={<NoticesLoadingFallback />}>
            <NoticesDataSection />
        </Suspense>
    );
}
