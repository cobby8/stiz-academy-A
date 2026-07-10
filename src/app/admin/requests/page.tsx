import { Suspense } from "react";
import { getAllRequests } from "@/lib/queries";
import RequestsAdminClient from "./RequestsAdminClient";

// 30초 캐시: 아무도 수정 안 할 때 캐시 유지, Server Action 호출 시 즉시 무효화
export const revalidate = 30;

function RequestsLoadingFallback() {
    return (
        <div className="mx-auto max-w-4xl space-y-6">
            <div>
                <div className="h-8 w-56 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                <div className="mt-2 h-4 w-96 max-w-full rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
            </div>
            <div className="flex flex-wrap gap-2">
                {Array.from({ length: 4 }).map((_, index) => (
                    <div
                        key={index}
                        className="h-10 w-24 rounded-xl bg-gray-200 dark:bg-gray-700 animate-pulse"
                    />
                ))}
            </div>
            <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, index) => (
                    <div
                        key={index}
                        className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-800"
                    >
                        <div className="flex items-center gap-3 px-5 py-4">
                            <div className="h-9 w-9 flex-shrink-0 rounded-full bg-gray-100 dark:bg-gray-700 animate-pulse" />
                            <div className="min-w-0 flex-1 space-y-2">
                                <div className="flex gap-2">
                                    <div className="h-5 w-20 rounded-full bg-gray-100 dark:bg-gray-700 animate-pulse" />
                                    <div className="h-5 w-48 max-w-full rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                                </div>
                                <div className="h-4 w-64 max-w-full rounded bg-gray-100 dark:bg-gray-700 animate-pulse" />
                            </div>
                            <div className="h-5 w-5 rounded bg-gray-100 dark:bg-gray-700 animate-pulse" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

async function RequestsDataSection() {
    const requests = await getAllRequests();
    return <RequestsAdminClient requests={requests} />;
}

export default function RequestsPage() {
    return (
        <Suspense fallback={<RequestsLoadingFallback />}>
            <RequestsDataSection />
        </Suspense>
    );
}
