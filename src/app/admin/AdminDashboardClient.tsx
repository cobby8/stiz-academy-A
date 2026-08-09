"use client";

import { DocHead, DocSection, DocTable, DocFoot, issuedAt } from "@/components/doc";
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

type SiteOpsCheckStatus = "ok" | "fixed" | "warning" | "critical";

type SiteOpsCheck = {
    id: string;
    label: string;
    status: SiteOpsCheckStatus;
    message: string;
    actionLabel?: string;
    actionHref?: string;
};

type SiteOpsBotResult = {
    checkedAt: string;
    ok: boolean;
    fixedCount: number;
    manualActionCount: number;
    criticalCount: number;
    checks: SiteOpsCheck[];
    notified: boolean;
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

// 서류는 금액을 축약하지 않는다. "1.9만원"으로 적힌 정산서는 근거가 되지 못한다.
function formatKRW(n: number): string {
    return n.toLocaleString("ko-KR") + "원";
}

function DashboardPrimarySkeleton() {
    return (
        <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="bg-[var(--doc-surface)] p-5 rounded-[6px] border border-[var(--doc-rule)]">
                        <div className="flex justify-between items-start">
                            <div>
                                <div className="h-3 bg-[var(--doc-grid-head)] rounded w-16 mb-2" />
                                <div className="h-7 bg-[var(--doc-grid-head)] rounded w-20" />
                            </div>
                            <div className="h-10 w-10 bg-[var(--doc-grid-head)] rounded-[3px]" />
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
                    <div key={i} className="bg-[var(--doc-surface)] p-5 rounded-[6px] border border-[var(--doc-rule)]">
                        <div className="h-3 bg-[var(--doc-grid-head)] rounded w-20 mb-2" />
                        <div className="h-7 bg-[var(--doc-grid-head)] rounded w-24" />
                    </div>
                ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {[...Array(2)].map((_, i) => (
                    <div key={i} className="bg-[var(--doc-surface)] p-6 rounded-[6px] border border-[var(--doc-rule)]">
                        <div className="h-4 bg-[var(--doc-grid-head)] rounded w-40 mb-4" />
                        <div className="h-40 bg-[var(--doc-grid-head)] rounded" />
                    </div>
                ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {[...Array(2)].map((_, i) => (
                    <div key={i} className="bg-[var(--doc-surface)] p-6 rounded-[6px] border border-[var(--doc-rule)]">
                        <div className="h-4 bg-[var(--doc-grid-head)] rounded w-32 mb-4" />
                        <div className="space-y-3">
                            {[...Array(3)].map((_, j) => (
                                <div key={j} className="h-10 bg-[var(--doc-grid-head)] rounded" />
                            ))}
                        </div>
                    </div>
                ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {[...Array(3)].map((_, i) => (
                    <div key={i} className="bg-[var(--doc-surface)] p-6 rounded-[6px] border border-[var(--doc-rule)]">
                        <div className="h-4 bg-[var(--doc-grid-head)] rounded w-32 mb-4" />
                        <div className="space-y-3">
                            {[...Array(3)].map((_, j) => (
                                <div key={j} className="h-6 bg-[var(--doc-grid-head)] rounded" />
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
        <div className="rounded-[6px] border border-[var(--doc-crit)] bg-[var(--doc-surface)] p-8 text-center">
            <SymbolIcon name="error" size={36} className="mx-auto mb-3 text-[var(--doc-crit)]" />
            <p className="font-bold text-[var(--doc-ink)]">대시보드 데이터를 불러오지 못했습니다.</p>
            <button
                type="button"
                onClick={onRetry}
                className="mt-4 rounded-[3px] bg-[var(--doc-accent)] px-4 py-2 text-sm font-bold text-white transition hover:bg-[var(--doc-grid-head)]"
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
    const [detailsLoaded, setDetailsLoaded] = useState(!hasInitialData);
    const [detailsLoading, setDetailsLoading] = useState(false);
    const [systemStatus, setSystemStatus] = useState<SystemStatusData | null>(null);
    const [systemLoading, setSystemLoading] = useState(false);
    const [systemError, setSystemError] = useState(false);
    const [siteOpsResult, setSiteOpsResult] = useState<SiteOpsBotResult | null>(null);
    const [siteOpsLoading, setSiteOpsLoading] = useState(false);
    const [siteOpsError, setSiteOpsError] = useState(false);

    const loadDashboard = useCallback(async (showSkeleton = true) => {
        if (showSkeleton) setLoading(true);
        else setDetailsLoading(true);
        setError(null);

        try {
            const res = await fetch("/api/admin/dashboard");
            if (!res.ok) throw new Error("Dashboard request failed");
            setData((await res.json()) as DashboardData);
            setDetailsLoaded(true);
        } catch {
            setError("failed");
        } finally {
            if (showSkeleton) setLoading(false);
            else setDetailsLoading(false);
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

    const runSiteOpsBot = useCallback(async () => {
        setSiteOpsError(false);
        setSiteOpsLoading(true);

        try {
            const res = await fetch("/api/admin/site-ops-bot", {
                method: "POST",
                cache: "no-store",
            });
            if (!res.ok) throw new Error("Site ops bot request failed");
            setSiteOpsResult((await res.json()) as SiteOpsBotResult);
        } catch {
            setSiteOpsError(true);
        } finally {
            setSiteOpsLoading(false);
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
            <DocHead title="《경영 일지》" period={issuedAt()} />

            {loading && !data && <DashboardPrimarySkeleton />}
            {!loading && !data && error && <ErrorState onRetry={() => void loadDashboard(true)} />}
            {data && (
                <DashboardContent
                    data={data}
                    systemStatus={systemStatus}
                    systemLoading={systemLoading}
                    systemError={systemError}
                    siteOpsResult={siteOpsResult}
                    siteOpsLoading={siteOpsLoading}
                    siteOpsError={siteOpsError}
                    detailsLoaded={detailsLoaded}
                    detailsLoading={detailsLoading}
                    onLoadDetails={() => void loadDashboard(false)}
                    onRetrySystem={loadSystemStatus}
                    onRunSiteOpsBot={runSiteOpsBot}
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
    siteOpsResult,
    siteOpsLoading,
    siteOpsError,
    detailsLoaded,
    detailsLoading,
    onLoadDetails,
    onRetrySystem,
    onRunSiteOpsBot,
}: {
    data: DashboardData;
    systemStatus: SystemStatusData | null;
    systemLoading: boolean;
    systemError: boolean;
    siteOpsResult: SiteOpsBotResult | null;
    siteOpsLoading: boolean;
    siteOpsError: boolean;
    detailsLoaded: boolean;
    detailsLoading: boolean;
    onLoadDetails: () => void;
    onRetrySystem: () => void;
    onRunSiteOpsBot: () => void;
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
                    className="flex items-center gap-3 bg-[var(--doc-grid-head)] border border-[var(--doc-warn)] rounded-[6px] p-4 hover:bg-[var(--doc-grid-head)] transition">
                    <div className="bg-[var(--doc-grid-head)] text-white p-2 rounded-[3px]">
                        <SymbolIcon name="forum" size={20} />
                    </div>
                    <div className="flex-1">
                        <p className="font-bold text-[var(--doc-warn)]">미처리 요청 {pendingCount}건</p>
                        <p className="text-xs text-[var(--doc-warn)] mt-0.5">
                            {pendingRequests.slice(0, 2).map((r) => `${r.studentName ?? "-"} - ${r.title}`).join(" / ")}
                            {pendingCount > 2 && ` 외 ${pendingCount - 2}건`}
                        </p>
                    </div>
                    <span className="text-[var(--doc-warn)] text-sm font-bold">처리하기 &rarr;</span>
                </Link>
            )}

            {enrollStats.PENDING > 0 && (
                <Link href="/admin/apply" prefetch={false}
                    className="flex items-center gap-3 bg-[var(--doc-grid-head)] border border-[var(--doc-rule)] rounded-[6px] p-4 hover:bg-[var(--doc-grid-head)] transition">
                    <div className="bg-[var(--doc-grid-head)] text-white p-2 rounded-[3px]">
                        <SymbolIcon name="person_add" size={20} />
                    </div>
                    <div className="flex-1">
                        <p className="font-bold text-[var(--doc-ink-2)]">수강 신청 대기 {enrollStats.PENDING}건</p>
                    </div>
                    <span className="text-[var(--doc-ink-2)] text-sm font-bold">처리하기 &rarr;</span>
                </Link>
            )}

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard title="등록 원생" value={`${stats.studentCount}명`}
                    icon={<SymbolIcon name="groups" size={20} className="text-[var(--doc-ink-2)]" />} href="/admin/students" />
                <StatCard title="운영 프로그램" value={`${stats.programCount}개`}
                    icon={<SymbolIcon name="menu_book" size={20} className="text-[var(--doc-accent)]" />} href="/admin/programs" />
                <StatCard title="코치/강사진" value={`${stats.coachCount}명`}
                    icon={<SymbolIcon name="person_check" size={20} className="text-[var(--doc-accent)]" />} href="/admin/coaches" />
                <StatCard title="개설 반" value={`${stats.classCount}개`}
                    icon={<SymbolIcon name="layers" size={20} className="text-[var(--doc-ink-2)]" />} href="/admin/classes" />
            </div>

            {detailsLoaded ? (
                <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-[var(--doc-surface)] p-5 rounded-[6px] border border-[var(--doc-rule)]">
                    <p className="text-xs font-medium text-[var(--doc-ink-2)] mb-1">이번 달 매출</p>
                    <h3 className="text-2xl font-bold text-[var(--doc-ink)]">{formatKRW(extendedStats.thisMonthRevenue)}</h3>
                    {extendedStats.lastMonthRevenue > 0 && (
                        <div className={`flex items-center gap-1 mt-1 text-xs font-medium ${revDiff >= 0 ? "text-[var(--doc-accent)]" : "text-[var(--doc-crit)]"}`}>
                            <SymbolIcon name={revDiff > 0 ? "trending_up" : revDiff < 0 ? "trending_down" : "remove"} size={14} />
                            전월 대비 {revDiff > 0 ? "+" : ""}{revDiff}%
                        </div>
                    )}
                </div>
                <div className="bg-[var(--doc-surface)] p-5 rounded-[6px] border border-[var(--doc-rule)]">
                    <p className="text-xs font-medium text-[var(--doc-ink-2)] mb-1">이번 달 출석률</p>
                    <h3 className="text-2xl font-bold text-[var(--doc-ink)]">{extendedStats.attendanceRate}%</h3>
                </div>
                <Link href="/admin/finance" prefetch={false} className="bg-[var(--doc-surface)] p-5 rounded-[6px] border border-[var(--doc-rule)] hover:border-[var(--doc-crit)] transition">
                    <p className="text-xs font-medium text-[var(--doc-ink-2)] mb-1">미납 현황</p>
                    <h3 className={`text-2xl font-bold ${extendedStats.unpaidCount > 0 ? "text-[var(--doc-crit)]" : "text-[var(--doc-ink)]"}`}>
                        {extendedStats.unpaidCount}건
                    </h3>
                    {extendedStats.unpaidAmount > 0 && (
                        <p className="text-xs text-[var(--doc-crit)] mt-1 flex items-center gap-1">
                            <SymbolIcon name="warning" size={12} /> {formatKRW(extendedStats.unpaidAmount)}
                        </p>
                    )}
                </Link>
                <div className="bg-[var(--doc-surface)] p-5 rounded-[6px] border border-[var(--doc-rule)]">
                    <p className="text-xs font-medium text-[var(--doc-ink-2)] mb-1">전월 매출</p>
                    <h3 className="text-2xl font-bold text-[var(--doc-ink)]">{formatKRW(extendedStats.lastMonthRevenue)}</h3>
                </div>
            </div>

            <Link href="/admin/stats" prefetch={false} className="flex items-center justify-between border border-[var(--doc-rule)] rounded-[6px] p-4 hover: hover: transition">
                <div className="flex items-center gap-3">
                    <SymbolIcon name="monitoring" size={28} className="text-[var(--doc-ink-2)]" />
                    <div>
                        <p className="font-bold text-[var(--doc-ink-2)]">상세 운영 통계</p>
                    </div>
                </div>
                <span className="text-[var(--doc-ink-2)] text-sm font-bold">보러가기 &rarr;</span>
            </Link>

            <ChartsSection extendedStats={extendedStats} maxRevenue={maxRevenue} />
            <TodayAndRecentSection
                todayClasses={todayClasses}
                todayLabel={todayLabel}
                recentStudents={recentStudents}
                pendingRequests={pendingRequests}
            />

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <ProgramStudentsCard programStudents={extendedStats.programStudents} />
                <QuickManagementCard />
                <SiteOpsBotCard
                    result={siteOpsResult}
                    loading={siteOpsLoading}
                    error={siteOpsError}
                    onRun={onRunSiteOpsBot}
                />
                <SystemStatusCard
                    systemStatus={systemStatus}
                    systemLoading={systemLoading}
                    systemError={systemError}
                    onRetry={onRetrySystem}
                />
            </div>
                </>
            ) : (
                <>
                    <DeferredDetailsCard loading={detailsLoading} onLoad={onLoadDetails} />
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <QuickManagementCard />
                        <SiteOpsBotCard
                            result={siteOpsResult}
                            loading={siteOpsLoading}
                            error={siteOpsError}
                            onRun={onRunSiteOpsBot}
                        />
                        <SystemStatusCard
                            systemStatus={systemStatus}
                            systemLoading={systemLoading}
                            systemError={systemError}
                            onRetry={onRetrySystem}
                        />
                    </div>
                </>
            )}
        </>
    );
}

function DeferredDetailsCard({ loading, onLoad }: { loading: boolean; onLoad: () => void }) {
    return (
        <div className="rounded-[6px] border border-dashed border-[var(--doc-rule)] bg-[var(--doc-surface)] p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <p className="text-sm font-bold text-[var(--doc-ink)]">상세 운영 데이터</p>
                    <p className="mt-1 text-sm text-[var(--doc-ink-2)]">
                        매출 추이, 출석률, 최근 등록 학생은 필요할 때만 불러옵니다.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={onLoad}
                    disabled={loading}
                    className="inline-flex items-center justify-center gap-2 rounded-[3px] bg-[var(--doc-accent)] px-4 py-2 text-sm font-bold text-white transition hover:bg-[var(--doc-grid-head)] disabled:cursor-wait disabled:opacity-60"
                >
                    <SymbolIcon name={loading ? "sync" : "download"} size={18} />
                    {loading ? "불러오는 중" : "상세 데이터 불러오기"}
                </button>
            </div>
        </div>
    );
}

function ChartsSection({ extendedStats }: { extendedStats: ExtendedStats; maxRevenue: number }) {
    // 최근 6개월 매출·출석률. 막대그래프 대신 표 — 시안이 차트를 의도적으로 만들지 않았고,
    // 색 막대는 "색이 아니라 선과 글자로 위계를 만든다"는 원칙과 정면으로 충돌한다.
    // 전월비는 표 안에서 계산한다(고정 문자열 금지).
    const revenueRows = extendedStats.monthlyRevenue.map((m, i) => {
        const prev = i > 0 ? extendedStats.monthlyRevenue[i - 1].amount : 0;
        const diff = prev > 0 ? Math.round(((m.amount - prev) / prev) * 100) : null;
        return {
            month: m.month,
            amount: formatKRW(m.amount),
            diff: diff == null ? "—" : `${diff > 0 ? "+" : ""}${diff}%`,
        };
    });
    const attendanceRows = extendedStats.monthlyAttendance.map((m) => ({
        month: m.month,
        rate: m.rate > 0 ? `${m.rate}%` : "—",
        note: m.rate > 0 && m.rate < 80 ? "확인 필요" : "",
    }));

    return (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <DocSection title="매출 추이">
                <DocTable
                    minWidth={280}
                    columns={[
                        { key: "month", label: "월" },
                        { key: "amount", label: "매출", numeric: true },
                        { key: "diff", label: "전월비", numeric: true },
                    ]}
                    rows={revenueRows}
                    empty="기록이 없습니다."
                />
            </DocSection>

            <DocSection title="출석률 추이">
                <DocTable
                    minWidth={280}
                    columns={[
                        { key: "month", label: "월" },
                        { key: "rate", label: "출석률", numeric: true },
                        { key: "note", label: "비고", muted: true },
                    ]}
                    rows={attendanceRows}
                    empty="기록이 없습니다."
                />
            </DocSection>
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
            <div className="bg-[var(--doc-surface)] p-6 rounded-[6px] border border-[var(--doc-rule)]">
                <h3 className="font-bold text-[var(--doc-ink)] mb-4 flex items-center gap-2">
                    <SymbolIcon name="event_available" size={18} className="text-[var(--doc-accent)]" />
                    오늘의 수업 ({todayLabel})
                </h3>
                {todayClasses.length === 0 ? (
                    <p className="text-sm text-[var(--doc-ink-3)]">오늘은 수업이 없습니다</p>
                ) : (
                    <div className="space-y-2">
                        {todayClasses.map((c) => (
                            <div key={c.id} className="flex items-center justify-between py-2 border-b border-[var(--doc-rule)] last:border-0">
                                <div>
                                    <p className="text-sm font-bold text-[var(--doc-ink)]">{c.name}</p>
                                    <p className="text-xs text-[var(--doc-ink-2)]">{c.programName} &middot; {c.startTime}~{c.endTime}</p>
                                </div>
                                <div className="text-right">
                                    <span className={`text-xs font-bold px-2 py-0.5 rounded-[3px] ${
 c.enrolled >= c.capacity ? "bg-[var(--doc-crit-soft)] text-[var(--doc-crit)]" : "bg-[var(--doc-accent-soft)] text-[var(--doc-accent)]"
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
                <div className="bg-[var(--doc-surface)] p-6 rounded-[6px] border border-[var(--doc-rule)]">
                    <h3 className="font-bold text-[var(--doc-ink)] mb-4 flex items-center gap-2">
                        <SymbolIcon name="person_add" size={18} className="text-[var(--doc-accent)]" />
                        신규 원생 (최근 7일)
                    </h3>
                    {recentStudents.length === 0 ? (
                        <p className="text-sm text-[var(--doc-ink-3)]">최근 등록된 원생이 없습니다</p>
                    ) : (
                        <div className="space-y-2">
                            {recentStudents.map((student) => (
                                <Link key={student.id} href={`/admin/students/${student.id}`} prefetch={false}
                                    className="flex items-center justify-between py-2 border-b border-[var(--doc-rule)] last:border-0 hover:bg-[var(--doc-grid-head)] rounded-[3px] px-2 transition">
                                    <div>
                                        <p className="text-sm font-bold text-[var(--doc-ink)]">{student.name}</p>
                                        <p className="text-xs text-[var(--doc-ink-2)]">학부모: {student.parentName ?? "-"}</p>
                                    </div>
                                    <span className="text-xs text-[var(--doc-ink-3)]">
                                        {new Date(student.createdAt).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}
                                    </span>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>

                {pendingRequests.length > 0 && (
                    <div className="bg-[var(--doc-surface)] p-6 rounded-[6px] border border-[var(--doc-warn)]">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-[var(--doc-ink)] flex items-center gap-2">
                                <SymbolIcon name="schedule" size={18} className="text-[var(--doc-warn)]" />
                                대기중 요청
                            </h3>
                            <Link href="/admin/requests" prefetch={false} className="text-xs text-[var(--doc-accent)] hover:underline">전체보기</Link>
                        </div>
                        <div className="space-y-2">
                            {pendingRequests.map((request) => (
                                <Link key={request.id} href="/admin/requests" prefetch={false}
                                    className="flex items-center justify-between py-2 border-b border-[var(--doc-rule)] last:border-0 hover:bg-[var(--doc-grid-head)] rounded-[3px] px-2 transition">
                                    <div>
                                        <p className="text-sm font-bold text-[var(--doc-ink)]">{request.title}</p>
                                        <p className="text-xs text-[var(--doc-ink-2)]">{request.parentName ?? "-"} ({request.studentName ?? "-"})</p>
                                    </div>
                                    <span className="text-xs text-[var(--doc-ink-3)]">
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
        <div className="bg-[var(--doc-surface)] p-6 rounded-[6px] border border-[var(--doc-rule)]">
            <h3 className="font-bold text-[var(--doc-ink)] mb-4">프로그램별 원생 수</h3>
            {programStudents.length === 0 ? (
                <p className="text-sm text-[var(--doc-ink-3)]">프로그램을 추가하세요</p>
            ) : (
                <div className="space-y-3">
                    {programStudents.map((program, index) => (
                        <div key={index}>
                            <div className="flex justify-between text-sm mb-1">
                                <span className="text-[var(--doc-ink-2)] font-medium truncate">{program.name}</span>
                                <span className="text-[var(--doc-ink-2)] font-bold">{program.count}명</span>
                            </div>
                            <div className="w-full bg-[var(--doc-grid-head)] rounded-[3px] h-2">
                                <div
                                    className="bg-[var(--doc-grid-head)] h-2 rounded-[3px] transition-all duration-500"
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
        <div className="bg-[var(--doc-surface)] p-6 rounded-[6px] border border-[var(--doc-rule)]">
            <h3 className="font-bold text-[var(--doc-ink)] mb-4">빠른 관리</h3>
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

function SiteOpsBotCard({
    result,
    loading,
    error,
    onRun,
}: {
    result: SiteOpsBotResult | null;
    loading: boolean;
    error: boolean;
    onRun: () => void;
}) {
    const attentionItems = result?.checks.filter((check) => check.status === "warning" || check.status === "critical") ?? [];
    const fixedItems = result?.checks.filter((check) => check.status === "fixed") ?? [];
    const previewItems = attentionItems.length > 0 ? attentionItems.slice(0, 3) : fixedItems.slice(0, 2);
    const statusLabel = !result
        ? "미점검"
        : result.ok
            ? result.fixedCount > 0 ? "자동 조치 완료" : "정상"
            : result.criticalCount > 0 ? "긴급 확인" : "확인 필요";
    const statusClass = !result
        ? "bg-[var(--doc-grid-head)] text-[var(--doc-ink-2)]  "
        : result.ok
            ? "bg-[var(--doc-accent-soft)] text-[var(--doc-accent)]"
            : result.criticalCount > 0
                ? "bg-[var(--doc-crit-soft)] text-[var(--doc-crit)]"
                : "bg-[var(--doc-grid-head)] text-[var(--doc-warn)]";

    return (
        <div className="bg-[var(--doc-surface)] p-5 rounded-[6px] border border-[var(--doc-rule)]">
            <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                    <h3 className="font-bold text-[var(--doc-ink)]">사이트 점검 봇</h3>
                    {/* 마지막 점검 시각은 실제 점검 결과가 있을 때만 표시한다 */}
                    {result && (
                        <p className="mt-1 text-xs text-[var(--doc-ink-2)]">
                            {new Date(result.checkedAt).toLocaleString("ko-KR")}
                        </p>
                    )}
                </div>
                <span className={`shrink-0 rounded-[3px] px-2 py-0.5 text-xs font-bold ${statusClass}`}>
                    {loading ? "점검 중" : statusLabel}
                </span>
            </div>

            <button
                type="button"
                onClick={onRun}
                disabled={loading}
                className="mb-3 inline-flex w-full items-center justify-center gap-2 rounded-[3px] bg-[var(--doc-accent)] px-4 py-2 text-sm font-bold text-white transition hover:bg-[var(--doc-grid-head)] disabled:cursor-wait disabled:opacity-60"
            >
                <SymbolIcon name={loading ? "sync" : "smart_toy"} size={18} />
                {loading ? "점검 중" : "점검 실행"}
            </button>

            {error && (
                <p className="mb-3 rounded-[3px] bg-[var(--doc-crit-soft)] px-3 py-2 text-xs font-medium text-[var(--doc-crit)]">
                    점검을 실행하지 못했습니다. 잠시 후 다시 시도해주세요.
                </p>
            )}

            {!result && !error && (
                <p className="rounded-[3px] bg-[var(--doc-grid-head)] px-3 py-2 text-xs text-[var(--doc-ink-2)]">
                    사이트 운영 상태, 백업, 신청 링크, 인스타 게시 대기열을 확인합니다.
                </p>
            )}

            {result && (
                <div className="space-y-2">
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                        <div className="rounded-[3px] bg-[var(--doc-grid-head)] px-2 py-2">
                            <p className="font-bold text-[var(--doc-ink)]">{result.checks.length}</p>
                            <p className="text-[var(--doc-ink-2)]">점검</p>
                        </div>
                        <div className="rounded-[3px] bg-[var(--doc-accent-soft)] px-2 py-2">
                            <p className="font-bold text-[var(--doc-accent)]">{result.fixedCount}</p>
                            <p className="text-[var(--doc-accent)]/70">자동조치</p>
                        </div>
                        <div className="rounded-[3px] bg-[var(--doc-grid-head)] px-2 py-2">
                            <p className="font-bold text-[var(--doc-warn)]">{result.manualActionCount}</p>
                            <p className="text-[var(--doc-warn)]/70">확인</p>
                        </div>
                    </div>

                    {previewItems.length === 0 ? (
                        <p className="rounded-[3px] bg-[var(--doc-accent-soft)] px-3 py-2 text-xs text-[var(--doc-accent)]">
                            현재 수동 조치가 필요한 항목은 없습니다.
                        </p>
                    ) : (
                        <div className="space-y-2">
                            {previewItems.map((item) => (
                                <div key={item.id} className="rounded-[3px] border border-[var(--doc-rule)] px-3 py-2">
                                    <div className="flex items-start justify-between gap-2">
                                        <div>
                                            <p className="text-xs font-bold text-[var(--doc-ink)]">{item.label}</p>
                                            <p className="mt-0.5 text-xs text-[var(--doc-ink-2)]">{item.message}</p>
                                        </div>
                                        <span className={`rounded-[3px] px-1.5 py-0.5 text-[10px] font-bold ${
 item.status === "critical"
 ? "bg-[var(--doc-crit-soft)] text-[var(--doc-crit)]"
 : item.status === "fixed"
 ? "bg-[var(--doc-accent-soft)] text-[var(--doc-accent)]"
 : "bg-[var(--doc-grid-head)] text-[var(--doc-warn)]"
 }`}>
                                            {item.status === "critical" ? "긴급" : item.status === "fixed" ? "완료" : "확인"}
                                        </span>
                                    </div>
                                    {item.actionHref && item.actionLabel && (
                                        <Link href={item.actionHref} prefetch={false} className="mt-2 inline-flex text-xs font-bold text-[var(--doc-accent)]">
                                            {item.actionLabel} &rarr;
                                        </Link>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
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
        <div className="bg-[var(--doc-surface)] p-5 rounded-[6px] border border-[var(--doc-rule)]">
            <div className="mb-3 flex items-center justify-between">
                <h3 className="font-bold text-[var(--doc-ink)]">시스템 상태</h3>
                <button
                    type="button"
                    onClick={onRetry}
                    disabled={systemLoading}
                    className="text-xs font-bold text-[var(--doc-accent)] transition hover:text-[var(--doc-warn)] disabled:cursor-wait disabled:opacity-60"
                >
                    {systemLoading ? "확인 중" : systemError ? "다시 시도" : systemStatus ? "새로고침" : "확인"}
                </button>
            </div>
            <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-[var(--doc-ink-2)]">
                        <SymbolIcon name="database" size={14} className="text-[var(--doc-ink-3)]" />
                        <span>데이터베이스</span>
                    </div>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-[3px] ${
 !systemStatus ? "bg-[var(--doc-grid-head)] text-[var(--doc-ink-2)]" : systemStatus.dbOk ? "bg-[var(--doc-accent-soft)] text-[var(--doc-accent)]" : "bg-[var(--doc-crit-soft)] text-[var(--doc-crit)]"
 }`}>
                        {systemLoading ? "확인 중" : !systemStatus ? "미확인" : systemStatus.dbOk ? "정상" : "오류"}
                    </span>
                </div>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-[var(--doc-ink-2)]">
                        <SymbolIcon name={backupWarn ? "cloud_off" : "cloud_done"} size={14} className={!systemStatus ? "text-[var(--doc-ink-3)]" : backupDanger ? "text-[var(--doc-crit)]" : backupWarn ? "text-[var(--doc-warn)]" : "text-[var(--doc-ink-2)]"} />
                        <span>마지막 백업</span>
                    </div>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-[3px] ${!systemStatus ? "bg-[var(--doc-grid-head)] text-[var(--doc-ink-2)]" : backupDanger ? "bg-[var(--doc-crit-soft)] text-[var(--doc-crit)]" : backupWarn ? "bg-[var(--doc-grid-head)] text-[var(--doc-warn)]" : "bg-[var(--doc-accent-soft)] text-[var(--doc-accent)]"}`}>
                        {systemLoading ? "확인 중" : !systemStatus ? "미확인" : backupLabel()}
                    </span>
                </div>
                {backup && backup.backupCount > 0 && (
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-[var(--doc-ink-2)]">저장된 백업</span>
                        <span className="text-xs text-[var(--doc-ink-2)]">{backup.backupCount}개</span>
                    </div>
                )}
                {systemStatus && backupDanger && (
                    <p className="text-xs text-[var(--doc-crit)] bg-[var(--doc-crit-soft)] rounded-[3px] px-3 py-2">
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
        <div className={`bg-[var(--doc-surface)] p-5 rounded-[6px] border border-[var(--doc-rule)] ${href ? "hover:border-[var(--doc-accent)] transition-colors cursor-pointer" : ""}`}>
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-xs font-medium text-[var(--doc-ink-2)] mb-1">{title}</p>
                    <h3 className="text-2xl font-bold text-[var(--doc-ink)]">{value}</h3>
                </div>
                <div className="p-2.5 bg-[var(--doc-grid-head)] rounded-[3px]">{icon}</div>
            </div>
        </div>
    );
    if (href) return <Link href={href} prefetch={false}>{content}</Link>;
    return content;
}

function QuickLink({ title, href, color }: { title: string; href: string; color: string }) {
    const colorMap: Record<string, string> = {
        orange: "bg-[var(--doc-grid-head)] border-[var(--doc-warn)] hover:border-[var(--doc-accent)]",
        blue: "bg-[var(--doc-grid-head)] border-[var(--doc-rule)] hover:border-[var(--doc-rule)]",
        green: "bg-[var(--doc-accent-soft)] border-[var(--doc-accent)] hover:border-[var(--doc-accent)]",
        purple: "bg-[var(--doc-grid-head)] border-[var(--doc-rule)] hover:border-[var(--doc-rule)]",
    };
    return (
        <Link href={href} prefetch={false} className={`p-3 rounded-[3px] border transition-colors text-center ${colorMap[color] || colorMap.orange}`}>
            <span className="font-bold text-sm text-[var(--doc-ink)]">{title}</span>
        </Link>
    );
}
