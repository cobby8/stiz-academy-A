import { getAcademySettings, getClassSlotOverrides, getCoaches, getCustomClassSlots, getPrograms } from "@/lib/queries";
import { fetchSheetScheduleAdmin } from "@/lib/googleSheetsSchedule";
import ScheduleAdminClient from "./ScheduleAdminClient";
import { Suspense } from "react";

export const revalidate = 30;

function ScheduleLoadingFallback() {
    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                    <div className="h-8 w-48 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                    <div className="mt-2 h-4 w-96 max-w-full rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
                </div>
                <div className="flex flex-wrap gap-2">
                    <div className="h-10 w-36 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
                    <div className="h-10 w-28 rounded-lg bg-gray-100 dark:bg-gray-700 animate-pulse" />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, index) => (
                    <div
                        key={index}
                        className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800"
                    >
                        <div className="h-4 w-24 rounded bg-gray-100 dark:bg-gray-700 animate-pulse" />
                        <div className="mt-3 h-7 w-16 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                    </div>
                ))}
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
                <div className="border-b border-gray-100 p-5 dark:border-gray-700">
                    <div className="h-6 w-40 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                    <div className="mt-2 h-3 w-72 max-w-full rounded bg-gray-100 dark:bg-gray-700 animate-pulse" />
                </div>
                <div className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-3">
                    {Array.from({ length: 9 }).map((_, index) => (
                        <div key={index} className="rounded-xl border border-gray-100 p-4 dark:border-gray-700">
                            <div className="flex items-center justify-between gap-3">
                                <div className="h-5 w-24 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                                <div className="h-6 w-16 rounded-full bg-gray-100 dark:bg-gray-700 animate-pulse" />
                            </div>
                            <div className="mt-4 space-y-2">
                                <div className="h-4 rounded bg-gray-100 dark:bg-gray-700 animate-pulse" />
                                <div className="h-4 w-2/3 rounded bg-gray-100 dark:bg-gray-700 animate-pulse" />
                            </div>
                            <div className="mt-4 h-9 rounded-lg bg-gray-100 dark:bg-gray-700 animate-pulse" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

async function ScheduleDataSection() {
    // 1단계: settings만 먼저 가져옴 (Google Sheets URL이 필요하므로)
    const settings = await (getAcademySettings() as Promise<any>);
    const sheetUrl = settings?.googleSheetsScheduleUrl as string | null | undefined;

    // 2단계: 나머지 DB 쿼리 4개 + Google Sheets를 모두 병렬로 동시 실행
    // Google Sheets는 외부 네트워크 호출(500ms~2초)이므로 DB 쿼리와 동시에 실행하면 대기 시간 절감
    const [overrides, coaches, customSlots, programs, slots] = await Promise.all([
        getClassSlotOverrides(),
        getCoaches(),
        getCustomClassSlots(),
        getPrograms(),
        sheetUrl
            ? fetchSheetScheduleAdmin(sheetUrl).catch(() => [])
            : Promise.resolve([]),
    ]);

    return (
        <ScheduleAdminClient
            slots={slots}
            overrides={overrides as any[]}
            coaches={coaches as any[]}
            customSlots={customSlots as any[]}
            hasSheetUrl={!!sheetUrl}
            sheetUrl={sheetUrl ?? null}
            programs={programs as any[]}
        />
    );
}

export default function AdminSchedulePage() {
    return (
        <Suspense fallback={<ScheduleLoadingFallback />}>
            <ScheduleDataSection />
        </Suspense>
    );
}
