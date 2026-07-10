import { Suspense } from "react";
import { getAllFaqs } from "@/lib/queries";
import FaqAdminClient from "./FaqAdminClient";

// 30초 캐시: Server Action 호출 시 즉시 무효화
export const revalidate = 30;

function FaqLoadingFallback() {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between gap-4">
                <div>
                    <div className="h-8 w-32 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                    <div className="mt-2 h-4 w-80 max-w-full rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
                </div>
                <div className="h-11 w-28 rounded-xl bg-gray-200 dark:bg-gray-700 animate-pulse" />
            </div>
            <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, index) => (
                    <div
                        key={index}
                        className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800"
                    >
                        <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0 flex-1 space-y-3">
                                <div className="flex items-center gap-2">
                                    <div className="h-5 w-5 rounded bg-gray-100 dark:bg-gray-700 animate-pulse" />
                                    <div className="h-5 w-2/3 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                                </div>
                                <div className="ml-7 h-4 w-full rounded bg-gray-100 dark:bg-gray-700 animate-pulse" />
                                <div className="ml-7 h-4 w-3/4 rounded bg-gray-100 dark:bg-gray-700 animate-pulse" />
                                <div className="ml-7 flex gap-2">
                                    <div className="h-5 w-16 rounded-full bg-gray-100 dark:bg-gray-700 animate-pulse" />
                                    <div className="h-5 w-16 rounded-full bg-gray-100 dark:bg-gray-700 animate-pulse" />
                                </div>
                            </div>
                            <div className="hidden gap-1 sm:flex">
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

async function FaqDataSection() {
    // DB에서 전체 FAQ 조회 (공개/비공개 모두)
    const faqs = await getAllFaqs();
    return <FaqAdminClient faqs={faqs} />;
}

export default function AdminFaqPage() {
    return (
        <Suspense fallback={<FaqLoadingFallback />}>
            <FaqDataSection />
        </Suspense>
    );
}
