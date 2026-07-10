import { Suspense } from "react";
import { getPrograms, getClasses } from "@/lib/queries";
import ClassManagementClient from "./ClassManagementClient";

// 30초 캐시: 아무도 수정 안 할 때 캐시 유지, Server Action 호출 시 즉시 무효화
export const revalidate = 30;

function ClassesLoadingFallback() {
    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <div className="space-y-2">
                    <div className="h-8 w-40 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                    <div className="h-4 w-80 rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
                </div>
                <div className="h-10 w-24 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
            </div>
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
                <div className="h-16 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 animate-pulse" />
                {Array.from({ length: 7 }).map((_, index) => (
                    <div
                        key={index}
                        className="h-16 border-b border-gray-100 dark:border-gray-700 last:border-b-0 bg-white dark:bg-gray-800 animate-pulse"
                    />
                ))}
            </div>
        </div>
    );
}

async function ClassesDataSection() {
    const [programs, classes] = await Promise.all([
        getPrograms(),
        getClasses(),
    ]);
    return <ClassManagementClient programs={programs} classes={classes} />;
}

export default function AdminClassesPage() {
    return (
        <Suspense fallback={<ClassesLoadingFallback />}>
            <ClassesDataSection />
        </Suspense>
    );
}
