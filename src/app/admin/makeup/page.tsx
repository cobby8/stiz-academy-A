import { Suspense } from "react";
import { getMakeupSessions, getClasses } from "@/lib/queries";
import MakeupClient from "./MakeupClient";

// 30초 ISR — Server Action 호출 시 revalidatePath로 즉시 무효화
export const revalidate = 30;

function MakeupLoadingFallback() {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="space-y-2">
                    <div className="h-8 w-32 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                    <div className="h-4 w-72 rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
                </div>
                <div className="h-10 w-28 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, index) => (
                    <div
                        key={index}
                        className="h-24 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 animate-pulse"
                    />
                ))}
            </div>
            <div className="h-10 w-80 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse" />
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
                {Array.from({ length: 8 }).map((_, index) => (
                    <div
                        key={index}
                        className="h-14 border-b border-gray-100 dark:border-gray-700 last:border-b-0 bg-gray-50/60 dark:bg-gray-900/40 animate-pulse"
                    />
                ))}
            </div>
        </div>
    );
}

async function MakeupDataSection() {
    // 보강 예약 액션에서 테이블을 보장하므로, 목록 화면은 읽기 데이터만 빠르게 조회한다.
    const [sessions, classes] = await Promise.all([
        getMakeupSessions(),
        getClasses(),
    ]);

    return (
        <MakeupClient
            sessions={sessions}
            classes={classes}
        />
    );
}

export default function AdminMakeupPage() {
    return (
        <Suspense fallback={<MakeupLoadingFallback />}>
            <MakeupDataSection />
        </Suspense>
    );
}
