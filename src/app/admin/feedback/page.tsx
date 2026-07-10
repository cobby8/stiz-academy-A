import { Suspense } from "react";
import { getAllFeedbacks } from "@/lib/queries";
import FeedbackManagementClient from "./FeedbackManagementClient";

// 30초 캐시: 아무도 수정 안 할 때 캐시 유지, Server Action 호출 시 즉시 무효화
export const revalidate = 30;

function FeedbackLoadingFallback() {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between gap-4">
                <div>
                    <div className="h-8 w-40 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                    <div className="mt-2 h-4 w-80 max-w-full rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
                </div>
                <div className="h-11 w-28 rounded-xl bg-gray-200 dark:bg-gray-700 animate-pulse" />
            </div>
            <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, index) => (
                    <div
                        key={index}
                        className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-800"
                    >
                        <div className="p-5">
                            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                <div className="min-w-0 flex-1 space-y-3">
                                    <div className="flex gap-2">
                                        <div className="h-6 w-16 rounded-full bg-gray-100 dark:bg-gray-700 animate-pulse" />
                                        <div className="h-6 w-20 rounded-full bg-gray-100 dark:bg-gray-700 animate-pulse" />
                                    </div>
                                    <div className="h-5 w-2/3 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                                    <div className="h-4 w-full rounded bg-gray-100 dark:bg-gray-700 animate-pulse" />
                                    <div className="h-4 w-3/4 rounded bg-gray-100 dark:bg-gray-700 animate-pulse" />
                                </div>
                                <div className="hidden gap-2 sm:flex">
                                    <div className="h-8 w-16 rounded-lg bg-gray-100 dark:bg-gray-700 animate-pulse" />
                                    <div className="h-8 w-16 rounded-lg bg-gray-100 dark:bg-gray-700 animate-pulse" />
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

async function FeedbackDataSection() {
    // 피드백 목록만 먼저 조회하고, 원생/코치 목록은 작성 폼을 열 때 불러온다.
    const feedbacks = await getAllFeedbacks();

    return (
        <FeedbackManagementClient
            feedbacks={feedbacks}
        />
    );
}

export default function FeedbackPage() {
    return (
        <Suspense fallback={<FeedbackLoadingFallback />}>
            <FeedbackDataSection />
        </Suspense>
    );
}
