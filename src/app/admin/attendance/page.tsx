import { Suspense } from "react";
import { getClasses } from "@/lib/queries";
import AttendanceClient from "./AttendanceClient";

// 30초 캐시: 아무도 수정 안 할 때 캐시 유지, Server Action 호출 시 즉시 무효화
export const revalidate = 30;

function AttendanceLoadingFallback() {
    return (
        <div className="max-w-4xl mx-auto">
            <div className="mb-6 flex items-center justify-between">
                <div className="space-y-2">
                    <div className="h-8 w-32 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                    <div className="h-4 w-72 rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
                </div>
                <div className="h-10 w-28 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
            </div>
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="h-16 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse" />
                    <div className="h-16 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse" />
                </div>
            </div>
        </div>
    );
}

async function AttendanceDataSection() {
    const classes = await getClasses();
    return <AttendanceClient classes={classes} />;
}

export default function AdminAttendancePage() {
    return (
        <Suspense fallback={<AttendanceLoadingFallback />}>
            <AttendanceDataSection />
        </Suspense>
    );
}
