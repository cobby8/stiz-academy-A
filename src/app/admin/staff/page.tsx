/**
 * 스태프 관리 페이지 — 서버 컴포넌트
 * ADMIN/VICE_ADMIN/INSTRUCTOR 사용자 목록 + Coach 연결 + 초대 목록을 조회하여 클라이언트에 전달
 * revalidate: 30 — 역할 변경 시 Server Action에서 revalidatePath로 즉시 갱신
 */

import { getStaffUsers, getAllCoaches, getStaffInvitations } from "@/lib/queries";
import StaffClient from "./StaffClient";
import { Suspense } from "react";

export const revalidate = 30;

function StaffLoadingFallback() {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between gap-4">
                <div>
                    <div className="h-8 w-40 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                    <div className="mt-2 h-4 w-96 max-w-full rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
                </div>
                <div className="flex gap-2">
                    <div className="h-10 w-32 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
                    <div className="h-10 w-24 rounded-lg bg-gray-100 dark:bg-gray-700 animate-pulse" />
                </div>
            </div>

            <div className="rounded-xl border border-yellow-200 bg-white shadow-sm dark:border-yellow-900/50 dark:bg-gray-800">
                <div className="border-b border-yellow-100 bg-yellow-50 px-6 py-4 dark:border-yellow-900/50 dark:bg-yellow-900/20">
                    <div className="h-5 w-40 rounded bg-yellow-100 dark:bg-yellow-900/50 animate-pulse" />
                </div>
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                    {Array.from({ length: 2 }).map((_, index) => (
                        <div key={index} className="flex items-center gap-4 px-6 py-4">
                            <div className="h-10 w-10 rounded-full bg-gray-100 dark:bg-gray-700 animate-pulse" />
                            <div className="min-w-0 flex-1">
                                <div className="h-4 w-32 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                                <div className="mt-2 h-3 w-48 max-w-full rounded bg-gray-100 dark:bg-gray-700 animate-pulse" />
                            </div>
                            <div className="h-8 w-24 rounded-lg bg-gray-100 dark:bg-gray-700 animate-pulse" />
                        </div>
                    ))}
                </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
                <div className="border-b border-gray-100 px-6 py-4 dark:border-gray-700">
                    <div className="h-5 w-32 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                </div>
                <div className="overflow-hidden">
                    {Array.from({ length: 6 }).map((_, index) => (
                        <div key={index} className="grid grid-cols-4 gap-4 border-b border-gray-50 px-6 py-4 last:border-0 dark:border-gray-700">
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

async function StaffDataSection() {
    // 구조 보강은 스태프 생성/역할 변경/초대 액션에서 수행하고, 목록 화면은 읽기만 빠르게 처리한다.
    const [staffUsers, coaches, invitations] = await Promise.all([
        getStaffUsers(),
        getAllCoaches(),
        getStaffInvitations(),
    ]);

    return (
        <StaffClient
            staffUsers={staffUsers}
            coaches={coaches}
            invitations={invitations}
        />
    );
}

export default function StaffPage() {
    return (
        <Suspense fallback={<StaffLoadingFallback />}>
            <StaffDataSection />
        </Suspense>
    );
}
