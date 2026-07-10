import { getAcademySettings } from "@/lib/queries";
import AdminSettingsClient from "./AdminSettingsClient";
import { Suspense } from "react";

// 30초 캐시: 아무도 수정 안 할 때 캐시 유지, Server Action 호출 시 즉시 무효화
export const revalidate = 30;

function AdminSettingsLoadingFallback() {
    return (
        <div className="space-y-6">
            <div>
                <div className="h-8 w-48 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                <div className="mt-2 h-4 w-96 max-w-full rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
            </div>

            <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
                <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                    <div className="space-y-2">
                        {Array.from({ length: 7 }).map((_, index) => (
                            <div
                                key={index}
                                className={`h-10 rounded-lg animate-pulse ${
                                    index === 0 ? "bg-gray-200 dark:bg-gray-700" : "bg-gray-100 dark:bg-gray-700"
                                }`}
                            />
                        ))}
                    </div>
                </div>

                <div className="space-y-5">
                    {Array.from({ length: 4 }).map((_, sectionIndex) => (
                        <div
                            key={sectionIndex}
                            className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800"
                        >
                            <div className="h-6 w-40 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                            <div className="mt-5 grid gap-4 md:grid-cols-2">
                                {Array.from({ length: 4 }).map((__, fieldIndex) => (
                                    <div key={fieldIndex}>
                                        <div className="h-4 w-24 rounded bg-gray-100 dark:bg-gray-700 animate-pulse" />
                                        <div className="mt-2 h-11 rounded-lg bg-gray-100 dark:bg-gray-700 animate-pulse" />
                                    </div>
                                ))}
                            </div>
                            <div className="mt-5 h-28 rounded-lg bg-gray-100 dark:bg-gray-700 animate-pulse" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

async function AdminSettingsDataSection() {
    let settings = null;
    let fetchError = false;

    try {
        // 설정 저장 로직에서 누락 컬럼을 필요한 순간 보장하므로, 화면 진입은 조회만 빠르게 수행한다.
        settings = await getAcademySettings();
    } catch (e) {
        console.error("Error fetching settings:", e);
        fetchError = true;
    }

    return <AdminSettingsClient initialSettings={settings} fetchError={fetchError} />;
}

export default function AdminSettingsPage() {
    return (
        <Suspense fallback={<AdminSettingsLoadingFallback />}>
            <AdminSettingsDataSection />
        </Suspense>
    );
}
