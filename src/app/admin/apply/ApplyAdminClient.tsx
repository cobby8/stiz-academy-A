"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import dynamic from "next/dynamic";
import { recordApplicationContact } from "@/app/actions/admin";
import AdminModal from "@/components/admin/AdminModal";

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
    latestContactAction: string | null;
    latestContactNote: string | null;
    latestContactAt: string | null;
    latestContactBy: string | null;
    openFollowUpAt: string | null;
    openFollowUpNote: string | null;
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
    coachNoticeSentAt: string | null;
    coachNoticeSentTo: string | null;
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
    latestContactAction: string | null;
    latestContactNote: string | null;
    latestContactAt: string | null;
    latestContactBy: string | null;
    openFollowUpAt: string | null;
    openFollowUpNote: string | null;
    smsDeliveryTotal: number;
    smsDeliverySent: number;
    smsDeliveryFailed: number;
    smsDeliveryPending: number;
    smsDeliveryLatestAt: string | null;
    smsDeliveryError: string | null;
}

interface TrialStats {
    NEW: number;
    CONTACTED: number;
    SCHEDULED: number;
    ATTENDED: number;
    CONVERTED: number;
    LOST: number;
    CANCELLED: number;
    total: number;
    conversionRate: number;
}

type ListPagination = {
    limit: number;
    offset: number;
    returned: number;
    total: number;
    hasMore: boolean;
    nextOffset: number | null;
    partial: boolean;
};

interface ApplyAdminClientProps {
    initialApplications?: EnrollApplication[];
    initialStats?: EnrollStats;
    initialClasses?: ClassInfo[];
    initialApplyPagination?: ListPagination;
    initialTrialLeads?: TrialLead[];
    initialTrialStats?: TrialStats;
    initialTrialClasses?: ClassInfo[];
    initialTrialPagination?: ListPagination;
}

type ApplyPayload = {
    applications: EnrollApplication[];
    stats: EnrollStats;
    classes: ClassInfo[];
    pagination?: ListPagination;
};

type FeedbackState = { type: "success" | "error"; message: string } | null;
type ApplicationWorkFilter = "ALL" | "NEEDS_ACTION" | "CLASS_ASSIGNMENT" | "SHUTTLE" | "TRIAL_LINKED" | "TIME_CHECK";
type ContactSummary = { parentPhone: string; childName: string; status: string };
type PriorityBadge = { icon: string; label: string; className: string };
type ContactActionType = "CONTACTED" | "NO_ANSWER" | "FOLLOW_UP" | "MEMO";
type ContactModalState = { app: EnrollApplication; defaultAction: ContactActionType } | null;
type ViewMode = "cards" | "list";

