import { getAcademySettings } from "@/lib/queries";
import TermsAdminClient from "./TermsAdminClient";
import { Suspense } from "react";

// 30초 캐시: Server Action 호출 시 즉시 무효화
export const revalidate = 30;

function TermsLoadingFallback() {
    return (
        <div className="space-y-6">
            <div>
                <div className="h-8 w-48 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                <div className="mt-2 h-4 w-96 max-w-full rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                <div className="h-5 w-28 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                <div className="mt-4 h-[520px] rounded-lg bg-gray-100 dark:bg-gray-700 animate-pulse" />
                <div className="mt-4 flex justify-end gap-2">
                    <div className="h-10 w-24 rounded-lg bg-gray-100 dark:bg-gray-700 animate-pulse" />
                    <div className="h-10 w-24 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
                </div>
            </div>
        </div>
    );
}

async function TermsDataSection() {
    let termsOfService: string | null = null;
    try {
        const settings = await getAcademySettings();
        termsOfService = (settings as any)?.termsOfService ?? null;
    } catch (e) {
        console.error("Error fetching terms:", e);
    }
    return <TermsAdminClient termsOfService={termsOfService} />;
}

export default function AdminTermsPage() {
    return (
        <Suspense fallback={<TermsLoadingFallback />}>
            <TermsDataSection />
        </Suspense>
    );
}
