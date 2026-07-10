"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type ReportSession = {
    id: string;
    classId: string;
    date: string;
    topic: string | null;
    published: boolean;
    publishedAt: string | null;
    className: string;
    dayOfWeek: string;
    startTime: string;
    endTime: string;
    programName: string | null;
    coachName: string | null;
    attendanceCount: number;
};

type ReportListPayload = {
    sessions: ReportSession[];
};

const DAY_LABELS: Record<string, string> = {
    Mon: "월",
    Tue: "화",
    Wed: "수",
    Thu: "목",
    Fri: "금",
    Sat: "토",
    Sun: "일",
};

function ReportListLoadingFallback() {
    return (
        <div className="mx-auto max-w-5xl">
            <div className="mb-6">
                <div className="h-8 w-48 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                <div className="mt-2 h-4 w-96 max-w-full rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
            </div>
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
                <div className="overflow-x-auto">
                    <div className="min-w-[780px]">
                        <div className="grid grid-cols-[0.9fr_1.5fr_1.4fr_0.6fr_0.8fr_0.7fr] gap-4 border-b border-gray-200 bg-gray-50 px-5 py-3 dark:border-gray-700 dark:bg-gray-900">
                            {Array.from({ length: 6 }).map((_, index) => (
                                <div key={index} className="h-4 rounded bg-gray-100 dark:bg-gray-700 animate-pulse" />
                            ))}
                        </div>
                        <div className="divide-y divide-gray-100 dark:divide-gray-800">
                            {Array.from({ length: 7 }).map((_, index) => (
                                <div
                                    key={index}
                                    className="grid grid-cols-[0.9fr_1.5fr_1.4fr_0.6fr_0.8fr_0.7fr] gap-4 px-5 py-4"
                                >
                                    <div className="h-5 w-24 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                                    <div className="space-y-2">
                                        <div className="h-5 w-36 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                                        <div className="h-3 w-28 rounded bg-gray-100 dark:bg-gray-700 animate-pulse" />
                                    </div>
                                    <div className="h-5 w-40 rounded bg-gray-100 dark:bg-gray-700 animate-pulse" />
                                    <div className="mx-auto h-5 w-10 rounded bg-gray-100 dark:bg-gray-700 animate-pulse" />
                                    <div className="mx-auto h-6 w-16 rounded-full bg-gray-100 dark:bg-gray-700 animate-pulse" />
                                    <div className="mx-auto h-8 w-16 rounded-lg bg-gray-100 dark:bg-gray-700 animate-pulse" />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function ReportListErrorState({ onRetry }: { onRetry: () => void }) {
    return (
        <div className="mx-auto max-w-5xl rounded-2xl border border-red-100 bg-white p-8 text-center shadow-sm dark:border-red-900/40 dark:bg-gray-800">
            <span className="material-symbols-outlined mb-3 text-4xl text-red-500">error</span>
            <p className="font-bold text-gray-900 dark:text-white">수업 리포트 목록을 불러오지 못했습니다.</p>
            <button
                type="button"
                onClick={onRetry}
                className="mt-4 rounded-xl bg-brand-orange-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-orange-600 dark:bg-brand-neon-lime dark:text-brand-navy-900"
            >
                다시 시도
            </button>
        </div>
    );
}

export default function ReportListClient() {
    const [sessions, setSessions] = useState<ReportSession[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);

    const loadSessions = useCallback(async () => {
        setLoading(true);
        setLoadError(false);

        try {
            const response = await fetch("/api/admin/attendance/report?limit=50", { cache: "no-store" });
            if (!response.ok) {
                throw new Error("Failed to load report sessions.");
            }

            const data = (await response.json()) as ReportListPayload;
            setSessions(data.sessions);
        } catch (error) {
            console.error("Failed to load report sessions:", error);
            setLoadError(true);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadSessions();
    }, [loadSessions]);

    if (loading && sessions.length === 0) {
        return <ReportListLoadingFallback />;
    }

    if (loadError && sessions.length === 0) {
        return <ReportListErrorState onRetry={loadSessions} />;
    }

    return (
        <div className="mx-auto max-w-5xl">
            <div className="mb-6">
                <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">수업 리포트 관리</h1>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    출결이 기록된 수업의 리포트를 작성하고 학부모에게 발행할 수 있습니다.
                </p>
            </div>

            {sessions.length === 0 ? (
                <div className="rounded-xl border border-gray-200 bg-white p-12 text-center text-gray-400 dark:border-gray-700 dark:bg-gray-800">
                    출결이 기록된 수업이 없습니다. 먼저 출결을 기록해주세요.
                </div>
            ) : (
                <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[780px] text-sm">
                            <thead>
                                <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900">
                                    <th className="px-5 py-3 text-left font-bold text-gray-700 dark:text-gray-200">날짜</th>
                                    <th className="px-5 py-3 text-left font-bold text-gray-700 dark:text-gray-200">반</th>
                                    <th className="px-5 py-3 text-left font-bold text-gray-700 dark:text-gray-200">주제</th>
                                    <th className="px-5 py-3 text-center font-bold text-gray-700 dark:text-gray-200">출석</th>
                                    <th className="px-5 py-3 text-center font-bold text-gray-700 dark:text-gray-200">상태</th>
                                    <th className="px-5 py-3 text-center font-bold text-gray-700 dark:text-gray-200">관리</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                {sessions.map((session) => {
                                    const dateStr = new Date(session.date).toLocaleDateString("ko-KR", {
                                        year: "numeric",
                                        month: "short",
                                        day: "numeric",
                                    });

                                    return (
                                        <tr key={session.id} className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-900">
                                            <td className="px-5 py-3 font-medium text-gray-900 dark:text-white">{dateStr}</td>
                                            <td className="px-5 py-3 text-gray-700 dark:text-gray-200">
                                                {session.className}
                                                <span className="ml-1 text-xs text-gray-400">
                                                    ({DAY_LABELS[session.dayOfWeek] || session.dayOfWeek} {session.startTime}~{session.endTime})
                                                </span>
                                            </td>
                                            <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                                                {session.topic || <span className="text-gray-300">미작성</span>}
                                            </td>
                                            <td className="px-5 py-3 text-center text-gray-600 dark:text-gray-300">{session.attendanceCount}명</td>
                                            <td className="px-5 py-3 text-center">
                                                {session.published ? (
                                                    <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-bold text-green-700">
                                                        <span className="material-symbols-outlined text-sm">check_circle</span>
                                                        발행됨
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-bold text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                                                        <span className="material-symbols-outlined text-sm">edit_note</span>
                                                        미발행
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-5 py-3 text-center">
                                                <Link
                                                    href={`/admin/attendance/report/${session.id}`}
                                                    prefetch={false}
                                                    className="inline-flex items-center gap-1 rounded-lg bg-brand-orange-500 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-orange-600 dark:bg-brand-neon-lime dark:text-brand-navy-900"
                                                >
                                                    <span className="material-symbols-outlined text-sm">edit</span>
                                                    편집
                                                </Link>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
