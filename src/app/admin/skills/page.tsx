import { Suspense } from "react";
import { getSkillCategories } from "@/lib/queries";
import SkillsClient from "./SkillsClient";

// Keep the admin page cache policy while letting the shell render first.
export const revalidate = 30;

function SkillsLoadingFallback() {
    return (
        <div className="space-y-6">
            <div>
                <div className="h-8 w-40 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                <div className="mt-2 h-4 w-96 max-w-full rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
            </div>

            <div className="flex w-fit gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
                <div className="h-9 w-32 rounded-md bg-white shadow-sm dark:bg-gray-700 animate-pulse" />
                <div className="h-9 w-28 rounded-md bg-gray-200 dark:bg-gray-700 animate-pulse" />
            </div>

            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
                <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 dark:border-gray-800">
                    <div className="h-5 w-36 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                    <div className="h-10 w-32 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
                </div>
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                    {Array.from({ length: 5 }).map((_, index) => (
                        <div key={index} className="grid grid-cols-6 gap-4 px-6 py-4">
                            <div className="h-4 rounded bg-gray-100 dark:bg-gray-700 animate-pulse" />
                            <div className="h-4 rounded bg-gray-100 dark:bg-gray-700 animate-pulse" />
                            <div className="h-4 rounded bg-gray-100 dark:bg-gray-700 animate-pulse" />
                            <div className="h-4 rounded bg-gray-100 dark:bg-gray-700 animate-pulse" />
                            <div className="h-4 rounded bg-gray-100 dark:bg-gray-700 animate-pulse" />
                            <div className="h-8 rounded-lg bg-gray-100 dark:bg-gray-700 animate-pulse" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

async function SkillsDataSection() {
    const categories = await getSkillCategories();

    return <SkillsClient categories={categories} />;
}

export default function AdminSkillsPage() {
    return (
        <Suspense fallback={<SkillsLoadingFallback />}>
            <SkillsDataSection />
        </Suspense>
    );
}
