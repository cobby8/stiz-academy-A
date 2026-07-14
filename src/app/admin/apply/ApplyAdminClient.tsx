"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";

const ApplyAdminModals = dynamic(() => import("./ApplyAdminModals"), {
    loading: () => null,
});

const TrialCrmClient = dynamic(() => import("../trial/TrialCrmClient"), {
    loading: () => <ApplyLoadingFallback />,
});

const ApplySettingsTab = dynamic(() => import("./ApplySettingsTab"), {
    loading: () => (
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
            신청 안내 설정을 불러오는 중...
        </div>
    ),
});

// ── 타입 정의 ──────────────────────────────────────────────────────────────────

interface EnrollApplication {
    id: string;
    trialLeadId: string | null;
    childName: string;
    childBirthDate: string;
    childGender: string | null;
    childGrade: string | null;
    childSchool: string | null;
    childPhone: string | null;
    parentName: string;
    parentPhone: string;
    parentRelation: string | null;
    address: string | null;
    enrollmentMonths: string | null;
    preferredSlotKeys: string | null;
    assignedClassId: string | null;
    basketballExp: string | null;
    uniformSize: string | null;
    shuttleNeeded: boolean;
    shuttlePickup: string | null;
    shuttleTime: string | null;
    shuttleDropoff: string | null;
    paymentMethod: string | null;
    referralSource: string | null;
    memo: string | null;
    applicationNoticeConfirmed: boolean;
    shuttleNoticeConfirmed: boolean;
    status: string;
    processedAt: string | null;
    processedNote: string | null;
    convertedStudentId: string | null;
    createdAt: string;
    updatedAt: string;
}

interface EnrollStats {
    PENDING: number;
    APPROVED: number;
    REJECTED: number;
    CANCELLED: number;
    total: number;
}

interface ClassInfo {
    id: string;
    name: string;
    dayOfWeek: string;
    startTime: string;
    endTime: string;
    capacity: number;
    slotKey: string | null;
    program: { id: string; name: string } | null;
}

interface TrialLead {
    id: string;
    childName: string;
    childAge: string | null;
    parentName: string;
    parentPhone: string;
    source: string;
    status: string;
    scheduledDate: string | null;
    scheduledClassId: string | null;
    attendedDate: string | null;
    postTrialConsultedAt: string | null;
    enrollGuideSentAt: string | null;
    enrollApplicationReceivedAt: string | null;
    enrollApplicationId: string | null;
    convertedDate: string | null;
    convertedStudentId: string | null;
    lostReason: string | null;
    memo: string | null;
    createdAt: string;
    updatedAt: string;
    childBirthDate: string | null;
    childGrade: string | null;
    childGender: string | null;
    childSchool: string | null;
    basketballExp: string | null;
    preferredSlotKey: string | null;
    preferredDay: string | null;
    preferredPeriod: string | null;
    trialDate: string | null;
    trialFeeConfirmed: boolean;
    hopeNote: string | null;
    agreedTerms: boolean;
    agreedPrivacy: boolean;
}

interface TrialStats {
    NEW: number;
    CONTACTED: number;
    SCHEDULED: number;
    ATTENDED: number;
    CONVERTED: number;
    LOST: number;
    total: number;
    conversionRate: number;
}

interface ApplyAdminClientProps {
    initialApplications?: EnrollApplication[];
    initialStats?: EnrollStats;
    initialClasses?: ClassInfo[];
    initialTrialLeads?: TrialLead[];
    initialTrialStats?: TrialStats;
}

type ApplyPayload = {
    applications: EnrollApplication[];
    stats: EnrollStats;
    classes: ClassInfo[];
};

// ── 상태별 설정 ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
    PENDING: { label: "대기중", color: "bg-yellow-100 text-yellow-800", icon: "hourglass_top" },
    APPROVED: { label: "승인완료", color: "bg-green-100 text-green-800", icon: "check_circle" },
    REJECTED: { label: "반려", color: "bg-red-100 text-red-800", icon: "cancel" },
    CANCELLED: { label: "취소", color: "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400", icon: "block" },
};

// 유입경로 라벨 (9개 + 레거시 호환)
const SOURCE_LABELS: Record<string, string> = {
    REFERRAL: "지인소개",
    PASSBY: "지나가다 발견",
    NAVER_SEARCH: "네이버 키워드 검색",
    NAVER_BLOG: "네이버 블로그",
    PORTAL_OTHER: "기타 포털검색",
    INSTAGRAM: "인스타그램",
    SOOMGO: "숨고",
    EXISTING_STUDENT: "기존 수강생",
    OTHER: "기타",
    // 레거시 호환 (기존 데이터용)
    WEBSITE: "홈페이지",
    NAVER: "네이버",
    FLYER: "전단지",
};

