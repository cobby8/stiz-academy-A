import { Suspense } from "react";
import { getWaitlistAll, getClassCapacityInfo, getClasses } from "@/lib/queries";
import WaitlistClient from "./WaitlistClient";

// 30초 ISR — Server Action 호출 시 revalidatePath로 즉시 무효화
export const revalidate = 30;

function WaitlistLoadingFallback() {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="space-y-2">
                    <div className="h-8 w-44 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                    <div className="h-4 w-80 rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
                </div>
                <div className="h-11 w-28 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, index) => (
                    <div
                        key={index}
                        className="h-32 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 animate-pulse"
                    />
                ))}
            </div>
            <div className="flex items-center gap-3">
                <div className="h-10 w-44 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse" />
                <div className="h-5 w-32 rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
            </div>
            <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, index) => (
                    <div
                        key={index}
                        className="h-40 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 animate-pulse"
                    />
                ))}
            </div>
        </div>
    );
}

async function WaitlistDataSection() {
    // 대기 등록 액션에서 테이블을 보장하므로, 목록 화면은 읽기 데이터만 빠르게 조회한다.
    const [waitlist, capacityInfo, classes] = await Promise.all([
        getWaitlistAll(),
        getClassCapacityInfo(),
        getClasses(),
    ]);

    return (
        <WaitlistClient
            waitlist={waitlist}
            capacityInfo={capacityInfo}
            classes={classes}
        />
    );
}

export default function AdminWaitlistPage() {
    return (
        <Suspense fallback={<WaitlistLoadingFallback />}>
            <WaitlistDataSection />
        </Suspense>
    );
}
