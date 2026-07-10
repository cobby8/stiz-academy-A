import { Suspense } from "react";
import { getAllTestimonials, getAcademySettings } from "@/lib/queries";
import TestimonialsWrapper from "./TestimonialsWrapper";

// 30초 캐시: Server Action 호출 시 즉시 무효화
export const revalidate = 30;

function TestimonialsLoadingFallback() {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between gap-4">
                <div>
                    <div className="h-8 w-48 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                    <div className="mt-2 h-4 w-80 max-w-full rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
                </div>
                <div className="h-11 w-28 rounded-xl bg-gray-200 dark:bg-gray-700 animate-pulse" />
            </div>
            <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                <div className="h-5 w-44 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                <div className="mt-3 h-4 w-96 max-w-full rounded bg-gray-100 dark:bg-gray-700 animate-pulse" />
                <div className="mt-4 flex gap-2">
                    <div className="h-10 flex-1 rounded-xl bg-gray-100 dark:bg-gray-700 animate-pulse" />
                    <div className="h-10 w-20 rounded-xl bg-gray-200 dark:bg-gray-700 animate-pulse" />
                </div>
            </div>
            <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, index) => (
                    <div
                        key={index}
                        className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800"
                    >
                        <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0 flex-1 space-y-3">
                                <div className="flex flex-wrap items-center gap-2">
                                    <div className="h-5 w-20 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                                    <div className="h-5 w-20 rounded bg-gray-100 dark:bg-gray-700 animate-pulse" />
                                    <div className="h-5 w-24 rounded bg-gray-100 dark:bg-gray-700 animate-pulse" />
                                </div>
                                <div className="h-4 w-full rounded bg-gray-100 dark:bg-gray-700 animate-pulse" />
                                <div className="h-4 w-3/4 rounded bg-gray-100 dark:bg-gray-700 animate-pulse" />
                                <div className="flex gap-2">
                                    <div className="h-5 w-16 rounded-full bg-gray-100 dark:bg-gray-700 animate-pulse" />
                                    <div className="h-5 w-16 rounded-full bg-gray-100 dark:bg-gray-700 animate-pulse" />
                                </div>
                            </div>
                            <div className="hidden gap-1 sm:flex">
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

async function TestimonialsDataSection() {
    // DB에서 전체 후기 + 학원 설정(naverPlaceUrl) 조회
    const [testimonials, settings] = await Promise.all([
        getAllTestimonials(),
        getAcademySettings(),
    ]);
    return (
        <TestimonialsWrapper
            testimonials={testimonials}
            naverPlaceUrl={settings?.naverPlaceUrl ?? ""}
        />

    );
}

export default function AdminTestimonialsPage() {
    return (
        <Suspense fallback={<TestimonialsLoadingFallback />}>
            <TestimonialsDataSection />
        </Suspense>
    );
}