const STATUS_ORDER = ["PENDING", "APPROVED", "REJECTED", "CANCELLED"] as const;
const APPLICATION_PAGE_SIZE = 50;

const EMPTY_STATS: EnrollStats = {
    PENDING: 0,
    APPROVED: 0,
    REJECTED: 0,
    CANCELLED: 0,
    total: 0,
};

function ApplyLoadingFallback() {
    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                    <div className="h-8 w-52 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                    <div className="h-4 w-64 rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
                </div>
                <div className="h-10 w-36 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse" />
            </div>
            <div className="h-12 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {Array.from({ length: 5 }).map((_, index) => (
                    <div
                        key={index}
                        className="h-28 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 animate-pulse"
                    />
                ))}
            </div>
            <div className="space-y-4">
                {Array.from({ length: 4 }).map((_, index) => (
                    <div
                        key={index}
                        className="h-36 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 animate-pulse"
                    />
                ))}
            </div>
        </div>
    );
}

function ApplyErrorState({ onRetry }: { onRetry: () => void }) {
    return (
        <div className="rounded-2xl border border-red-100 bg-white p-8 text-center shadow-sm dark:border-red-900/40 dark:bg-gray-800">
            <span className="material-symbols-outlined mb-3 text-4xl text-red-500">error</span>
            <p className="font-bold text-gray-900 dark:text-white">수강 신청 정보를 불러오지 못했습니다.</p>
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

// ── 탭 상수 ──────────────────────────────────────────────────────────────────────

type TabType = "trial" | "applications" | "settings";

// ── 메인 컴포넌트 ──────────────────────────────────────────────────────────────

export default function ApplyAdminClient({
    initialApplications,
    initialStats,
    initialClasses,
    initialTrialLeads,
    initialTrialStats,
}: ApplyAdminClientProps) {
    const hasInitialData = Boolean(initialApplications && initialStats && initialClasses);
    const [applications, setApplications] = useState<EnrollApplication[]>(initialApplications ?? []);
    const [stats, setStats] = useState<EnrollStats>(initialStats ?? EMPTY_STATS);
    const [classes, setClasses] = useState<ClassInfo[]>(initialClasses ?? []);
    const [loading, setLoading] = useState(!hasInitialData);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [filter, setFilter] = useState<string>("ALL");
    const [visibleLimit, setVisibleLimit] = useState(APPLICATION_PAGE_SIZE);
    const [activeTab, setActiveTab] = useState<TabType>("trial");

    // 모달 상태
    const [showApproveModal, setShowApproveModal] = useState<EnrollApplication | null>(null);
    const [showRejectModal, setShowRejectModal] = useState<EnrollApplication | null>(null);
    const [showDetailModal, setShowDetailModal] = useState<EnrollApplication | null>(null);

    const hasAnyData = applications.length > 0 || classes.length > 0 || stats.total > 0;

    const loadApplyData = useCallback(async () => {
        setLoading(true);
        setLoadError(null);

        try {
            const response = await fetch("/api/admin/apply", { cache: "no-store" });
            if (!response.ok) {
                throw new Error("Failed to load applications.");
            }
            const data = (await response.json()) as ApplyPayload;
            setApplications(data.applications);
            setStats(data.stats);
            setClasses(data.classes);
        } catch (error) {
            console.error("Failed to load applications:", error);
            setLoadError("failed");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (hasInitialData) return;
        void loadApplyData();
    }, [hasInitialData, loadApplyData]);

    // 필터링된 신청서 목록
    const filteredApps = useMemo(() => {
        if (filter === "ALL") return applications;
        return applications.filter((a) => a.status === filter);
    }, [applications, filter]);
    const visibleApps = useMemo(
        () => filteredApps.slice(0, visibleLimit),
        [filteredApps, visibleLimit],
    );
    const hasMoreApps = visibleApps.length < filteredApps.length;

    useEffect(() => {
        setVisibleLimit(APPLICATION_PAGE_SIZE);
    }, [filter]);
    const hasOpenModal = Boolean(showApproveModal || showRejectModal || showDetailModal);

    // 날짜 포맷
    function formatDate(dateStr: string | null) {
        if (!dateStr) return "-";
        const d = new Date(dateStr);
        return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
    }

    // 생년월일에서 나이 계산
    function calcAge(birthDateStr: string | null) {
        if (!birthDateStr) return null;
        const birth = new Date(birthDateStr);
        const today = new Date();
        let age = today.getFullYear() - birth.getFullYear();
        const m = today.getMonth() - birth.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
        return age;
    }

    if (loading && !hasAnyData) {
        return <ApplyLoadingFallback />;
    }

    if (loadError && !hasAnyData) {
        return <ApplyErrorState onRetry={loadApplyData} />;
    }

    return (
        <div className="space-y-6">
            {/* 페이지 헤더 + 탭 전환 */}
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <span className="material-symbols-outlined text-3xl text-brand-orange-500 dark:text-brand-neon-lime">how_to_reg</span>
                        수강 신청 관리
                        {/* PENDING 건수 배지 */}
                        {stats.PENDING > 0 && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-500 text-white animate-pulse">
                                {stats.PENDING}건 대기
                            </span>
                        )}
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">수강 신청서를 확인하고 승인/반려 처리합니다</p>
                </div>
                <a
                    href="/apply"
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 text-sm text-brand-navy-900 dark:text-white border border-gray-300 dark:border-gray-600 px-4 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-900 transition flex items-center gap-1.5"
                >
                    <span className="material-symbols-outlined text-base">open_in_new</span>
                    신청 페이지 미리보기
                </a>
            </div>

            {/* 탭 버튼 */}
            <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
                <button
                    onClick={() => setActiveTab("trial")}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition ${
                        activeTab === "trial"
                            ? "bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm"
                            : "text-gray-500 hover:text-gray-700 dark:text-gray-200"
                    }`}
                >
                    <span className="material-symbols-outlined text-lg">diversity_3</span>
                    체험 CRM
                    {(initialTrialStats?.NEW ?? 0) > 0 && (
                        <span className="bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
                            {initialTrialStats?.NEW}
                        </span>
                    )}
                </button>
                <button
                    onClick={() => setActiveTab("applications")}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition ${
                        activeTab === "applications"
                            ? "bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm"
                            : "text-gray-500 hover:text-gray-700 dark:text-gray-200"
                    }`}
                >
                    <span className="material-symbols-outlined text-lg">assignment</span>
                    신청서 관리
                    {stats.PENDING > 0 && (
                        <span className="bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
                            {stats.PENDING}
                        </span>
                    )}
                </button>
                <button
                    onClick={() => setActiveTab("settings")}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition ${
                        activeTab === "settings"
                            ? "bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm"
                            : "text-gray-500 hover:text-gray-700 dark:text-gray-200"
                    }`}
                >
                    <span className="material-symbols-outlined text-lg">settings</span>
                    안내 설정
                </button>
            </div>

            {/* 탭 내용 */}
            {activeTab === "trial" ? (
                <TrialCrmClient
                    initialLeads={initialTrialLeads}
                    initialStats={initialTrialStats}
                />
            ) : activeTab === "applications" ? (
                <>
                    {/* 파이프라인 요약 카드 */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        {STATUS_ORDER.map((s) => {
                            const cfg = STATUS_CONFIG[s];
                            const count = stats[s as keyof EnrollStats] as number;
                            return (
                                <button
                                    key={s}
                                    onClick={() => setFilter(filter === s ? "ALL" : s)}
                                    className={`rounded-xl p-4 text-center transition-all border-2 ${
                                        filter === s
                                            ? "border-brand-orange-500 dark:border-brand-neon-lime shadow-md"
                                            : "border-transparent hover:border-gray-200 dark:border-gray-700"
                                    } bg-white dark:bg-gray-800`}
                                >
                                    <span className={`material-symbols-outlined text-2xl ${cfg.color.split(" ")[1]}`}>
                                        {cfg.icon}
                                    </span>
                                    <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{count}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">{cfg.label}</p>
                                </button>
                            );
                        })}
                        {/* 전체 카드 */}
                        <button
                            onClick={() => setFilter("ALL")}
                            className={`rounded-xl p-4 text-center transition-all border-2 ${
                                filter === "ALL"
                                    ? "border-brand-orange-500 dark:border-brand-neon-lime shadow-md"
                                    : "border-transparent hover:border-gray-200 dark:border-gray-700"
                            } bg-white dark:bg-gray-800`}
                        >
                            <span className="material-symbols-outlined text-2xl text-gray-600 dark:text-gray-300">summarize</span>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{stats.total}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">전체</p>
                        </button>
                    </div>

                    {/* 필터 탭 */}
                    <div className="flex gap-2 flex-wrap">
                        <button
                            onClick={() => setFilter("ALL")}
                            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                                filter === "ALL"
                                    ? "bg-gray-900 text-white"
                                    : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200"
                            }`}
                        >
                            전체 ({stats.total})
                        </button>
                        {STATUS_ORDER.map((s) => {
                            const cfg = STATUS_CONFIG[s];
                            const count = stats[s as keyof EnrollStats] as number;
                            return (
                                <button
                                    key={s}
                                    onClick={() => setFilter(filter === s ? "ALL" : s)}
                                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                                        filter === s
                                            ? "bg-gray-900 text-white"
                                            : `${cfg.color} hover:opacity-80`
                                    }`}
                                >
                                    {cfg.label} ({count})
                                </button>
                            );
                        })}
                    </div>

                    {/* 신청서 목록 */}
                    {filteredApps.length === 0 ? (
                        <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                            <span className="material-symbols-outlined text-5xl text-gray-300">inbox</span>
                            <p className="text-gray-500 dark:text-gray-400 mt-3">
                                {filter === "ALL"
                                    ? "접수된 수강 신청이 없습니다"
                                    : `"${STATUS_CONFIG[filter]?.label}" 상태의 신청이 없습니다`}
                            </p>
                        </div>
                    ) : (
                        <div className="grid gap-4">
                            {visibleApps.map((app) => {
                                const cfg = STATUS_CONFIG[app.status] || STATUS_CONFIG.PENDING;
                                const age = calcAge(app.childBirthDate);
                                return (
                                    <div
                                        key={app.id}
                                        className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 hover:shadow-md transition-shadow"
                                    >
                                        <div className="flex flex-col md:flex-row md:items-start gap-4">
                                            {/* 왼쪽: 기본 정보 */}
                                            <div className="flex-1 min-w-0">
                                                {/* 상태 + 유입경로 배지 */}
                                                <div className="flex items-center gap-2 mb-2 flex-wrap">
                                                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.color}`}>
                                                        <span className="material-symbols-outlined text-sm">{cfg.icon}</span>
                                                        {cfg.label}
                                                    </span>
                                                    {app.referralSource && (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                                                            {SOURCE_LABELS[app.referralSource] || app.referralSource}
                                                        </span>
                                                    )}
                                                    {app.trialLeadId && (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-purple-50 text-purple-700">
                                                            <span className="material-symbols-outlined text-xs">link</span>
                                                            체험 연결
                                                        </span>
                                                    )}
                                                </div>

                                                {/* 아이 이름 + 나이/학년 */}
                                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                                    {app.childName}
                                                    {age !== null && (
                                                        <span className="text-sm font-normal text-gray-500 dark:text-gray-400 ml-2">
                                                            (만 {age}세)
                                                        </span>
                                                    )}
                                                </h3>

                                                {/* 보호자 + 연락처 + 신청일 */}
                                                <div className="flex items-center gap-4 mt-1 text-sm text-gray-500 dark:text-gray-400 flex-wrap">
                                                    <span className="flex items-center gap-1">
                                                        <span className="material-symbols-outlined text-base">person</span>
                                                        {app.parentName}
                                                        {app.parentRelation && ` (${app.parentRelation})`}
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <span className="material-symbols-outlined text-base">phone</span>
                                                        {app.parentPhone}
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <span className="material-symbols-outlined text-base">calendar_today</span>
                                                        {formatDate(app.createdAt)}
                                                    </span>
                                                </div>

                                                {/* 학년/학교/성별 태그 */}
                                                {(app.childGrade || app.childSchool || app.childGender) && (
                                                    <div className="flex flex-wrap gap-2 mt-2">
                                                        {app.childGrade && (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-blue-50 text-blue-700">
                                                                <span className="material-symbols-outlined text-xs">school</span>
                                                                {app.childGrade}
                                                            </span>
                                                        )}
                                                        {app.childSchool && (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-indigo-50 text-indigo-700">
                                                                <span className="material-symbols-outlined text-xs">apartment</span>
                                                                {app.childSchool}
                                                            </span>
                                                        )}
                                                        {app.childGender && (
                                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-pink-50 text-pink-700">
                                                                {app.childGender}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}

                                                {/* 희망 시간대 */}
                                                {app.enrollmentMonths && (
                                                    <div className="flex items-center gap-1 mt-2 text-xs text-lime-700 bg-lime-50 rounded-lg px-3 py-1.5">
                                                        <span className="material-symbols-outlined text-sm">calendar_month</span>
                                                        <span className="font-medium">수강 월:</span>
                                                        {app.enrollmentMonths}
                                                    </div>
                                                )}

                                                {/* 희망 시간대 */}
                                                {app.preferredSlotKeys && (
                                                    <div className="flex items-center gap-1 mt-2 text-xs text-purple-700 bg-purple-50 rounded-lg px-3 py-1.5">
                                                        <span className="material-symbols-outlined text-sm">schedule</span>
                                                        <span className="font-medium">희망 시간:</span>
                                                        {app.preferredSlotKeys}
                                                    </div>
                                                )}

                                                {/* 농구 경험 태그 */}
                                                {app.basketballExp && (
                                                    <div className="flex flex-wrap gap-2 mt-2">
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-orange-50 text-orange-700">
                                                            <span className="material-symbols-outlined text-xs">sports_basketball</span>
                                                            농구 {app.basketballExp}
                                                        </span>
                                                    </div>
                                                )}

                                                {/* 셔틀 정보 */}
                                                {app.shuttleNeeded && (
                                                    <div className="flex flex-wrap gap-2 mt-2">
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-teal-50 text-teal-700">
                                                            <span className="material-symbols-outlined text-xs">directions_bus</span>
                                                            셔틀 탑승{app.shuttlePickup ? `: ${app.shuttlePickup}` : ""}
                                                        </span>
                                                        {app.shuttleDropoff && (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-teal-50 text-teal-700">
                                                                <span className="material-symbols-outlined text-xs">pin_drop</span>
                                                                하차: {app.shuttleDropoff}
                                                            </span>
                                                        )}
                                                        {app.shuttleTime && (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-teal-50 text-teal-700">
                                                                <span className="material-symbols-outlined text-xs">schedule</span>
                                                                {app.shuttleTime}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}

                                                {/* 메모 */}
                                                {app.memo && (
                                                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-900 rounded-lg px-3 py-2">
                                                        {app.memo}
                                                    </p>
                                                )}

                                                {/* 처리 결과 (승인/반려 시) */}
                                                {app.processedNote && (
                                                    <p className={`mt-2 text-sm rounded-lg px-3 py-2 ${
                                                        app.status === "APPROVED"
                                                            ? "text-green-700 bg-green-50"
                                                            : "text-red-700 bg-red-50"
                                                    }`}>
                                                        <span className="font-medium">처리 메모:</span> {app.processedNote}
                                                    </p>
                                                )}
                                            </div>

                                            {/* 오른쪽: 액션 버튼 */}
                                            <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
                                                {/* 상세보기 */}
                                                <button
                                                    onClick={() => setShowDetailModal(app)}
                                                    className="p-2 text-gray-400 hover:text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:bg-gray-800 rounded-lg transition-colors"
                                                    title="상세 보기"
                                                >
                                                    <span className="material-symbols-outlined text-xl">visibility</span>
                                                </button>

                                                {/* 승인 버튼 — PENDING 상태에서만 */}
                                                {app.status === "PENDING" && (
                                                    <button
                                                        onClick={() => setShowApproveModal(app)}
                                                        className="flex items-center gap-1.5 px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm font-medium"
                                                    >
                                                        <span className="material-symbols-outlined text-lg">check_circle</span>
                                                        승인
                                                    </button>
                                                )}

                                                {/* 반려 버튼 — PENDING 상태에서만 */}
                                                {app.status === "PENDING" && (
                                                    <button
                                                        onClick={() => setShowRejectModal(app)}
                                                        className="flex items-center gap-1 px-3 py-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors text-sm"
                                                    >
                                                        <span className="material-symbols-outlined text-lg">cancel</span>
                                                        반려
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            <div className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-white px-4 py-3 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 sm:flex-row sm:items-center sm:justify-between">
                                <span>
                                    {filteredApps.length}건 중 {visibleApps.length}건 표시
                                </span>
                                {hasMoreApps && (
                                    <button
                                        type="button"
                                        onClick={() => setVisibleLimit((current) => current + APPLICATION_PAGE_SIZE)}
                                        className="rounded-lg border border-gray-200 px-4 py-2 font-bold text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-900"
                                    >
                                        50건 더 보기
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </>
            ) : (
                /* 설정 탭 — 기존 안내 설정 UI */
                <ApplySettingsTab />
            )}

            {hasOpenModal && (
                <ApplyAdminModals
                    approveApp={showApproveModal}
                    rejectApp={showRejectModal}
                    detailApp={showDetailModal}
                    classes={classes}
                    onCloseApprove={() => setShowApproveModal(null)}
                    onCloseReject={() => setShowRejectModal(null)}
                    onCloseDetail={() => setShowDetailModal(null)}
                    onSaved={loadApplyData}
                />
            )}
        </div>
    );
}
