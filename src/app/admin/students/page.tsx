import { Suspense } from "react";
import { getStudents, getClasses } from "@/lib/queries";
import StudentManagementClient from "./StudentManagementClient";

// 30초 캐시: 아무도 수정 안 할 때 캐시 유지, Server Action 호출 시 즉시 무효화
export const revalidate = 30;

function StudentsLoadingFallback() {
    return (
        <div className="max-w-5xl mx-auto space-y-6">
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                {Array.from({ length: 5 }).map((_, index) => (
                    <div
                        key={index}
                        className="h-20 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 animate-pulse"
                    />
                ))}
            </div>
            <div className="flex justify-between items-center">
                <div className="space-y-2">
                    <div className="h-7 w-36 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                    <div className="h-4 w-48 rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
                </div>
                <div className="h-10 w-28 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
            </div>
            <div className="h-11 w-full max-w-md rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse" />
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
                {Array.from({ length: 8 }).map((_, index) => (
                    <div
                        key={index}
                        className="h-12 border-b border-gray-100 dark:border-gray-700 last:border-b-0 bg-gray-50/60 dark:bg-gray-900/40 animate-pulse"
                    />
                ))}
            </div>
        </div>
    );
}

async function StudentsDataSection() {
    const [students, classes] = await Promise.all([
        getStudents(),
        getClasses(),
    ]);
    return <StudentManagementClient students={students} classes={classes} />;
}

export default function AdminStudentsPage() {
    return (
        <Suspense fallback={<StudentsLoadingFallback />}>
            <StudentsDataSection />
        </Suspense>
    );
}
