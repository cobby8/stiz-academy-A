"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";

type DashboardStats = {
    studentCount: number;
    programCount: number;
    coachCount: number;
    classCount: number;
};

type EnrollStats = {
    PENDING: number;
    APPROVED: number;
    REJECTED: number;
    CANCELLED: number;
    total: number;
};

type PendingRequest = {
    id: string;
    title: string;
    createdAt: string;
    studentName: string | null;
    parentName: string | null;
};

type ExtendedStats = {
    thisMonthRevenue: number;
    lastMonthRevenue: number;
    attendanceRate: number;
    unpaidCount: number;
    unpaidAmount: number;
    monthlyRevenue: { month: string; amount: number }[];
    monthlyAttendance: { month: string; rate: number }[];
    programStudents: { name: string; count: number }[];
};

type TodayClass = {
    id: string;
    name: string;
    startTime: string | null;
    endTime: string | null;
    capacity: number;
    programName: string | null;
    enrolled: number;
};

type RecentStudent = {
    id: string;
    name: string;
    createdAt: string;
    parentName: string | null;
};

type DashboardData = {
    stats: DashboardStats;
    pendingRequests: PendingRequest[];
    pendingCount: number;
    enrollStats: EnrollStats;
    extendedStats: ExtendedStats;
    todayClasses: TodayClass[];
    recentStudents: RecentStudent[];
    todayLabel?: string;
};

type SystemStatusData = {
    dbOk: boolean;
    backup: {
        lastBackupAt: string | null;
        backupCount: number;
    };
};

function SymbolIcon({
    name,
    size = 18,
    className = "",
}: {
    name: string;
    size?: number;
    className?: string;
}) {
    return (
        <span
            className={`material-symbols-outlined leading-none ${className}`}
            style={{ fontSize: `${size}px` }}
            aria-hidden="true"
        >
            {name}
        </span>
    );
}

function formatKRW(n: number): string {
    if (n >= 10000) return `${(n / 10000).toFixed(n % 10000 === 0 ? 0 : 1)}만원`;
    return n.toLocaleString("ko-KR") + "원";
}

function DashboardPrimarySkeleton() {
    return (
        <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 animate-pulse">
                        <div className="flex justify-between items-start">
                            <div>
                                <div className="h-3 bg-gray-200 rounded w-16 mb-2" />
                                <div className="h-7 bg-gray-200 rounded w-20" />
                            </div>
                            <div className="h-10 w-10 bg-gray-100 dark:bg-gray-900 rounded-xl" />
                        </div>
                    </div>
                ))}
            </div>
            <SlowSectionSkeleton />
        </>
    );
}

