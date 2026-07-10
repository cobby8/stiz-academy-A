/**
 * SMS 템플릿 관리 페이지 — Server Component
 *
 * DB에서 템플릿 목록을 조회한 후 클라이언트 컴포넌트에 전달한다.
 * ensureSmsTemplates()가 내부적으로 DDL + seed를 보장하므로 별도 처리 불필요.
 */

import { Suspense } from "react";
import { getSmsTemplates } from "@/lib/queries";
import SmsTemplateClient from "./SmsTemplateClient";

export const dynamic = "force-dynamic";

function SmsTemplatesLoadingFallback() {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between gap-4">
                <div>
                    <div className="h-8 w-48 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                    <div className="mt-2 h-4 w-96 max-w-full rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
                </div>
                <div className="h-10 w-24 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
            </div>
            <div className="flex w-fit gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
                <div className="h-9 w-36 rounded-md bg-white dark:bg-gray-700 animate-pulse" />
                <div className="h-9 w-28 rounded-md bg-gray-200 dark:bg-gray-700 animate-pulse" />
            </div>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {Array.from({ length: 6 }).map((_, index) => (
                    <div
                        key={index}
                        className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800"
                    >
                        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-gray-800">
                            <div className="flex min-w-0 items-center gap-2.5">
                                <div className="h-5 w-40 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                                <div className="h-5 w-14 rounded-full bg-gray-100 dark:bg-gray-700 animate-pulse" />
                            </div>
                            <div className="h-6 w-11 rounded-full bg-gray-100 dark:bg-gray-700 animate-pulse" />
                        </div>
                        <div className="px-5 pt-3">
                            <div className="h-4 w-64 max-w-full rounded bg-gray-100 dark:bg-gray-700 animate-pulse" />
                        </div>
                        <div className="px-5 py-3">
                            <div className="h-28 rounded-lg bg-gray-100 dark:bg-gray-700 animate-pulse" />
                            <div className="mt-3 flex flex-wrap gap-2">
                                {Array.from({ length: 5 }).map((_, chipIndex) => (
                                    <div key={chipIndex} className="h-7 w-20 rounded-full bg-gray-100 dark:bg-gray-700 animate-pulse" />
                                ))}
                            </div>
                            <div className="mt-4 flex justify-end gap-2">
                                <div className="h-9 w-20 rounded-lg bg-gray-100 dark:bg-gray-700 animate-pulse" />
                                <div className="h-9 w-20 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

async function SmsTemplatesDataSection() {
    // 전체 템플릿 조회 (DDL + seed 자동)
    const templates = await getSmsTemplates();

    return <SmsTemplateClient templates={templates} />;
}

export default function SmsTemplatesPage() {
    return (
        <Suspense fallback={<SmsTemplatesLoadingFallback />}>
            <SmsTemplatesDataSection />
        </Suspense>
    );
}