// ── 상태별 설정 ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
    PENDING: { label: "대기중", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950/50 dark:text-yellow-200", icon: "hourglass_top" },
    APPROVED: { label: "승인완료", color: "bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-200", icon: "check_circle" },
    REJECTED: { label: "반려", color: "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-200", icon: "cancel" },
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
const LONG_WAIT_HOURS = 24;
const COMPACT_CARD_ACTION_CLASS = "inline-flex min-h-8 items-center gap-1.5 rounded-md border border-gray-200 px-2.5 text-xs font-bold text-gray-700 transition hover:border-brand-orange-300 hover:bg-brand-orange-50 hover:text-brand-orange-700 dark:border-gray-700 dark:text-gray-200 dark:hover:border-brand-neon-lime dark:hover:bg-brand-neon-lime/10 dark:hover:text-brand-neon-lime";
const COMPACT_CARD_ACTION_DANGER_CLASS = "inline-flex min-h-8 items-center gap-1.5 rounded-md border border-gray-200 px-2.5 text-xs font-bold text-gray-700 transition hover:border-red-300 hover:bg-red-50 hover:text-red-700 dark:border-gray-700 dark:text-gray-200 dark:hover:border-red-400 dark:hover:bg-red-950/30 dark:hover:text-red-200";
const COMPACT_CARD_PRIMARY_CLASS = "inline-flex min-h-8 items-center gap-1.5 rounded-md bg-lime-500 px-2.5 text-xs font-black text-brand-navy-900 transition hover:bg-lime-400";
const COMPACT_CARD_CONTACT_CLASS = "inline-flex min-h-8 items-center gap-1.5 rounded-md border border-lime-300 bg-lime-50 px-2.5 text-xs font-black text-lime-800 transition hover:bg-lime-100 disabled:opacity-50 dark:border-lime-700 dark:bg-lime-950/30 dark:text-lime-200 dark:hover:bg-lime-900/40";
const COMPACT_CARD_CHIP_CLASS = "inline-flex max-w-full items-center gap-1 overflow-hidden rounded-md bg-gray-50 px-2 py-1 text-[11px] font-bold text-gray-700 dark:bg-gray-900/70 dark:text-gray-200";

const APPLICATION_WORK_FILTERS: Array<{ value: ApplicationWorkFilter; label: string; icon: string }> = [
    { value: "ALL", label: "운영 전체", icon: "view_list" },
    { value: "NEEDS_ACTION", label: "처리 필요", icon: "priority_high" },
    { value: "CLASS_ASSIGNMENT", label: "반 배정", icon: "edit_calendar" },
    { value: "SHUTTLE", label: "셔틀 확인", icon: "directions_bus" },
    { value: "TRIAL_LINKED", label: "체험 후 신청", icon: "link" },
    { value: "TIME_CHECK", label: "희망시간 확인", icon: "schedule" },
];

const CONTACT_ACTION_LABELS: Record<string, string> = {
    CONTACTED: "연락 완료",
    NO_ANSWER: "부재",
    FOLLOW_UP: "재연락 예약",
    MEMO: "상담 메모",
    UPDATED: "내용 수정",
    SCHEDULED: "일정 변경",
    CANCELLED: "취소 처리",
};

const EMPTY_STATS: EnrollStats = {
    PENDING: 0,
    APPROVED: 0,
    REJECTED: 0,
    CANCELLED: 0,
    total: 0,
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

function formatClassLabel(classInfo: ClassInfo) {
    const dayLabel = DAY_LABELS[classInfo.dayOfWeek] || classInfo.dayOfWeek;
    const programName = classInfo.program?.name ? ` · ${classInfo.program.name}` : "";
    return `${dayLabel} ${classInfo.startTime}~${classInfo.endTime} · ${classInfo.name}${programName}`;
}

function formatPreferredSlots(slotKeys: string | null, classesBySlotKey: Map<string, ClassInfo>) {
    if (!slotKeys) return null;
    const keys = slotKeys.split(",").map((key) => key.trim()).filter(Boolean);
    if (keys.length === 0) return null;

    const labels: string[] = [];
    let unknownCount = 0;

    keys.forEach((key) => {
        const classInfo = classesBySlotKey.get(key);
        if (classInfo) {
            labels.push(formatClassLabel(classInfo));
        } else {
            unknownCount += 1;
        }
    });

    if (labels.length === 0) return "희망 시간 확인 필요";
    if (unknownCount > 0) return `${labels.join(" / ")} 외 ${unknownCount}개 시간 확인 필요`;
    return labels.join(" / ");
}

function phoneHref(phone: string) {
    const digits = phone.replace(/\D/g, "");
    return digits ? `tel:${digits}` : undefined;
}

function normalizePhone(phone: string | null | undefined) {
    return (phone ?? "").replace(/\D/g, "");
}

function normalizeSearchValue(value: string | null | undefined) {
    return (value ?? "").replace(/\s+/g, "").replace(/-/g, "").toLowerCase();
}

function hoursSince(dateStr: string | null) {
    if (!dateStr) return 0;
    const timestamp = new Date(dateStr).getTime();
    if (!Number.isFinite(timestamp)) return 0;
    return Math.max(0, Math.floor((Date.now() - timestamp) / 36e5));
}

function formatWaitLabel(dateStr: string | null) {
    const hours = hoursSince(dateStr);
    if (hours >= 48) return `${Math.floor(hours / 24)}일 대기`;
    if (hours >= 24) return "24시간 이상 대기";
    if (hours >= 1) return `${hours}시간 대기`;
    return "방금 접수";
}

function isFollowUpDueToday(dateStr: string | null) {
    if (!dateStr) return false;
    const timestamp = new Date(dateStr).getTime();
    if (!Number.isFinite(timestamp)) return false;
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    return timestamp <= todayEnd.getTime();
}

function formatContactDateTime(dateStr: string | null) {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return "-";
    return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function getApplicationFlags(app: EnrollApplication, preferredSlotLabel: string | null) {
    const flags: PriorityBadge[] = [];

    if (app.status === "PENDING") {
        flags.push({
            icon: "priority_high",
            label: "처리 대기",
            className: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-200",
        });
    }
    if (app.status === "PENDING" && !app.assignedClassId) {
        flags.push({
            icon: "edit_calendar",
            label: "반 배정 필요",
            className: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-200",
        });
    }
    if (!preferredSlotLabel) {
        flags.push({
            icon: "schedule",
            label: "희망 시간 확인",
            className: "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-200",
        });
    }
    if (app.shuttleNeeded) {
        flags.push({
            icon: "directions_bus",
            label: "셔틀 확인",
            className: "bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-200",
        });
    }
    if (app.trialLeadId) {
        flags.push({
            icon: "link",
            label: "체험 후 신청",
            className: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-200",
        });
    }

    return flags.slice(0, 4);
}

function getApplicationPriorityBadges(
    app: EnrollApplication,
    preferredSlotLabel: string | null,
    contactCount: number,
) {
    const badges: PriorityBadge[] = [];

    if (app.status === "PENDING" && hoursSince(app.createdAt) >= LONG_WAIT_HOURS) {
        badges.push({
            icon: "timer",
            label: formatWaitLabel(app.createdAt),
            className: "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-200",
        });
    }
    if (app.status === "PENDING" && contactCount > 1) {
        badges.push({
            icon: "content_copy",
            label: `중복 연락처 ${contactCount}건`,
            className: "bg-fuchsia-50 text-fuchsia-700 dark:bg-fuchsia-950/40 dark:text-fuchsia-200",
        });
    }
    if (app.status === "PENDING" && !app.assignedClassId) {
        badges.push({
            icon: "edit_calendar",
            label: "반 배정 필요",
            className: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-200",
        });
    }
    if (app.status === "PENDING" && app.shuttleNeeded) {
        badges.push({
            icon: "directions_bus",
            label: "셔틀 먼저 확인",
            className: "bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-200",
        });
    }
    if (app.status === "PENDING" && !preferredSlotLabel) {
        badges.push({
            icon: "schedule",
            label: "희망시간 확인",
            className: "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-200",
        });
    }
    if (app.status === "PENDING" && isFollowUpDueToday(app.openFollowUpAt)) {
        badges.push({
            icon: "phone_callback",
            label: "오늘 재연락",
            className: "bg-lime-100 text-lime-800 dark:bg-lime-950/50 dark:text-lime-200",
        });
    }

    return badges.slice(0, 4);
}

function matchesApplicationWorkFilter(
    app: EnrollApplication,
    preferredSlotLabel: string | null,
    workFilter: ApplicationWorkFilter,
) {
    if (workFilter === "ALL") return true;
    if (workFilter === "NEEDS_ACTION") return app.status === "PENDING";
    if (workFilter === "CLASS_ASSIGNMENT") return app.status === "PENDING" && !app.assignedClassId;
    if (workFilter === "SHUTTLE") return app.shuttleNeeded;
    if (workFilter === "TRIAL_LINKED") return Boolean(app.trialLeadId);
    if (workFilter === "TIME_CHECK") return !preferredSlotLabel;
    return true;
}

function applicationMatchesSearch(app: EnrollApplication, preferredSlotLabel: string | null, query: string) {
    const normalizedQuery = normalizeSearchValue(query);
    if (!normalizedQuery) return true;

    const searchable = [
        app.childName,
        app.parentName,
        app.parentPhone,
        app.childPhone,
        app.childSchool,
        app.childGrade,
        app.parentRelation,
        app.memo,
        app.basketballExp,
        app.shuttlePickup,
        app.shuttleDropoff,
        app.referralSource ? SOURCE_LABELS[app.referralSource] || app.referralSource : null,
        preferredSlotLabel,
    ].map(normalizeSearchValue).join(" ");

    return searchable.includes(normalizedQuery);
}

function buildOpenContactCounts(applications: EnrollApplication[], trialLeads: TrialLead[]) {
    const counts = new Map<string, number>();
    const add = (phone: string | null | undefined) => {
        const normalized = normalizePhone(phone);
        if (normalized.length < 8) return;
        counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
    };

    applications.forEach((app) => {
        if (app.status === "PENDING") add(app.parentPhone);
    });
    trialLeads.forEach((lead) => {
        if (lead.status !== "CONVERTED" && lead.status !== "LOST") add(lead.parentPhone);
    });

    return counts;
}

function getContactCount(phone: string | null | undefined, counts: Map<string, number>) {
    const normalized = normalizePhone(phone);
    return normalized ? counts.get(normalized) ?? 0 : 0;
}

function getTrialPriorityBadges(lead: TrialLead, contactCount: number) {
    const badges: PriorityBadge[] = [];

    if ((lead.status === "NEW" || lead.status === "CONTACTED") && hoursSince(lead.createdAt) >= LONG_WAIT_HOURS) {
        badges.push({
            icon: "timer",
            label: formatWaitLabel(lead.createdAt),
            className: "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-200",
        });
    }
    if (lead.status !== "CONVERTED" && lead.status !== "LOST" && contactCount > 1) {
        badges.push({
            icon: "content_copy",
            label: `중복 연락처 ${contactCount}건`,
            className: "bg-fuchsia-50 text-fuchsia-700 dark:bg-fuchsia-950/40 dark:text-fuchsia-200",
        });
    }
    if (lead.status === "ATTENDED" && !lead.enrollGuideSentAt) {
        badges.push({
            icon: "sms",
            label: "상담 후 안내 필요",
            className: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-200",
        });
    }
    if (lead.status !== "CONVERTED" && lead.status !== "LOST" && !lead.coachNoticeSentAt) {
        badges.push({
            icon: "school",
            label: "쌤 알림 필요",
            className: "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-200",
        });
    }
    if (lead.status !== "CONVERTED" && lead.status !== "LOST" && isFollowUpDueToday(lead.openFollowUpAt)) {
        badges.push({
            icon: "phone_callback",
            label: "오늘 재연락",
            className: "bg-lime-100 text-lime-800 dark:bg-lime-950/50 dark:text-lime-200",
        });
    }

    return badges.slice(0, 4);
}

function joinSummaryLines(lines: Array<string | null | undefined | false>) {
    return lines.filter(Boolean).join("\n");
}

async function copyTextToClipboard(text: string) {
    if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return;
    }

    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
}

function formatApplicationCopySummary(app: EnrollApplication, preferredSlotLabel: string | null) {
    const childInfo = [app.childGrade, app.childSchool, app.childGender].filter(Boolean).join(" / ");
    const parentInfo = `${app.parentName}${app.parentRelation ? ` (${app.parentRelation})` : ""}`;
    const shuttleInfo = app.shuttleNeeded
        ? [app.shuttlePickup, app.shuttleDropoff, app.shuttleTime].filter(Boolean).join(" / ") || "필요"
        : null;

    return joinSummaryLines([
        `[수강신청] ${app.childName}`,
        childInfo ? `학생: ${childInfo}` : null,
        `보호자: ${parentInfo}`,
        `연락처: ${app.parentPhone}`,
        app.enrollmentMonths ? `수강 월: ${app.enrollmentMonths}` : null,
        preferredSlotLabel ? `희망 시간: ${preferredSlotLabel}` : null,
        app.basketballExp ? `농구 경험: ${app.basketballExp}` : null,
        shuttleInfo ? `셔틀: ${shuttleInfo}` : null,
        app.memo ? `메모: ${app.memo}` : null,
    ]);
}

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
    initialApplyPagination,
    initialTrialLeads,
    initialTrialStats,
    initialTrialClasses,
    initialTrialPagination,
}: ApplyAdminClientProps) {
    const hasInitialApplyData = Boolean(initialApplications && initialClasses);
    const [applications, setApplications] = useState<EnrollApplication[]>(initialApplications ?? []);
    const [stats, setStats] = useState<EnrollStats>(initialStats ?? EMPTY_STATS);
    const [classes, setClasses] = useState<ClassInfo[]>(initialClasses ?? []);
    const [applyLoaded, setApplyLoaded] = useState(hasInitialApplyData);
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [applyPagination, setApplyPagination] = useState<ListPagination | null>(initialApplyPagination ?? null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [filter, setFilter] = useState<string>("ALL");
    const [workFilter, setWorkFilter] = useState<ApplicationWorkFilter>("ALL");
    const [searchQuery, setSearchQuery] = useState("");
    const [viewMode, setViewMode] = useState<ViewMode>("cards");
    const [visibleLimit, setVisibleLimit] = useState(APPLICATION_PAGE_SIZE);
    const [activeTab, setActiveTab] = useState<TabType>("trial");
    const [feedback, setFeedback] = useState<FeedbackState>(null);

    // 모달 상태
    const [showApproveModal, setShowApproveModal] = useState<EnrollApplication | null>(null);
    const [showRejectModal, setShowRejectModal] = useState<EnrollApplication | null>(null);
    const [showDetailModal, setShowDetailModal] = useState<EnrollApplication | null>(null);
    const [showEditModal, setShowEditModal] = useState<EnrollApplication | null>(null);
    const [showCancelModal, setShowCancelModal] = useState<EnrollApplication | null>(null);
    const [contactModal, setContactModal] = useState<ContactModalState>(null);
    const [contactBusyId, setContactBusyId] = useState<string | null>(null);

    const hasAnyData = applications.length > 0 || classes.length > 0 || stats.total > 0;

    const loadApplyData = useCallback(async (options?: { append?: boolean; offset?: number }) => {
        const append = Boolean(options?.append);
        const offset = options?.offset ?? 0;

        if (append) setLoadingMore(true);
        else setLoading(true);
        setLoadError(null);

        try {
            const params = new URLSearchParams({
                limit: String(APPLICATION_PAGE_SIZE),
                offset: String(offset),
            });
            const response = await fetch(`/api/admin/apply?${params.toString()}`, { cache: "no-store" });
            if (!response.ok) {
                throw new Error("request failed");
            }
            const data = (await response.json()) as ApplyPayload;
            setApplications((current) => (append ? [...current, ...data.applications] : data.applications));
            setStats(data.stats);
            setClasses(data.classes);
            setApplyPagination(data.pagination ?? null);
            setApplyLoaded(true);
        } catch {
            setLoadError("failed");
        } finally {
            if (append) setLoadingMore(false);
            else setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (activeTab !== "applications" || applyLoaded || loading) return;
        void loadApplyData();
    }, [activeTab, applyLoaded, loading, loadApplyData]);

    const classesBySlotKey = useMemo(() => {
        const map = new Map<string, ClassInfo>();
        classes.forEach((classInfo) => {
            if (classInfo.slotKey) map.set(classInfo.slotKey, classInfo);
        });
        return map;
    }, [classes]);
    const trialLeadsForSummary = useMemo(() => initialTrialLeads ?? [], [initialTrialLeads]);
    const openContactCounts = useMemo(
        () => buildOpenContactCounts(applications, trialLeadsForSummary),
        [applications, trialLeadsForSummary],
    );
    const applicationContacts = useMemo<ContactSummary[]>(
        () =>
            applications.map((app) => ({
                parentPhone: app.parentPhone,
                childName: app.childName,
                status: app.status,
            })),
        [applications],
    );
    const showFeedback = useCallback((type: "success" | "error", message: string) => {
        setFeedback({ type, message });
        window.setTimeout(() => setFeedback(null), 3500);
    }, []);
    const handleCopyText = useCallback(async (text: string, successMessage: string) => {
        try {
            await copyTextToClipboard(text);
            showFeedback("success", successMessage);
        } catch {
            showFeedback("error", "복사 중 문제가 생겼습니다. 직접 선택해서 복사해주세요.");
        }
    }, [showFeedback]);
    const handleRecordContact = useCallback(async (
        app: EnrollApplication,
        action: ContactActionType,
        note?: string | null,
        nextFollowUpAt?: string | null,
    ) => {
        setContactBusyId(app.id);
        try {
            await recordApplicationContact({
                targetType: "ENROLL",
                targetId: app.id,
                action,
                note,
                nextFollowUpAt,
            });
            await loadApplyData();
            showFeedback("success", `${app.childName} ${CONTACT_ACTION_LABELS[action]} 기록을 저장했습니다.`);
        } catch {
            showFeedback("error", "연락 기록 저장 중 문제가 생겼습니다. 잠시 후 다시 시도해주세요.");
        } finally {
            setContactBusyId(null);
        }
    }, [loadApplyData, showFeedback]);

    // 필터링된 신청서 목록
    const filteredApps = useMemo(() => {
        return applications.filter((app) => {
            const preferredSlotLabel = formatPreferredSlots(app.preferredSlotKeys, classesBySlotKey);
            if (filter !== "ALL" && app.status !== filter) return false;
            if (!matchesApplicationWorkFilter(app, preferredSlotLabel, workFilter)) return false;
            return applicationMatchesSearch(app, preferredSlotLabel, searchQuery);
        });
    }, [applications, classesBySlotKey, filter, searchQuery, workFilter]);
    const visibleApps = useMemo(
        () => filteredApps.slice(0, visibleLimit),
        [filteredApps, visibleLimit],
    );
    const hasMoreLoadedApps = visibleApps.length < filteredApps.length;
    const hasMoreServerApps = Boolean(applyPagination?.hasMore);
    const hasMoreApps = hasMoreLoadedApps || hasMoreServerApps;
    const handleShowMoreApps = useCallback(() => {
        if (hasMoreLoadedApps) {
            setVisibleLimit((current) => current + APPLICATION_PAGE_SIZE);
            return;
        }

        if (!hasMoreServerApps || loadingMore) return;

        setVisibleLimit((current) => current + APPLICATION_PAGE_SIZE);
        void loadApplyData({
            append: true,
            offset: applyPagination?.nextOffset ?? applications.length,
        });
    }, [applications.length, applyPagination?.nextOffset, hasMoreLoadedApps, hasMoreServerApps, loadApplyData, loadingMore]);
    const workFilterCounts = useMemo(() => {
        const counts: Record<ApplicationWorkFilter, number> = {
            ALL: applications.length,
            NEEDS_ACTION: 0,
            CLASS_ASSIGNMENT: 0,
            SHUTTLE: 0,
            TRIAL_LINKED: 0,
            TIME_CHECK: 0,
        };

        applications.forEach((app) => {
            const preferredSlotLabel = formatPreferredSlots(app.preferredSlotKeys, classesBySlotKey);
            APPLICATION_WORK_FILTERS.forEach((item) => {
                if (item.value !== "ALL" && matchesApplicationWorkFilter(app, preferredSlotLabel, item.value)) {
                    counts[item.value] += 1;
                }
            });
        });

        return counts;
    }, [applications, classesBySlotKey]);
    const priorityAppCount = useMemo(() => {
        if (!applyLoaded) return stats.PENDING;

        return applications.filter((app) => {
            const preferredSlotLabel = formatPreferredSlots(app.preferredSlotKeys, classesBySlotKey);
            const contactCount = getContactCount(app.parentPhone, openContactCounts);
            return getApplicationPriorityBadges(app, preferredSlotLabel, contactCount).length > 0;
        }).length;
    }, [applications, applyLoaded, classesBySlotKey, openContactCounts, stats.PENDING]);
    const priorityTrialCount = useMemo(() => {
        return trialLeadsForSummary.filter((lead) => {
            const contactCount = getContactCount(lead.parentPhone, openContactCounts);
            return getTrialPriorityBadges(lead, contactCount).length > 0;
        }).length;
    }, [openContactCounts, trialLeadsForSummary]);

    useEffect(() => {
        setVisibleLimit(APPLICATION_PAGE_SIZE);
    }, [filter, searchQuery, workFilter]);
    const hasApplyModal = Boolean(showApproveModal || showRejectModal || showDetailModal || showEditModal || showCancelModal);
    const trialNewCount = initialTrialStats?.NEW ?? 0;
    const trialScheduledCount = initialTrialStats?.SCHEDULED ?? 0;
    const actionTotal = trialNewCount + stats.PENDING;
    const firstLookCount = priorityAppCount + priorityTrialCount;

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

    function renderApplicationList() {
        return (
            <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
                <table className="w-full min-w-[1080px] border-collapse text-left text-sm">
                    <thead className="sticky top-0 z-10 bg-gray-50 text-xs font-black uppercase text-gray-500 dark:bg-gray-900 dark:text-gray-400">
                        <tr className="divide-x divide-gray-200 dark:divide-gray-700">
                            <th className="px-3 py-3">상태</th>
                            <th className="px-3 py-3">학생</th>
                            <th className="px-3 py-3">보호자</th>
                            <th className="px-3 py-3">희망수업</th>
                            <th className="px-3 py-3">접수일</th>
                            <th className="px-3 py-3">수강월</th>
                            <th className="px-3 py-3">셔틀</th>
                            <th className="px-3 py-3">처리</th>
                            <th className="px-3 py-3">액션</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {visibleApps.map((app) => {
                            const cfg = STATUS_CONFIG[app.status] || STATUS_CONFIG.PENDING;
                            const age = calcAge(app.childBirthDate);
                            const preferredSlotLabel = formatPreferredSlots(app.preferredSlotKeys, classesBySlotKey);
                            const parentPhoneHref = phoneHref(app.parentPhone);
                            return (
                                <tr key={`${app.id}-list`} className="divide-x divide-gray-100 hover:bg-gray-50/80 dark:divide-gray-700 dark:hover:bg-gray-900/50">
                                    <td className="px-3 py-2 align-top">
                                        <div className="flex flex-col items-start gap-1">
                                            <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ${cfg.color}`}>
                                                <span className="material-symbols-outlined text-sm">{cfg.icon}</span>
                                                {cfg.label}
                                            </span>
                                            {app.trialLeadId && (
                                                <span className="whitespace-nowrap rounded bg-purple-50 px-2 py-0.5 text-[11px] font-bold text-purple-700 dark:bg-purple-950/40 dark:text-purple-200">
                                                    체험 후 신청
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-3 py-2 align-top">
                                        <p className="whitespace-nowrap font-black text-gray-900 dark:text-white">
                                            {app.childName}
                                            {age !== null ? <span className="ml-1 text-xs font-bold text-gray-500 dark:text-gray-400">(만 {age}세)</span> : null}
                                        </p>
                                        <p className="mt-0.5 max-w-44 truncate text-xs text-gray-500 dark:text-gray-400">
                                            {[app.childGrade, app.childSchool].filter(Boolean).join(" · ") || "학년/학교 미입력"}
                                        </p>
                                    </td>
                                    <td className="px-3 py-2 align-top">
                                        <p className="whitespace-nowrap font-bold text-gray-800 dark:text-gray-100">
                                            {app.parentName}
                                            {app.parentRelation ? ` (${app.parentRelation})` : ""}
                                        </p>
                                        <a href={parentPhoneHref} className="mt-0.5 inline-flex items-center gap-1 whitespace-nowrap text-xs font-bold text-gray-600 hover:text-brand-orange-600 dark:text-gray-300 dark:hover:text-brand-neon-lime">
                                            <span className="material-symbols-outlined text-sm">phone</span>
                                            {app.parentPhone}
                                        </a>
                                    </td>
                                    <td className="max-w-64 px-3 py-2 align-top font-bold text-gray-700 dark:text-gray-200">
                                        <span className="line-clamp-2">{preferredSlotLabel || "희망 시간 확인 필요"}</span>
                                    </td>
                                    <td className="whitespace-nowrap px-3 py-2 align-top font-bold text-gray-700 dark:text-gray-200">
                                        {formatDate(app.createdAt)}
                                    </td>
                                    <td className="whitespace-nowrap px-3 py-2 align-top font-bold text-gray-700 dark:text-gray-200">
                                        {app.enrollmentMonths || "-"}
                                    </td>
                                    <td className="px-3 py-2 align-top text-xs font-bold text-gray-600 dark:text-gray-300">
                                        {app.shuttleNeeded ? (
                                            <span className="line-clamp-2">{app.shuttlePickup || app.shuttleDropoff || app.shuttleTime || "이용"}</span>
                                        ) : (
                                            <span className="whitespace-nowrap">미이용</span>
                                        )}
                                    </td>
                                    <td className="px-3 py-2 align-top">
                                        {app.status === "PENDING" ? (
                                            <div className="flex flex-wrap gap-1.5">
                                                <button
                                                    type="button"
                                                    onClick={() => setShowApproveModal(app)}
                                                    className="inline-flex min-h-8 items-center whitespace-nowrap rounded-lg bg-lime-500 px-2.5 text-xs font-black text-brand-navy-900 transition hover:bg-lime-400"
                                                >
                                                    승인
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setShowRejectModal(app)}
                                                    className="inline-flex min-h-8 items-center whitespace-nowrap rounded-lg border border-red-200 px-2.5 text-xs font-bold text-red-700 transition hover:bg-red-50 dark:border-red-900/60 dark:text-red-200 dark:hover:bg-red-950/40"
                                                >
                                                    반려
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setShowCancelModal(app)}
                                                    className="inline-flex min-h-8 items-center whitespace-nowrap rounded-lg border border-gray-200 px-2.5 text-xs font-bold text-gray-600 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-900"
                                                >
                                                    취소
                                                </button>
                                            </div>
                                        ) : (
                                            <span className="whitespace-nowrap text-xs font-bold text-gray-500 dark:text-gray-400">처리 완료</span>
                                        )}
                                    </td>
                                    <td className="px-3 py-2 align-top">
                                        <div className="flex flex-wrap gap-1.5">
                                            <a
                                                href={parentPhoneHref}
                                                className="inline-flex min-h-8 items-center gap-1 whitespace-nowrap rounded-lg border border-gray-200 px-2.5 text-xs font-bold text-gray-700 transition hover:border-brand-orange-300 hover:bg-brand-orange-50 hover:text-brand-orange-700 dark:border-gray-700 dark:text-gray-200 dark:hover:border-brand-neon-lime dark:hover:bg-brand-neon-lime/10 dark:hover:text-brand-neon-lime"
                                            >
                                                <span className="material-symbols-outlined text-sm">call</span>
                                                전화
                                            </a>
                                            <button
                                                type="button"
                                                onClick={() => setShowDetailModal(app)}
                                                className="inline-flex min-h-8 items-center gap-1 whitespace-nowrap rounded-lg border border-gray-200 px-2.5 text-xs font-bold text-gray-700 transition hover:border-brand-orange-300 hover:bg-brand-orange-50 hover:text-brand-orange-700 dark:border-gray-700 dark:text-gray-200 dark:hover:border-brand-neon-lime dark:hover:bg-brand-neon-lime/10 dark:hover:text-brand-neon-lime"
                                            >
                                                <span className="material-symbols-outlined text-sm">visibility</span>
                                                상세
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleRecordContact(app, "CONTACTED")}
                                                disabled={contactBusyId === app.id}
                                                className="inline-flex min-h-8 items-center gap-1 whitespace-nowrap rounded-lg border border-lime-300 bg-lime-50 px-2.5 text-xs font-black text-lime-800 transition hover:bg-lime-100 disabled:opacity-50 dark:border-lime-700 dark:bg-lime-950/30 dark:text-lime-200"
                                            >
                                                <span className="material-symbols-outlined text-sm">done_all</span>
                                                연락
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        );
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
                        체험/수강신청 관리
                        {actionTotal > 0 && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-500 text-white animate-pulse">
                                확인 필요 {actionTotal}건
                            </span>
                        )}
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">체험 문의부터 정규 등록까지 한 화면에서 확인하고 처리합니다</p>
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

            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                <button
                    type="button"
                    onClick={() => setActiveTab(priorityTrialCount >= priorityAppCount ? "trial" : "applications")}
                    className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-red-50 px-3 text-sm font-black text-red-700 transition hover:bg-red-100 dark:bg-red-950/30 dark:text-red-200"
                >
                    <span className="material-symbols-outlined text-base">priority_high</span>
                    오늘 먼저 {firstLookCount}
                    <span className="text-xs font-bold opacity-80">체험 {priorityTrialCount} · 신청 {priorityAppCount}</span>
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab("trial")}
                    className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-gray-100 px-3 text-sm font-bold text-gray-700 transition hover:bg-gray-200 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-700"
                >
                    <span className="material-symbols-outlined text-base text-brand-orange-500 dark:text-brand-neon-lime">diversity_3</span>
                    새 체험 {trialNewCount}
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab("trial")}
                    className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-gray-100 px-3 text-sm font-bold text-gray-700 transition hover:bg-gray-200 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-700"
                >
                    <span className="material-symbols-outlined text-base text-brand-orange-500 dark:text-brand-neon-lime">event_available</span>
                    체험 예정 {trialScheduledCount}
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab("applications")}
                    className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-gray-100 px-3 text-sm font-bold text-gray-700 transition hover:bg-gray-200 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-700"
                >
                    <span className="material-symbols-outlined text-base text-brand-orange-500 dark:text-brand-neon-lime">assignment</span>
                    수강 대기 {stats.PENDING}
                </button>
            </div>

            {/* 탭 버튼 */}
            <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
                <button
                    onClick={() => setActiveTab("trial")}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition ${
                        activeTab === "trial"
                            ? "bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm"
                            : "text-gray-500 hover:text-gray-700 dark:text-gray-200"
                    }`}
                >
                    <span className="material-symbols-outlined text-lg">diversity_3</span>
                    체험 문의
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
                            ? "bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm"
                            : "text-gray-500 hover:text-gray-700 dark:text-gray-200"
                    }`}
                >
                    <span className="material-symbols-outlined text-lg">assignment</span>
                    수강신청
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
                            ? "bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm"
                            : "text-gray-500 hover:text-gray-700 dark:text-gray-200"
                    }`}
                >
                    <span className="material-symbols-outlined text-lg">settings</span>
                    안내 설정
                </button>
            </div>

            {feedback && (
                <div
                    className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold ${
                        feedback.type === "success"
                            ? "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/40 dark:text-green-200"
                            : "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200"
                    }`}
                    role="status"
                >
                    <span className="material-symbols-outlined text-lg">
                        {feedback.type === "success" ? "check_circle" : "error"}
                    </span>
                    {feedback.message}
                </div>
            )}

            {/* 탭 내용 */}
            {activeTab === "trial" ? (
                <TrialCrmClient
                    initialLeads={initialTrialLeads}
                    initialStats={initialTrialStats}
                    initialClasses={initialTrialClasses}
                    initialPagination={initialTrialPagination}
                    applicationContacts={applicationContacts}
                />
            ) : activeTab === "applications" ? (
                !applyLoaded ? (
                    loadError ? <ApplyErrorState onRetry={loadApplyData} /> : <ApplyLoadingFallback />
                ) : (
                <>
                    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                            <label className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-600 focus-within:border-brand-orange-400 focus-within:bg-white dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:focus-within:border-brand-neon-lime">
                                <span className="material-symbols-outlined text-lg text-gray-400">search</span>
                                <input
                                    type="search"
                                    value={searchQuery}
                                    onChange={(event) => setSearchQuery(event.target.value)}
                                    placeholder="학생, 보호자, 전화번호로 검색"
                                    className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-gray-400"
                                />
                                {searchQuery && (
                                    <button
                                        type="button"
                                        onClick={() => setSearchQuery("")}
                                        className="rounded-full p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-100"
                                        title="검색어 지우기"
                                    >
                                        <span className="material-symbols-outlined text-base">close</span>
                                    </button>
                                )}
                            </label>
                            <label className="flex items-center gap-2 text-sm font-bold text-gray-600 dark:text-gray-300">
                                상태
                                <select
                                    value={filter}
                                    onChange={(event) => setFilter(event.target.value)}
                                    className="min-h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm font-bold text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                                >
                                    <option value="ALL">전체 {stats.total}</option>
                                    {STATUS_ORDER.map((s) => {
                                        const cfg = STATUS_CONFIG[s];
                                        const count = stats[s as keyof EnrollStats] as number;
                                        return (
                                            <option key={s} value={s}>
                                                {cfg.label} {count}
                                            </option>
                                        );
                                    })}
                                </select>
                            </label>
                            <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1 dark:border-gray-700 dark:bg-gray-900">
                                <button
                                    type="button"
                                    onClick={() => setViewMode("cards")}
                                    className={`inline-flex min-h-9 items-center gap-1.5 rounded-md px-3 text-sm font-bold transition ${
                                        viewMode === "cards"
                                            ? "bg-white text-gray-900 shadow-sm dark:bg-gray-800 dark:text-white"
                                            : "text-gray-500 hover:text-gray-800 dark:text-gray-300 dark:hover:text-white"
                                    }`}
                                >
                                    <span className="material-symbols-outlined text-base">grid_view</span>
                                    카드
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setViewMode("list")}
                                    className={`inline-flex min-h-9 items-center gap-1.5 rounded-md px-3 text-sm font-bold transition ${
                                        viewMode === "list"
                                            ? "bg-white text-gray-900 shadow-sm dark:bg-gray-800 dark:text-white"
                                            : "text-gray-500 hover:text-gray-800 dark:text-gray-300 dark:hover:text-white"
                                    }`}
                                >
                                    <span className="material-symbols-outlined text-base">view_list</span>
                                    목록
                                </button>
                            </div>
                        </div>
                        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                            {APPLICATION_WORK_FILTERS.map((item) => (
                                <button
                                    key={item.value}
                                    type="button"
                                    onClick={() => setWorkFilter(item.value)}
                                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition ${
                                        workFilter === item.value
                                            ? "bg-gray-900 text-white dark:bg-brand-neon-lime dark:text-brand-navy-900"
                                            : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-700"
                                    }`}
                                >
                                    <span className="material-symbols-outlined text-sm">{item.icon}</span>
                                    {item.label}
                                    <span className="font-black">{workFilterCounts[item.value]}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 신청서 목록 */}
                    {filteredApps.length === 0 ? (
                        <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                            <span className="material-symbols-outlined text-5xl text-gray-300">inbox</span>
                            <p className="text-gray-500 dark:text-gray-400 mt-3">
                                {searchQuery || workFilter !== "ALL"
                                    ? "조건에 맞는 수강신청이 없습니다"
                                    : filter === "ALL"
                                    ? "접수된 수강 신청이 없습니다"
                                    : `"${STATUS_CONFIG[filter]?.label}" 상태의 신청이 없습니다`}
                            </p>
                            {hasMoreServerApps && (
                                <button
                                    type="button"
                                    onClick={handleShowMoreApps}
                                    disabled={loadingMore}
                                    className="mt-4 rounded-lg border border-gray-200 px-4 py-2 text-sm font-bold text-gray-700 transition hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-900"
                                >
                                    {loadingMore ? "불러오는 중..." : "다음 50건에서 더 찾아보기"}
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="grid gap-2.5">
                            {viewMode === "list" ? renderApplicationList() : visibleApps.map((app) => {
                                const cfg = STATUS_CONFIG[app.status] || STATUS_CONFIG.PENDING;
                                const age = calcAge(app.childBirthDate);
                                const preferredSlotLabel = formatPreferredSlots(app.preferredSlotKeys, classesBySlotKey);
                                const contactCount = getContactCount(app.parentPhone, openContactCounts);
                                const priorityBadges = getApplicationPriorityBadges(app, preferredSlotLabel, contactCount);
                                const visibleBadges = priorityBadges.slice(0, 2);
                                const parentPhoneHref = phoneHref(app.parentPhone);
                                const operationItems = [
                                    { label: "접수", value: formatDate(app.createdAt), icon: "inbox" },
                                    app.enrollmentMonths
                                        ? { label: "수강월", value: app.enrollmentMonths, icon: "calendar_month" }
                                        : null,
                                    preferredSlotLabel
                                        ? { label: "희망시간", value: preferredSlotLabel, icon: "schedule" }
                                        : null,
                                    app.assignedClassId
                                        ? { label: "배정", value: "배정 완료", icon: "check_circle" }
                                        : null,
                                    app.shuttleNeeded
                                        ? {
                                            label: "셔틀",
                                            value: [app.shuttlePickup, app.shuttleDropoff, app.shuttleTime].filter(Boolean).join(" / ") || "신청",
                                            icon: "directions_bus",
                                        }
                                        : null,
                                ].filter(Boolean) as Array<{ label: string; value: string; icon: string }>;
                                return (
                                    <div
                                        key={app.id}
                                        className="rounded-lg border border-gray-200 bg-white p-3 transition-shadow hover:shadow-sm dark:border-gray-700 dark:bg-gray-800"
                                    >
                                        <div className="flex flex-col gap-2.5">
                                            {/* 왼쪽: 기본 정보 */}
                                            <div className="flex-1 min-w-0">
                                                {/* 상태 + 유입경로 배지 */}
                                                <div className="mb-1.5 flex items-center gap-1.5 flex-wrap">
                                                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${cfg.color}`}>
                                                        <span className="material-symbols-outlined text-sm">{cfg.icon}</span>
                                                        {cfg.label}
                                                    </span>
                                                    {app.referralSource && (
                                                        <span className="inline-flex items-center rounded bg-gray-100 px-2 py-0.5 text-[11px] font-bold text-gray-600 dark:bg-gray-700 dark:text-gray-200">
                                                            {SOURCE_LABELS[app.referralSource] || app.referralSource}
                                                        </span>
                                                    )}
                                                    {visibleBadges.map((badge) => (
                                                        <span
                                                            key={`${app.id}-priority-${badge.label}`}
                                                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-black ${badge.className}`}
                                                        >
                                                            <span className="material-symbols-outlined text-sm">{badge.icon}</span>
                                                            {badge.label}
                                                        </span>
                                                    ))}
                                                </div>

                                                {/* 아이 이름 + 나이/학년 */}
                                                <h3 className="text-base font-black text-gray-900 dark:text-white">
                                                    {app.childName}
                                                    {age !== null && (
                                                        <span className="ml-1.5 text-xs font-bold text-gray-500 dark:text-gray-400">
                                                            (만 {age}세)
                                                        </span>
                                                    )}
                                                </h3>

                                                {/* 보호자 + 연락처 + 신청일 */}
                                                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                                                    <span className="flex items-center gap-1">
                                                        <span className="material-symbols-outlined text-sm">person</span>
                                                        {app.parentName}
                                                        {app.parentRelation && ` (${app.parentRelation})`}
                                                    </span>
                                                    <a
                                                        href={parentPhoneHref}
                                                        className="flex items-center gap-1 font-semibold text-gray-700 hover:text-brand-orange-600 dark:text-gray-200 dark:hover:text-brand-neon-lime"
                                                    >
                                                        <span className="material-symbols-outlined text-sm">phone</span>
                                                        {app.parentPhone}
                                                    </a>
                                                    <span className="flex items-center gap-1">
                                                        <span className="material-symbols-outlined text-sm">calendar_today</span>
                                                        {formatDate(app.createdAt)}
                                                    </span>
                                                </div>

                                                <div className="mt-2 flex flex-wrap gap-1.5">
                                                    {operationItems.map((item) => (
                                                        <div
                                                            key={`${app.id}-summary-${item.label}`}
                                                            className={COMPACT_CARD_CHIP_CLASS}
                                                            title={`${item.label} ${item.value}`}
                                                        >
                                                            <span className="material-symbols-outlined text-sm text-brand-orange-500 dark:text-brand-neon-lime">
                                                                {item.icon}
                                                            </span>
                                                            <span className="min-w-0 truncate">
                                                                <span className="mr-1 font-black text-gray-900 dark:text-white">{item.label}</span>
                                                                <span>{item.value}</span>
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>

                                                {/* 학년/학교/성별 태그 */}
                                                {(app.childGrade || app.childSchool || app.childGender) && (
                                                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                                                        {app.childGrade && (
                                                            <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-1.5 py-0.5 text-[11px] font-bold text-blue-700 dark:bg-blue-950/40 dark:text-blue-200">
                                                                <span className="material-symbols-outlined text-xs">school</span>
                                                                {app.childGrade}
                                                            </span>
                                                        )}
                                                        {app.childSchool && (
                                                            <span className="inline-flex items-center gap-1 rounded bg-indigo-50 px-1.5 py-0.5 text-[11px] font-bold text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-200">
                                                                <span className="material-symbols-outlined text-xs">apartment</span>
                                                                {app.childSchool}
                                                            </span>
                                                        )}
                                                        {app.childGender && (
                                                            <span className="inline-flex items-center rounded bg-pink-50 px-1.5 py-0.5 text-[11px] font-bold text-pink-700 dark:bg-pink-950/40 dark:text-pink-200">
                                                                {app.childGender}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}

                                                {/* 농구 경험 태그 */}
                                                {app.basketballExp && (
                                                    <div className="mt-1 flex flex-wrap gap-1.5">
                                                        <span className="inline-flex items-center gap-1 rounded bg-orange-50 px-1.5 py-0.5 text-[11px] font-bold text-orange-700 dark:bg-orange-950/40 dark:text-orange-200">
                                                            <span className="material-symbols-outlined text-xs">sports_basketball</span>
                                                            농구 {app.basketballExp}
                                                        </span>
                                                    </div>
                                                )}

                                                {/* 메모 */}
                                                {app.memo && (
                                                    <p className="mt-1.5 line-clamp-2 rounded-md bg-gray-50 px-2 py-1.5 text-xs font-bold text-gray-600 dark:bg-gray-900 dark:text-gray-300">
                                                        {app.memo}
                                                    </p>
                                                )}

                                                {/* 처리 결과 (승인/반려 시) */}
                                                {app.processedNote && (
                                                    <p className={`mt-1.5 line-clamp-2 rounded-md px-2 py-1.5 text-xs font-bold ${
                                                        app.status === "APPROVED"
                                                            ? "text-green-700 bg-green-50 dark:bg-green-950/40 dark:text-green-200"
                                                            : "text-red-700 bg-red-50 dark:bg-red-950/40 dark:text-red-200"
                                                    }`}>
                                                        <span className="font-medium">처리 메모:</span> {app.processedNote}
                                                    </p>
                                                )}

                                                {(app.openFollowUpAt || app.latestContactAction) && (
                                                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                                                        {app.openFollowUpAt && (
                                                            <span className="inline-flex items-center gap-1 rounded-md bg-lime-50 px-2 py-1 text-[11px] font-bold text-lime-700 dark:bg-lime-950/40 dark:text-lime-200">
                                                                <span className="material-symbols-outlined text-sm">phone_callback</span>
                                                                다음 연락 {formatContactDateTime(app.openFollowUpAt)}
                                                                {app.openFollowUpNote ? ` · ${app.openFollowUpNote}` : ""}
                                                            </span>
                                                        )}
                                                        {app.latestContactAction && (
                                                            <span className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-1 text-[11px] font-bold text-gray-600 dark:bg-gray-900 dark:text-gray-300">
                                                                <span className="material-symbols-outlined text-sm">history</span>
                                                                최근 {CONTACT_ACTION_LABELS[app.latestContactAction] ?? app.latestContactAction}
                                                                {app.latestContactAt ? ` · ${formatContactDateTime(app.latestContactAt)}` : ""}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            {/* 카드 하단: 자주 쓰는 작업만 먼저 보여주고 나머지는 접어서 모바일 깨짐을 막는다. */}
                                            <div className="flex w-full flex-wrap items-center gap-1.5 border-t border-gray-100 pt-2 dark:border-gray-700">
                                                <a
                                                    href={parentPhoneHref}
                                                    className={COMPACT_CARD_ACTION_CLASS}
                                                    title="보호자에게 전화"
                                                >
                                                    <span className="material-symbols-outlined text-base">call</span>
                                                    전화
                                                </a>
                                                <button
                                                    type="button"
                                                    onClick={() => setShowDetailModal(app)}
                                                    className={COMPACT_CARD_ACTION_CLASS}
                                                    title="신청 상세 보기"
                                                >
                                                    <span className="material-symbols-outlined text-base">visibility</span>
                                                    상세
                                                </button>
                                                {app.status === "PENDING" && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowApproveModal(app)}
                                                        className={COMPACT_CARD_PRIMARY_CLASS}
                                                    >
                                                        <span className="material-symbols-outlined text-base">check_circle</span>
                                                        승인
                                                    </button>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() => handleRecordContact(app, "CONTACTED")}
                                                    disabled={contactBusyId === app.id}
                                                    className={COMPACT_CARD_CONTACT_CLASS}
                                                    title="보호자 연락 완료 기록"
                                                >
                                                    <span className="material-symbols-outlined text-base">done_all</span>
                                                    연락 완료
                                                </button>
                                                <details className="w-full sm:w-auto">
                                                    <summary className={`${COMPACT_CARD_ACTION_CLASS} cursor-pointer list-none`}>
                                                        <span className="material-symbols-outlined text-base">more_horiz</span>
                                                        더보기
                                                    </summary>
                                                    <div className="mt-1.5 flex flex-wrap gap-1.5 rounded-md border border-gray-100 bg-gray-50 p-1.5 dark:border-gray-700 dark:bg-gray-900/60">
                                                <button
                                                    type="button"
                                                    onClick={() => handleCopyText(app.parentPhone, `${app.childName} 보호자 연락처를 복사했습니다.`)}
                                                    className={COMPACT_CARD_ACTION_CLASS}
                                                    title="보호자 연락처 복사"
                                                >
                                                    <span className="material-symbols-outlined text-base">content_copy</span>
                                                    번호 복사
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        handleCopyText(
                                                            formatApplicationCopySummary(app, preferredSlotLabel),
                                                            `${app.childName} 신청 요약을 복사했습니다.`,
                                                        )
                                                    }
                                                    className={COMPACT_CARD_ACTION_CLASS}
                                                    title="상담용 신청 요약 복사"
                                                >
                                                    <span className="material-symbols-outlined text-base">assignment</span>
                                                    요약 복사
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRecordContact(app, "NO_ANSWER")}
                                                    disabled={contactBusyId === app.id}
                                                    className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-gray-200 px-2.5 text-xs font-bold text-gray-700 transition hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:border-amber-400 dark:hover:bg-amber-950/30 dark:hover:text-amber-200"
                                                    title="부재 기록"
                                                >
                                                    <span className="material-symbols-outlined text-base">phone_disabled</span>
                                                    부재
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setContactModal({ app, defaultAction: "FOLLOW_UP" })}
                                                    className={COMPACT_CARD_ACTION_CLASS}
                                                    title="재연락 예약 또는 상담 메모"
                                                >
                                                    <span className="material-symbols-outlined text-base">event_repeat</span>
                                                    재연락
                                                </button>
                                                {app.status !== "APPROVED" && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowEditModal(app)}
                                                        className={COMPACT_CARD_ACTION_CLASS}
                                                        title="수강신청 내용 수정"
                                                    >
                                                        <span className="material-symbols-outlined text-base">edit</span>
                                                        수정
                                                    </button>
                                                )}
                                                {app.status === "PENDING" && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowRejectModal(app)}
                                                        className={COMPACT_CARD_ACTION_DANGER_CLASS}
                                                    >
                                                        <span className="material-symbols-outlined text-base">cancel</span>
                                                        반려
                                                    </button>
                                                )}
                                                {app.status === "PENDING" && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowCancelModal(app)}
                                                        className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-gray-200 px-2.5 text-xs font-bold text-gray-700 transition hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                                                        title="수강신청 취소 처리"
                                                    >
                                                        <span className="material-symbols-outlined text-base">block</span>
                                                        취소
                                                    </button>
                                                )}
                                                    </div>
                                                </details>
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
                                        onClick={handleShowMoreApps}
                                        disabled={loadingMore}
                                        className="rounded-lg border border-gray-200 px-4 py-2 font-bold text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-900"
                                    >
                                        {loadingMore ? "불러오는 중..." : "50건 더 보기"}
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </>
                )
            ) : (
                /* 설정 탭 — 기존 안내 설정 UI */
                <ApplySettingsTab />
            )}

            {hasApplyModal && (
                <ApplyAdminModals
                    approveApp={showApproveModal}
                    rejectApp={showRejectModal}
                    detailApp={showDetailModal}
                    editApp={showEditModal}
                    cancelApp={showCancelModal}
                    classes={classes}
                    onCloseApprove={() => setShowApproveModal(null)}
                    onCloseReject={() => setShowRejectModal(null)}
                    onCloseDetail={() => setShowDetailModal(null)}
                    onCloseEdit={() => setShowEditModal(null)}
                    onCloseCancel={() => setShowCancelModal(null)}
                    onSaved={loadApplyData}
                    onFeedback={showFeedback}
                />
            )}

            {contactModal && (
                <ApplicationContactModal
                    app={contactModal.app}
                    defaultAction={contactModal.defaultAction}
                    busy={contactBusyId === contactModal.app.id}
                    onClose={() => setContactModal(null)}
                    onSubmit={async ({ action, note, nextFollowUpAt }) => {
                        await handleRecordContact(contactModal.app, action, note, nextFollowUpAt);
                        setContactModal(null);
                    }}
                />
            )}
        </div>
    );
}

function ApplicationContactModal({
    app,
    defaultAction,
    busy,
    onClose,
    onSubmit,
}: {
    app: EnrollApplication;
    defaultAction: ContactActionType;
    busy: boolean;
    onClose: () => void;
    onSubmit: (input: { action: ContactActionType; note: string | null; nextFollowUpAt: string | null }) => Promise<void> | void;
}) {
    const [action, setAction] = useState<ContactActionType>(defaultAction);
    const [note, setNote] = useState("");
    const [nextFollowUpAt, setNextFollowUpAt] = useState("");
    const [formError, setFormError] = useState("");

    function handleSubmit(event: FormEvent) {
        event.preventDefault();
        if (action === "FOLLOW_UP" && !nextFollowUpAt) {
            setFormError("다음 연락 예정일을 선택해 주세요.");
            return;
        }
        setFormError("");
        void onSubmit({
            action,
            note: note.trim() || null,
            nextFollowUpAt: nextFollowUpAt ? new Date(nextFollowUpAt).toISOString() : null,
        });
    }

    return (
        <AdminModal onClose={onClose} titleId="application-contact-modal-title" panelClassName="max-w-md" closeOnBackdrop={!busy}>
            <form
                onSubmit={handleSubmit}
                className="w-full p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
            >
                <h2 id="application-contact-modal-title" className="flex items-center gap-2 text-lg font-black text-gray-900 dark:text-white">
                    <span className="material-symbols-outlined text-brand-orange-500 dark:text-brand-neon-lime">phone_callback</span>
                    후속 연락 기록
                </h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {app.childName} · {app.parentName} {app.parentPhone}
                </p>

                <div className="mt-5 grid grid-cols-2 gap-2">
                    {(["FOLLOW_UP", "MEMO"] as ContactActionType[]).map((option) => (
                        <button
                            key={option}
                            type="button"
                            onClick={() => setAction(option)}
                            className={`rounded-xl border px-3 py-2 text-sm font-black transition ${
                                action === option
                                    ? "border-brand-orange-500 bg-brand-orange-50 text-brand-orange-700 dark:border-brand-neon-lime dark:bg-brand-neon-lime/10 dark:text-brand-neon-lime"
                                    : "border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-900"
                            }`}
                        >
                            {CONTACT_ACTION_LABELS[option]}
                        </button>
                    ))}
                </div>

                {action === "FOLLOW_UP" && (
                    <label className="mt-4 block text-sm font-bold text-gray-700 dark:text-gray-200">
                        다음 연락 예정
                        <input
                            type="datetime-local"
                            value={nextFollowUpAt}
                            onChange={(event) => setNextFollowUpAt(event.target.value)}
                            className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-orange-500 dark:border-gray-700 dark:bg-gray-900 dark:focus:border-brand-neon-lime"
                        />
                    </label>
                )}

                <label className="mt-4 block text-sm font-bold text-gray-700 dark:text-gray-200">
                    상담 메모
                    <textarea
                        value={note}
                        onChange={(event) => setNote(event.target.value)}
                        rows={4}
                        className="mt-1 w-full resize-none rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-orange-500 dark:border-gray-700 dark:bg-gray-900 dark:focus:border-brand-neon-lime"
                        placeholder="상담 내용이나 다음에 확인할 내용을 적어주세요"
                    />
                </label>

                {formError && (
                    <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-bold text-red-700 dark:bg-red-950/40 dark:text-red-200">
                        {formError}
                    </p>
                )}

                <div className="mt-5 flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-xl px-4 py-2 text-sm font-bold text-gray-500 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-900"
                    >
                        닫기
                    </button>
                    <button
                        type="submit"
                        disabled={busy}
                        className="rounded-xl bg-brand-orange-500 px-5 py-2 text-sm font-black text-white transition hover:bg-brand-orange-600 disabled:opacity-50 dark:bg-brand-neon-lime dark:text-brand-navy-900 dark:hover:bg-lime-400"
                    >
                        {busy ? "저장 중..." : "저장"}
                    </button>
                </div>
            </form>
        </AdminModal>
    );
}