function SlowSectionSkeleton() {
    return (
        <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 animate-pulse">
                        <div className="h-3 bg-gray-200 rounded w-20 mb-2" />
                        <div className="h-7 bg-gray-200 rounded w-24" />
                    </div>
                ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {[...Array(2)].map((_, i) => (
                    <div key={i} className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 animate-pulse">
                        <div className="h-4 bg-gray-200 rounded w-40 mb-4" />
                        <div className="h-40 bg-gray-100 dark:bg-gray-800 rounded" />
                    </div>
                ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {[...Array(2)].map((_, i) => (
                    <div key={i} className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 animate-pulse">
                        <div className="h-4 bg-gray-200 rounded w-32 mb-4" />
                        <div className="space-y-3">
                            {[...Array(3)].map((_, j) => (
                                <div key={j} className="h-10 bg-gray-100 dark:bg-gray-800 rounded" />
                            ))}
                        </div>
                    </div>
                ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {[...Array(3)].map((_, i) => (
                    <div key={i} className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 animate-pulse">
                        <div className="h-4 bg-gray-200 rounded w-32 mb-4" />
                        <div className="space-y-3">
                            {[...Array(3)].map((_, j) => (
                                <div key={j} className="h-6 bg-gray-100 dark:bg-gray-800 rounded" />
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </>
    );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
    return (
        <div className="rounded-2xl border border-red-100 bg-white p-8 text-center shadow-sm dark:border-red-900/40 dark:bg-gray-800">
            <SymbolIcon name="error" size={36} className="mx-auto mb-3 text-red-500" />
            <p className="font-bold text-gray-900 dark:text-white">대시보드 데이터를 불러오지 못했습니다.</p>
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

export default function AdminDashboardClient({
    initialData,
    hydrateFullData = false,
}: {
    initialData?: DashboardData;
    hydrateFullData?: boolean;
}) {
    const hasInitialData = initialData !== undefined;
    const [data, setData] = useState<DashboardData | null>(initialData ?? null);
    const [loading, setLoading] = useState(!hasInitialData);
    const [error, setError] = useState<string | null>(null);
    const [systemStatus, setSystemStatus] = useState<SystemStatusData | null>(null);
    const [systemLoading, setSystemLoading] = useState(false);
    const [systemError, setSystemError] = useState(false);

    const loadDashboard = useCallback(async (showSkeleton = true) => {
        if (showSkeleton) setLoading(true);
        setError(null);

        try {
            const res = await fetch("/api/admin/dashboard");
            if (!res.ok) throw new Error("Dashboard request failed");
            setData((await res.json()) as DashboardData);
        } catch {
            setError("failed");
        } finally {
            if (showSkeleton) setLoading(false);
        }
    }, []);

    const loadSystemStatus = useCallback(async () => {
        setSystemError(false);
        setSystemLoading(true);

        try {
            const res = await fetch("/api/admin/dashboard/system");
            if (!res.ok) throw new Error("System status request failed");
            setSystemStatus((await res.json()) as SystemStatusData);
        } catch {
            setSystemError(true);
        } finally {
            setSystemLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!hasInitialData) {
            void loadDashboard(true);
            return;
        }
        if (!hydrateFullData) return;

        const timer = window.setTimeout(() => {
            void loadDashboard(false);
        }, 1200);

        return () => window.clearTimeout(timer);
    }, [hasInitialData, hydrateFullData, loadDashboard]);

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            <div>
                <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white mb-1">경영 대시보드</h1>
                <p className="text-gray-500 dark:text-gray-400 text-sm">스티즈농구교실 다산점의 운영 현황입니다.</p>
            </div>

            {loading && !data && <DashboardPrimarySkeleton />}
            {!loading && !data && error && <ErrorState onRetry={() => void loadDashboard(true)} />}
            {data && (
                <DashboardContent
                    data={data}
                    systemStatus={systemStatus}
                    systemLoading={systemLoading}
                    systemError={systemError}
                    onRetrySystem={loadSystemStatus}
                />
            )}
        </div>
    );
}

function DashboardContent({
    data,
    systemStatus,
    systemLoading,
    systemError,
    onRetrySystem,
}: {
    data: DashboardData;
    systemStatus: SystemStatusData | null;
    systemLoading: boolean;
    systemError: boolean;
    onRetrySystem: () => void;
}) {
    const { stats, pendingRequests, pendingCount, enrollStats, extendedStats, todayClasses, recentStudents } = data;
    const revDiff = extendedStats.lastMonthRevenue > 0
        ? Math.round(((extendedStats.thisMonthRevenue - extendedStats.lastMonthRevenue) / extendedStats.lastMonthRevenue) * 100)
        : extendedStats.thisMonthRevenue > 0 ? 100 : 0;
    const maxRevenue = Math.max(...extendedStats.monthlyRevenue.map((m) => m.amount), 1);
    const dayLabels: Record<string, string> = { Sun: "일", Mon: "월", Tue: "화", Wed: "수", Thu: "목", Fri: "금", Sat: "토" };
    const todayLabel = data.todayLabel ?? `${dayLabels[["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date().getDay()]]}요일`;

    return (
        <>
            {pendingCount > 0 && (
                <Link href="/admin/requests" prefetch={false}
                    className="flex items-center gap-3 bg-yellow-50 border border-yellow-200 rounded-2xl p-4 hover:bg-yellow-100 transition shadow-sm">
                    <div className="bg-yellow-400 text-white p-2 rounded-full">
                        <SymbolIcon name="forum" size={20} />
                    </div>
                    <div className="flex-1">
                        <p className="font-bold text-yellow-800">미처리 요청 {pendingCount}건</p>
                        <p className="text-xs text-yellow-600 mt-0.5">
                            {pendingRequests.slice(0, 2).map((r) => `${r.studentName ?? "-"} - ${r.title}`).join(" / ")}
                            {pendingCount > 2 && ` 외 ${pendingCount - 2}건`}
                        </p>
                    </div>
                    <span className="text-yellow-600 text-sm font-bold">처리하기 &rarr;</span>
                </Link>
            )}

            {enrollStats.PENDING > 0 && (
                <Link href="/admin/apply" prefetch={false}
                    className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-2xl p-4 hover:bg-blue-100 transition shadow-sm">
                    <div className="bg-blue-500 text-white p-2 rounded-full">
                        <SymbolIcon name="person_add" size={20} />
                    </div>
                    <div className="flex-1">
                        <p className="font-bold text-blue-800">수강 신청 대기 {enrollStats.PENDING}건</p>
                        <p className="text-xs text-blue-600 mt-0.5">승인 대기 중인 수강 신청서가 있습니다. 확인해주세요.</p>
                    </div>
                    <span className="text-blue-600 text-sm font-bold">처리하기 &rarr;</span>
                </Link>
            )}

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard title="등록 원생" value={`${stats.studentCount}명`}
                    icon={<SymbolIcon name="groups" size={20} className="text-blue-500" />} href="/admin/students" />
                <StatCard title="운영 프로그램" value={`${stats.programCount}개`}
                    icon={<SymbolIcon name="menu_book" size={20} className="text-brand-orange-500 dark:text-brand-neon-lime" />} href="/admin/programs" />
                <StatCard title="코치/강사진" value={`${stats.coachCount}명`}
                    icon={<SymbolIcon name="person_check" size={20} className="text-emerald-500" />} href="/admin/coaches" />
                <StatCard title="개설 반" value={`${stats.classCount}개`}
                    icon={<SymbolIcon name="layers" size={20} className="text-purple-500" />} href="/admin/classes" />
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">이번 달 매출</p>
                    <h3 className="text-2xl font-extrabold text-gray-900 dark:text-white">{formatKRW(extendedStats.thisMonthRevenue)}</h3>
                    {extendedStats.lastMonthRevenue > 0 && (
                        <div className={`flex items-center gap-1 mt-1 text-xs font-medium ${revDiff >= 0 ? "text-green-600" : "text-red-600"}`}>
                            <SymbolIcon name={revDiff > 0 ? "trending_up" : revDiff < 0 ? "trending_down" : "remove"} size={14} />
                            전월 대비 {revDiff > 0 ? "+" : ""}{revDiff}%
                        </div>
                    )}
                </div>
                <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">이번 달 출석률</p>
                    <h3 className="text-2xl font-extrabold text-gray-900 dark:text-white">{extendedStats.attendanceRate}%</h3>
                    <p className="text-xs text-gray-400 mt-1">전체 수업 기준</p>
                </div>
                <Link href="/admin/finance" prefetch={false} className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 hover:border-red-200 transition">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">미납 현황</p>
                    <h3 className={`text-2xl font-extrabold ${extendedStats.unpaidCount > 0 ? "text-red-600" : "text-gray-900 dark:text-white"}`}>
                        {extendedStats.unpaidCount}건
                    </h3>
                    {extendedStats.unpaidAmount > 0 && (
                        <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                            <SymbolIcon name="warning" size={12} /> {formatKRW(extendedStats.unpaidAmount)}
                        </p>
                    )}
                </Link>
                <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">전월 매출</p>
                    <h3 className="text-2xl font-extrabold text-gray-900 dark:text-white">{formatKRW(extendedStats.lastMonthRevenue)}</h3>
                </div>
            </div>

            <Link href="/admin/stats" prefetch={false} className="flex items-center justify-between bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-2xl p-4 hover:from-indigo-100 hover:to-purple-100 transition shadow-sm">
                <div className="flex items-center gap-3">
                    <SymbolIcon name="monitoring" size={28} className="text-indigo-600" />
                    <div>
                        <p className="font-bold text-indigo-800">상세 운영 통계</p>
                        <p className="text-xs text-indigo-600 mt-0.5">매출, 출석률, 원생 추이, 체험 전환율, 코치 워크로드를 한 눈에</p>
                    </div>
                </div>
                <span className="text-indigo-600 text-sm font-bold">보러가기 &rarr;</span>
            </Link>

            <ChartsSection extendedStats={extendedStats} maxRevenue={maxRevenue} />
            <TodayAndRecentSection
                todayClasses={todayClasses}
                todayLabel={todayLabel}
                recentStudents={recentStudents}
                pendingRequests={pendingRequests}
            />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <ProgramStudentsCard programStudents={extendedStats.programStudents} />
                <QuickManagementCard />
                <SystemStatusCard
                    systemStatus={systemStatus}
                    systemLoading={systemLoading}
                    systemError={systemError}
                    onRetry={onRetrySystem}
                />
            </div>
        </>
    );
}

function ChartsSection({ extendedStats, maxRevenue }: { extendedStats: ExtendedStats; maxRevenue: number }) {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
                <h3 className="font-bold text-gray-900 dark:text-white mb-4">매출 추이 (최근 6개월)</h3>
                <div className="flex items-end gap-2 h-40">
                    {extendedStats.monthlyRevenue.map((m, i) => (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1">
                            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                                {m.amount > 0 ? formatKRW(m.amount) : ""}
                            </span>
                            <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-t-lg relative" style={{ height: "120px" }}>
                                <div
                                    className="absolute bottom-0 left-0 right-0 bg-brand-orange-500 dark:bg-brand-neon-lime dark:text-brand-navy-900 rounded-t-lg transition-all duration-500"
                                    style={{ height: `${maxRevenue > 0 ? (m.amount / maxRevenue) * 100 : 0}%` }}
                                />
                            </div>
                            <span className="text-xs text-gray-400">{m.month}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
                <h3 className="font-bold text-gray-900 dark:text-white mb-4">출석률 추이 (최근 6개월)</h3>
                <div className="flex items-end gap-2 h-40">
                    {extendedStats.monthlyAttendance.map((m, i) => (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1">
                            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                                {m.rate > 0 ? `${m.rate}%` : ""}
                            </span>
                            <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-t-lg relative" style={{ height: "120px" }}>
                                <div
                                    className="absolute bottom-0 left-0 right-0 bg-emerald-500 rounded-t-lg transition-all duration-500"
                                    style={{ height: `${m.rate}%` }}
                                />
                            </div>
                            <span className="text-xs text-gray-400">{m.month}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function TodayAndRecentSection({
    todayClasses,
    todayLabel,
    recentStudents,
    pendingRequests,
}: {
    todayClasses: TodayClass[];
    todayLabel: string;
    recentStudents: RecentStudent[];
    pendingRequests: PendingRequest[];
}) {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
                <h3 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <SymbolIcon name="event_available" size={18} className="text-brand-orange-500 dark:text-brand-neon-lime" />
                    오늘의 수업 ({todayLabel})
                </h3>
                {todayClasses.length === 0 ? (
                    <p className="text-sm text-gray-400">오늘은 수업이 없습니다</p>
                ) : (
                    <div className="space-y-2">
                        {todayClasses.map((c) => (
                            <div key={c.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                                <div>
                                    <p className="text-sm font-bold text-gray-900 dark:text-white">{c.name}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">{c.programName} &middot; {c.startTime}~{c.endTime}</p>
                                </div>
                                <div className="text-right">
                                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                        c.enrolled >= c.capacity ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
                                    }`}>
                                        {c.enrolled}/{c.capacity}명
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="space-y-6">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
                    <h3 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <SymbolIcon name="person_add" size={18} className="text-emerald-500" />
                        신규 원생 (최근 7일)
                    </h3>
                    {recentStudents.length === 0 ? (
                        <p className="text-sm text-gray-400">최근 등록된 원생이 없습니다</p>
                    ) : (
                        <div className="space-y-2">
                            {recentStudents.map((student) => (
                                <Link key={student.id} href={`/admin/students/${student.id}`} prefetch={false}
                                    className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0 hover:bg-gray-50 dark:bg-gray-900 rounded-lg px-2 transition">
                                    <div>
                                        <p className="text-sm font-bold text-gray-900 dark:text-white">{student.name}</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">학부모: {student.parentName ?? "-"}</p>
                                    </div>
                                    <span className="text-xs text-gray-400">
                                        {new Date(student.createdAt).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}
                                    </span>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>

                {pendingRequests.length > 0 && (
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-yellow-200">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <SymbolIcon name="schedule" size={18} className="text-yellow-500" />
                                대기중 요청
                            </h3>
                            <Link href="/admin/requests" prefetch={false} className="text-xs text-brand-orange-500 dark:text-brand-neon-lime hover:underline">전체보기</Link>
                        </div>
                        <div className="space-y-2">
                            {pendingRequests.map((request) => (
                                <Link key={request.id} href="/admin/requests" prefetch={false}
                                    className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0 hover:bg-yellow-50 rounded-lg px-2 transition">
                                    <div>
                                        <p className="text-sm font-bold text-gray-900 dark:text-white">{request.title}</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">{request.parentName ?? "-"} ({request.studentName ?? "-"})</p>
                                    </div>
                                    <span className="text-xs text-gray-400">
                                        {new Date(request.createdAt).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}
                                    </span>
                                </Link>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function ProgramStudentsCard({ programStudents }: { programStudents: { name: string; count: number }[] }) {
    const maxCnt = Math.max(...programStudents.map((item) => item.count), 1);

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
            <h3 className="font-bold text-gray-900 dark:text-white mb-4">프로그램별 원생 수</h3>
            {programStudents.length === 0 ? (
                <p className="text-sm text-gray-400">프로그램을 추가하세요</p>
            ) : (
                <div className="space-y-3">
                    {programStudents.map((program, index) => (
                        <div key={index}>
                            <div className="flex justify-between text-sm mb-1">
                                <span className="text-gray-700 dark:text-gray-200 font-medium truncate">{program.name}</span>
                                <span className="text-gray-500 dark:text-gray-400 font-bold">{program.count}명</span>
                            </div>
                            <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2">
                                <div
                                    className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                                    style={{ width: `${(program.count / maxCnt) * 100}%` }}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function QuickManagementCard() {
    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
            <h3 className="font-bold text-gray-900 dark:text-white mb-4">빠른 관리</h3>
            <div className="grid grid-cols-2 gap-3">
                <QuickLink title="출결 관리" href="/admin/attendance" color="orange" />
                <QuickLink title="수납/결제" href="/admin/finance" color="blue" />
                <QuickLink title="요청 관리" href="/admin/requests" color="orange" />
                <QuickLink title="갤러리" href="/admin/gallery" color="green" />
                <QuickLink title="공지사항" href="/admin/notices" color="purple" />
                <QuickLink title="시간표" href="/admin/schedule" color="orange" />
                <QuickLink title="설정" href="/admin/settings" color="blue" />
            </div>
        </div>
    );
}

function SystemStatusCard({
    systemStatus,
    systemLoading,
    systemError,
    onRetry,
}: {
    systemStatus: SystemStatusData | null;
    systemLoading: boolean;
    systemError: boolean;
    onRetry: () => void;
}) {
    const backup = systemStatus?.backup;
    const lastBackupAt = backup?.lastBackupAt ? new Date(backup.lastBackupAt) : null;
    const now = new Date();
    const backupAgeMs = lastBackupAt ? now.getTime() - lastBackupAt.getTime() : Infinity;
    const backupAgeDays = Math.floor(backupAgeMs / (1000 * 60 * 60 * 24));
    const backupAgeHours = Math.floor(backupAgeMs / (1000 * 60 * 60));
    const backupWarn = Boolean(systemStatus && backupAgeMs > 2 * 24 * 60 * 60 * 1000);
    const backupDanger = Boolean(systemStatus && backupAgeMs > 7 * 24 * 60 * 60 * 1000);

    function backupLabel() {
        if (!lastBackupAt) return "백업 없음";
        if (backupAgeHours < 1) return "방금 전";
        if (backupAgeHours < 24) return `${backupAgeHours}시간 전`;
        return `${backupAgeDays}일 전`;
    }

    return (
        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
            <div className="mb-3 flex items-center justify-between">
                <h3 className="font-bold text-gray-900 dark:text-white">시스템 상태</h3>
                <button
                    type="button"
                    onClick={onRetry}
                    disabled={systemLoading}
                    className="text-xs font-bold text-brand-orange-500 transition hover:text-orange-600 disabled:cursor-wait disabled:opacity-60 dark:text-brand-neon-lime"
                >
                    {systemLoading ? "확인 중" : systemError ? "다시 시도" : systemStatus ? "새로고침" : "확인"}
                </button>
            </div>
            <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                        <SymbolIcon name="database" size={14} className="text-gray-400" />
                        <span>데이터베이스</span>
                    </div>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        !systemStatus ? "bg-gray-100 text-gray-500" : systemStatus.dbOk ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                    }`}>
                        {systemLoading ? "확인 중" : !systemStatus ? "미확인" : systemStatus.dbOk ? "정상" : "오류"}
                    </span>
                </div>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                        <SymbolIcon name={backupWarn ? "cloud_off" : "cloud_done"} size={14} className={!systemStatus ? "text-gray-400" : backupDanger ? "text-red-500" : backupWarn ? "text-yellow-500" : "text-blue-500"} />
                        <span>마지막 백업</span>
                    </div>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${!systemStatus ? "bg-gray-100 text-gray-500" : backupDanger ? "bg-red-100 text-red-700" : backupWarn ? "bg-yellow-100 text-yellow-700" : "bg-green-100 text-green-700"}`}>
                        {systemLoading ? "확인 중" : !systemStatus ? "미확인" : backupLabel()}
                    </span>
                </div>
                {backup && backup.backupCount > 0 && (
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500 dark:text-gray-400">저장된 백업</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">{backup.backupCount}개</span>
                    </div>
                )}
                {systemStatus && backupDanger && (
                    <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
                        7일 이상 백업이 없습니다. 사이드바에서 즉시 저장하세요.
                    </p>
                )}
            </div>
        </div>
    );
}

function StatCard({ title, value, icon, href }: {
    title: string;
    value: string;
    icon: ReactNode;
    href?: string;
}) {
    const content = (
        <div className={`bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 ${href ? "hover:border-brand-orange-300 dark:border-brand-neon-lime transition-colors cursor-pointer" : ""}`}>
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{title}</p>
                    <h3 className="text-2xl font-extrabold text-gray-900 dark:text-white">{value}</h3>
                </div>
                <div className="p-2.5 bg-gray-50 dark:bg-gray-900 rounded-xl">{icon}</div>
            </div>
        </div>
    );
    if (href) return <Link href={href} prefetch={false}>{content}</Link>;
    return content;
}

function QuickLink({ title, href, color }: { title: string; href: string; color: string }) {
    const colorMap: Record<string, string> = {
        orange: "bg-orange-50 border-orange-200 hover:border-brand-orange-400",
        blue: "bg-blue-50 border-blue-200 hover:border-blue-400",
        green: "bg-green-50 border-green-200 hover:border-green-400",
        purple: "bg-purple-50 border-purple-200 hover:border-purple-400",
    };
    return (
        <Link href={href} prefetch={false} className={`p-3 rounded-xl border transition-colors text-center ${colorMap[color] || colorMap.orange}`}>
            <span className="font-bold text-sm text-gray-900 dark:text-white">{title}</span>
        </Link>
    );
}
