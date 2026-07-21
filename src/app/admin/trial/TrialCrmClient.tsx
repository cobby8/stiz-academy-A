"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import dynamic from "next/dynamic";
import AdminModal from "@/components/admin/AdminModal";
import {
    updateTrialLead,
    sendPostTrialEnrollGuide,
    sendTrialCoachNotice,
    resendTrialApplicationSms,
    recordApplicationContact,
} from "@/app/actions/admin";

const TrialCrmModals = dynamic(() => import("./TrialCrmModals"), {
    loading: () => null,
});

// ── 타입 정의 ──────────────────────────────────────────────────────────────────

export interface TrialLead {
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
    // Phase A 추가 필드
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

export interface ClassInfo {
    id: string;
    name: string;
    dayOfWeek: string;
    startTime: string;
    endTime: string;
    capacity: number;
    slotKey: string | null;
    program: { id: string; name: string } | null;
}

type TrialCrmPayload = {
    leads: TrialLead[];
    stats: TrialStats;
    classes?: ClassInfo[];
    pagination?: ListPagination;
};

type ListPagination = {
    limit: number;
    offset: number;
    returned: number;
    total: number;
    hasMore: boolean;
    nextOffset: number | null;
    partial: boolean;
};

type FeedbackState = { type: "success" | "error"; message: string } | null;
type TrialWorkFilter = "ALL" | "NEEDS_CONTACT" | "SCHEDULED" | "AFTER_TRIAL" | "COACH_NOTICE" | "ENROLL_RECEIVED";
type ContactActionType = "CONTACTED" | "NO_ANSWER" | "FOLLOW_UP" | "MEMO";
type ContactModalState = { lead: TrialLead; defaultAction: ContactActionType } | null;
const LIST_ACTION_TRIGGER_CLASS = "inline-flex size-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 shadow-sm transition hover:border-brand-orange-300 hover:bg-brand-orange-50 hover:text-brand-orange-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:hover:border-brand-neon-lime dark:hover:bg-brand-neon-lime/10 dark:hover:text-brand-neon-lime";
const LIST_ACTION_MENU_CLASS = "absolute right-2 top-9 z-50 w-44 rounded-xl border border-gray-200 bg-white p-1.5 text-left shadow-xl dark:border-gray-700 dark:bg-gray-950";
const LIST_ACTION_ITEM_CLASS = "flex min-h-9 w-full items-center gap-2 rounded-lg px-3 text-left text-xs font-bold text-gray-700 transition hover:bg-gray-50 dark:text-gray-100 dark:hover:bg-gray-800";
const LIST_ACTION_PRIMARY_CLASS = "flex min-h-9 w-full items-center gap-2 rounded-lg bg-blue-600 px-3 text-left text-xs font-black text-white transition hover:bg-blue-700 disabled:opacity-50 dark:bg-brand-neon-lime dark:text-brand-navy-900 dark:hover:bg-lime-300";
const DETAIL_ACTION_CLASS = "inline-flex min-h-8 items-center gap-1.5 rounded-md border border-gray-200 px-3 text-xs font-bold text-gray-700 transition hover:border-brand-orange-300 hover:bg-brand-orange-50 hover:text-brand-orange-700 dark:border-gray-700 dark:text-gray-100 dark:hover:border-brand-neon-lime dark:hover:bg-brand-neon-lime/10";
const EMPTY_STATS: TrialStats = {
    NEW: 0,
    CONTACTED: 0,
    SCHEDULED: 0,
    ATTENDED: 0,
    CONVERTED: 0,
    LOST: 0,
    CANCELLED: 0,
    total: 0,
    conversionRate: 0,
};

// ── 상태별 라벨/색상/아이콘 매핑 ──────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
    NEW: { label: "신규", color: "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-200", icon: "fiber_new" },
    CONTACTED: { label: "연락완료", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950/50 dark:text-yellow-200", icon: "call" },
    SCHEDULED: { label: "체험예정", color: "bg-purple-100 text-purple-800 dark:bg-purple-950/50 dark:text-purple-200", icon: "event" },
    ATTENDED: { label: "체험완료", color: "bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-200", icon: "check_circle" },
    CONVERTED: { label: "등록전환", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200", icon: "how_to_reg" },
    LOST: { label: "이탈", color: "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400", icon: "person_off" },
    CANCELLED: { label: "취소", color: "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400", icon: "block" },
};

// 유입경로 라벨
const SOURCE_LABELS: Record<string, string> = {
    WEBSITE: "홈페이지",
    NAVER: "네이버",
    REFERRAL: "지인소개",
    FLYER: "전단지",
    PASSBY: "지나가다",
    OTHER: "기타",
};

// 상태 순서 (파이프라인 흐름)
const STATUS_ORDER = ["NEW", "CONTACTED", "SCHEDULED", "ATTENDED", "CONVERTED", "LOST", "CANCELLED"] as const;
const CLOSED_TRIAL_STATUSES = new Set(["CONVERTED", "LOST", "CANCELLED"]);
const TRIAL_PAGE_SIZE = 50;

const TRIAL_WORK_FILTERS: Array<{ value: TrialWorkFilter; label: string; icon: string }> = [
    { value: "ALL", label: "운영 전체", icon: "view_list" },
    { value: "NEEDS_CONTACT", label: "연락 필요", icon: "call" },
    { value: "SCHEDULED", label: "체험 예정", icon: "event_available" },
    { value: "AFTER_TRIAL", label: "상담/안내 필요", icon: "sms" },
    { value: "COACH_NOTICE", label: "쌤 알림 필요", icon: "school" },
    { value: "ENROLL_RECEIVED", label: "수강신청 접수", icon: "assignment_turned_in" },
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

function phoneHref(phone: string) {
    const digits = phone.replace(/\D/g, "");
    return digits ? `tel:${digits}` : undefined;
}

function normalizeSearchValue(value: string | null | undefined) {
    return (value ?? "").replace(/\s+/g, "").replace(/-/g, "").toLowerCase();
}

function formatContactDateTime(dateStr: string | null) {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return "-";
    return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function isClosedTrialStatus(status: string) {
    return CLOSED_TRIAL_STATUSES.has(status);
}

function formatCompactDate(dateStr: string | null) {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return "-";
    return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
}

function formatCompactDateTime(dateStr: string | null) {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return "-";
    return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function formatShortDate(dateStr: string | null) {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return "-";
    return `${date.getMonth() + 1}/${date.getDate()}`;
}

function isLikelyDefaultScheduleTime(dateStr: string | null) {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return false;
    return date.getHours() === 9 && date.getMinutes() === 0;
}

const DAY_LABELS: Record<string, string> = {
    Mon: "월",
    Tue: "화",
    Wed: "수",
    Thu: "목",
    Fri: "금",
    Sat: "토",
    Sun: "일",
};

const DAY_SHORT_LABELS: Record<string, string> = {
    Mon: "월",
    Tue: "화",
    Wed: "수",
    Thu: "목",
    Fri: "금",
    Sat: "토",
    Sun: "일",
};

const DAY_CODE_BY_LABEL: Record<string, string> = {
    월: "Mon",
    월요일: "Mon",
    화: "Tue",
    화요일: "Tue",
    수: "Wed",
    수요일: "Wed",
    목: "Thu",
    목요일: "Thu",
    금: "Fri",
    금요일: "Fri",
    토: "Sat",
    토요일: "Sat",
    일: "Sun",
    일요일: "Sun",
};

function normalizePreferredDayCode(day: string | null) {
    if (!day) return null;
    const trimmed = day.trim();
    return DAY_LABELS[trimmed] ? trimmed : DAY_CODE_BY_LABEL[trimmed] ?? null;
}

function normalizePreferredPeriod(period: string | null) {
    if (!period) return null;
    const matched = period.match(/\d+/);
    return matched?.[0] ?? null;
}

function normalizeSlotKey(slotKey: string | null) {
    if (!slotKey) return null;
    const [dayPart, periodPart] = slotKey.trim().split("-");
    const dayCode = normalizePreferredDayCode(dayPart);
    const period = normalizePreferredPeriod(periodPart ?? "");
    return dayCode && period ? `${dayCode}-${period}` : slotKey.trim();
}

function getPreferredSlotKeyCandidates(lead: TrialLead) {
    const candidates: string[] = [];
    const directSlotKey = normalizeSlotKey(lead.preferredSlotKey);
    const dayCode = normalizePreferredDayCode(lead.preferredDay);
    const period = normalizePreferredPeriod(lead.preferredPeriod);
    const derivedSlotKey = dayCode && period ? `${dayCode}-${period}` : null;

    [directSlotKey, derivedSlotKey].forEach((slotKey) => {
        if (slotKey && !candidates.includes(slotKey)) candidates.push(slotKey);
    });

    return candidates;
}

function getPreferredClass(lead: TrialLead, classesBySlotKey?: Map<string, ClassInfo>) {
    for (const slotKey of getPreferredSlotKeyCandidates(lead)) {
        const classInfo = classesBySlotKey?.get(slotKey);
        if (classInfo) return classInfo;
    }
    return null;
}

function formatClassLabel(classInfo: ClassInfo) {
    const dayLabel = DAY_LABELS[classInfo.dayOfWeek] || classInfo.dayOfWeek;
    const timeLabel = [classInfo.startTime, classInfo.endTime].filter(Boolean).join("~");
    const programName = classInfo.program?.name ? ` · ${classInfo.program.name}` : "";
    return [dayLabel, timeLabel].filter(Boolean).join(" ") + ` · ${classInfo.name}${programName}`;
}

function getPeriodFromClass(classInfo: ClassInfo) {
    const slotPeriod = classInfo.slotKey?.split("-")[1]?.match(/\d+/)?.[0];
    if (slotPeriod) return slotPeriod;
    return classInfo.name.match(/\d+/)?.[0] ?? "";
}

function formatClassShortLabel(classInfo: ClassInfo) {
    const dayLabel = DAY_SHORT_LABELS[classInfo.dayOfWeek] || classInfo.dayOfWeek;
    const period = getPeriodFromClass(classInfo);
    return [dayLabel, period].filter(Boolean).join("");
}

function formatSlotShortLabel(slotKey: string | null) {
    const normalized = normalizeSlotKey(slotKey);
    if (!normalized) return null;
    const [dayCode, periodPart] = normalized.split("-");
    const dayLabel = DAY_SHORT_LABELS[dayCode] || dayCode;
    const period = normalizePreferredPeriod(periodPart ?? "");
    return dayLabel && period ? `${dayLabel}${period}` : normalized;
}

function formatPreferredScheduleShort(lead: TrialLead, classesBySlotKey?: Map<string, ClassInfo>) {
    const matchedClass = getPreferredClass(lead, classesBySlotKey);
    if (matchedClass) return formatClassShortLabel(matchedClass);

    const slotLabel = formatSlotShortLabel(lead.preferredSlotKey);
    if (slotLabel) return slotLabel;

    const dayCode = normalizePreferredDayCode(lead.preferredDay);
    const period = normalizePreferredPeriod(lead.preferredPeriod);
    if (dayCode && period) return `${DAY_SHORT_LABELS[dayCode] || dayCode}${period}`;
    return null;
}

function formatConfirmedScheduleShort(
    lead: TrialLead,
    classesById?: Map<string, ClassInfo>,
    classesBySlotKey?: Map<string, ClassInfo>,
) {
    const matchedClass =
        (lead.scheduledClassId ? classesById?.get(lead.scheduledClassId) : null) ||
        getPreferredClass(lead, classesBySlotKey);
    const classLabel = matchedClass ? formatClassShortLabel(matchedClass) : formatPreferredScheduleShort(lead, classesBySlotKey);
    if (lead.scheduledDate && classLabel) return `${formatShortDate(lead.scheduledDate)} ${classLabel}`;
    if (lead.scheduledDate) return formatShortDate(lead.scheduledDate);
    return classLabel;
}

function formatPreferredSchedule(lead: TrialLead, classesBySlotKey?: Map<string, ClassInfo>) {
    const matchedClass = getPreferredClass(lead, classesBySlotKey);
    if (matchedClass) return formatClassLabel(matchedClass);

    const rawDay = lead.preferredDay?.replace(/요일$/, "");
    const day = rawDay ? `${DAY_LABELS[rawDay] || rawDay}요일` : "";
    const period = lead.preferredPeriod
        ? lead.preferredPeriod.includes("교시")
            ? lead.preferredPeriod
            : `${lead.preferredPeriod}교시`
        : "";
    const label = [day, period].filter(Boolean).join(" ");
    if (label) return label;
    return lead.preferredSlotKey ? "희망 시간 확인 필요" : null;
}

function formatConfirmedSchedule(
    lead: TrialLead,
    classesById?: Map<string, ClassInfo>,
    classesBySlotKey?: Map<string, ClassInfo>,
) {
    const matchedClass =
        (lead.scheduledClassId ? classesById?.get(lead.scheduledClassId) : null) ||
        getPreferredClass(lead, classesBySlotKey);
    if (lead.scheduledDate && matchedClass) {
        return `${formatCompactDate(lead.scheduledDate)} · ${formatClassLabel(matchedClass)}`;
    }
    if (lead.scheduledDate) {
        const preferredSchedule = formatPreferredSchedule(lead, classesBySlotKey);
        if (isLikelyDefaultScheduleTime(lead.scheduledDate) && preferredSchedule) {
            return `${formatCompactDate(lead.scheduledDate)} · ${preferredSchedule} · 시간 확인 필요`;
        }
        return formatCompactDateTime(lead.scheduledDate);
    }
    if (matchedClass) return formatClassLabel(matchedClass);
    return null;
}

function getTrialScheduleItems(
    lead: TrialLead,
    classesBySlotKey?: Map<string, ClassInfo>,
    classesById?: Map<string, ClassInfo>,
) {
    const preferredSchedule = formatPreferredSchedule(lead, classesBySlotKey);
    const confirmedSchedule = formatConfirmedSchedule(lead, classesById, classesBySlotKey);
    const preferredScheduleShort = formatPreferredScheduleShort(lead, classesBySlotKey);
    const confirmedScheduleShort = formatConfirmedScheduleShort(lead, classesById, classesBySlotKey);
    const items = [
        {
            label: "신청일",
            icon: "inbox",
            value: formatCompactDate(lead.createdAt),
            className: "border-gray-100 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200",
        },
        {
            label: "체험일",
            icon: "event",
            value: lead.trialDate ? formatCompactDate(lead.trialDate) : "미입력",
            className: "border-lime-100 bg-lime-50 text-lime-800 dark:border-lime-900/50 dark:bg-lime-950/30 dark:text-lime-200",
        },
        {
            label: "수업교시",
            icon: "schedule",
            value: preferredSchedule || "미입력",
            className: "border-purple-100 bg-purple-50 text-purple-800 dark:border-purple-900/50 dark:bg-purple-950/30 dark:text-purple-200",
        },
        {
            label: "확정일정",
            icon: "event_available",
            value: confirmedSchedule || "미확정",
            className: "border-sky-100 bg-sky-50 text-sky-800 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-sky-200",
        },
    ];
    return items.map((item, index) => {
        if (index === 2 && preferredScheduleShort) return { ...item, value: preferredScheduleShort };
        if (index === 3 && confirmedScheduleShort) return { ...item, value: confirmedScheduleShort };
        return item;
    });
}

function matchesTrialWorkFilter(lead: TrialLead, workFilter: TrialWorkFilter) {
    if (workFilter === "ALL") return true;
    if (workFilter === "NEEDS_CONTACT") return lead.status === "NEW" || lead.status === "CONTACTED";
    if (workFilter === "SCHEDULED") return lead.status === "SCHEDULED";
    if (workFilter === "AFTER_TRIAL") return lead.status === "ATTENDED" && !lead.enrollGuideSentAt;
    if (workFilter === "COACH_NOTICE") return !isClosedTrialStatus(lead.status) && !lead.coachNoticeSentAt;
    if (workFilter === "ENROLL_RECEIVED") return Boolean(lead.enrollApplicationReceivedAt);
    return true;
}

function trialLeadMatchesSearch(lead: TrialLead, query: string) {
    const normalizedQuery = normalizeSearchValue(query);
    if (!normalizedQuery) return true;

    const searchable = [
        lead.childName,
        lead.childAge,
        lead.parentName,
        lead.parentPhone,
        lead.childSchool,
        lead.childGrade,
        lead.childGender,
        lead.basketballExp,
        lead.preferredDay,
        lead.preferredPeriod,
        lead.hopeNote,
        lead.memo,
        lead.lostReason,
        SOURCE_LABELS[lead.source] || lead.source,
    ].map(normalizeSearchValue).join(" ");

    return searchable.includes(normalizedQuery);
}

function TrialCrmLoadingFallback() {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="space-y-2">
                    <div className="h-8 w-48 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                    <div className="h-4 w-80 rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
                </div>
                <div className="h-11 w-36 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                {Array.from({ length: 7 }).map((_, index) => (
                    <div
                        key={index}
                        className="h-28 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 animate-pulse"
                    />
                ))}
            </div>
            <div className="flex gap-2 flex-wrap">
                {Array.from({ length: 6 }).map((_, index) => (
                    <div
                        key={index}
                        className="h-8 w-20 rounded-full bg-gray-100 dark:bg-gray-800 animate-pulse"
                    />
                ))}
            </div>
            <div className="grid gap-4">
                {Array.from({ length: 4 }).map((_, index) => (
                    <div
                        key={index}
                        className="h-40 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 animate-pulse"
                    />
                ))}
            </div>
        </div>
    );
}

function TrialCrmErrorState({ onRetry }: { onRetry: () => void }) {
    return (
        <div className="rounded-2xl border border-red-100 bg-white p-8 text-center shadow-sm dark:border-red-900/40 dark:bg-gray-800">
            <span className="material-symbols-outlined mb-3 text-4xl text-red-500">error</span>
            <p className="font-bold text-gray-900 dark:text-white">체험 문의 정보를 불러오지 못했습니다.</p>
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

// ── 메인 컴포넌트 ──────────────────────────────────────────────────────────────

export default function TrialCrmClient({
    initialLeads,
    initialStats,
    initialClasses,
    initialPagination,
}: {
    initialLeads?: TrialLead[];
    initialStats?: TrialStats;
    initialClasses?: ClassInfo[];
    initialPagination?: ListPagination;
}) {
    const hasInitialData = Boolean(initialLeads && initialStats);
    const [leads, setLeads] = useState<TrialLead[]>(initialLeads ?? []);
    const [stats, setStats] = useState<TrialStats>(initialStats ?? EMPTY_STATS);
    const [classes, setClasses] = useState<ClassInfo[]>(initialClasses ?? []);
    const [loading, setLoading] = useState(!hasInitialData);
    const [loadingMore, setLoadingMore] = useState(false);
    const [pagination, setPagination] = useState<ListPagination | null>(initialPagination ?? null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [filter, setFilter] = useState<string>("ALL");
    const [workFilter, setWorkFilter] = useState<TrialWorkFilter>("ALL");
    const [searchQuery, setSearchQuery] = useState("");
    const [visibleLimit, setVisibleLimit] = useState(TRIAL_PAGE_SIZE);
    const [busy, setBusy] = useState(false);
    const [feedback, setFeedback] = useState<FeedbackState>(null);
    // 모달 상태
    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState<TrialLead | null>(null);
    const [showScheduleModal, setShowScheduleModal] = useState<TrialLead | null>(null);
    const [showCancelModal, setShowCancelModal] = useState<TrialLead | null>(null);
    const [showConvertModal, setShowConvertModal] = useState<TrialLead | null>(null);
    const [showLostModal, setShowLostModal] = useState<TrialLead | null>(null);
    const [showMemoModal, setShowMemoModal] = useState<TrialLead | null>(null);
    const [showDetailModal, setShowDetailModal] = useState<TrialLead | null>(null);
    const [contactModal, setContactModal] = useState<ContactModalState>(null);
    const [contactBusyId, setContactBusyId] = useState<string | null>(null);
    const [openQuickActionId, setOpenQuickActionId] = useState<string | null>(null);
    const hasTrialModal = Boolean(showAddModal || showEditModal || showScheduleModal || showCancelModal || showConvertModal || showLostModal || showMemoModal);

    const loadTrialData = useCallback(async (options?: { append?: boolean; offset?: number }) => {
        const append = Boolean(options?.append);
        const offset = options?.offset ?? 0;

        if (append) setLoadingMore(true);
        else setLoading(true);
        setLoadError(null);

        try {
            const params = new URLSearchParams({
                limit: String(TRIAL_PAGE_SIZE),
                offset: String(offset),
            });
            const res = await fetch(`/api/admin/trial?${params.toString()}`, { cache: "no-store" });
            if (!res.ok) throw new Error("request failed");
            const data = (await res.json()) as TrialCrmPayload;
            setLeads((current) => (append ? [...current, ...data.leads] : data.leads));
            setStats(data.stats);
            setClasses(data.classes ?? []);
            setPagination(data.pagination ?? null);
        } catch {
            setLoadError("failed");
        } finally {
            if (append) setLoadingMore(false);
            else setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (hasInitialData) return;
        void loadTrialData();
    }, [hasInitialData, loadTrialData]);

    const classesBySlotKey = useMemo(() => {
        const map = new Map<string, ClassInfo>();
        classes.forEach((classInfo) => {
            if (classInfo.slotKey) map.set(classInfo.slotKey, classInfo);
        });
        return map;
    }, [classes]);
    const classesById = useMemo(() => {
        const map = new Map<string, ClassInfo>();
        classes.forEach((classInfo) => {
            map.set(classInfo.id, classInfo);
        });
        return map;
    }, [classes]);
    const showFeedback = useCallback((type: "success" | "error", message: string) => {
        setFeedback({ type, message });
        window.setTimeout(() => setFeedback(null), 3500);
    }, []);
    const handleRecordContact = useCallback(async (
        lead: TrialLead,
        action: ContactActionType,
        note?: string | null,
        nextFollowUpAt?: string | null,
    ) => {
        setContactBusyId(lead.id);
        try {
            await recordApplicationContact({
                targetType: "TRIAL",
                targetId: lead.id,
                action,
                note,
                nextFollowUpAt,
            });
            await loadTrialData();
            showFeedback("success", `${lead.childName} ${CONTACT_ACTION_LABELS[action]} 기록을 저장했습니다.`);
        } catch {
            showFeedback("error", "연락 기록 저장 중 문제가 생겼습니다. 잠시 후 다시 시도해주세요.");
        } finally {
            setContactBusyId(null);
        }
    }, [loadTrialData, showFeedback]);

    // 필터링된 리드 목록
    const filteredLeads = useMemo(() => {
        return leads.filter((lead) => {
            if (filter !== "ALL" && lead.status !== filter) return false;
            if (!matchesTrialWorkFilter(lead, workFilter)) return false;
            return trialLeadMatchesSearch(lead, searchQuery);
        });
    }, [filter, leads, searchQuery, workFilter]);
    const visibleLeads = useMemo(
        () => filteredLeads.slice(0, visibleLimit),
        [filteredLeads, visibleLimit],
    );
    const hasMoreLoadedLeads = visibleLeads.length < filteredLeads.length;
    const hasMoreServerLeads = Boolean(pagination?.hasMore);
    const hasMoreLeads = hasMoreLoadedLeads || hasMoreServerLeads;
    const handleShowMoreLeads = useCallback(() => {
        if (hasMoreLoadedLeads) {
            setVisibleLimit((current) => current + TRIAL_PAGE_SIZE);
            return;
        }

        if (!hasMoreServerLeads || loadingMore) return;

        setVisibleLimit((current) => current + TRIAL_PAGE_SIZE);
        void loadTrialData({
            append: true,
            offset: pagination?.nextOffset ?? leads.length,
        });
    }, [hasMoreLoadedLeads, hasMoreServerLeads, leads.length, loadTrialData, loadingMore, pagination?.nextOffset]);
    const workFilterCounts = useMemo(() => {
        const counts: Record<TrialWorkFilter, number> = {
            ALL: leads.length,
            NEEDS_CONTACT: 0,
            SCHEDULED: 0,
            AFTER_TRIAL: 0,
            COACH_NOTICE: 0,
            ENROLL_RECEIVED: 0,
        };

        leads.forEach((lead) => {
            TRIAL_WORK_FILTERS.forEach((item) => {
                if (item.value !== "ALL" && matchesTrialWorkFilter(lead, item.value)) {
                    counts[item.value] += 1;
                }
            });
        });

        return counts;
    }, [leads]);

    useEffect(() => {
        setVisibleLimit(TRIAL_PAGE_SIZE);
    }, [filter, searchQuery, workFilter]);

    // 상태 변경 핸들러
    async function handleStatusChange(lead: TrialLead, newStatus: string) {
        if (busy) return;
        setBusy(true);
        try {
            const updates: { status: string; attendedDate?: string } = { status: newStatus };
            // 상태에 따른 날짜 자동 설정
            if (newStatus === "ATTENDED") {
                updates.attendedDate = new Date().toISOString();
            }
            await updateTrialLead(lead.id, updates);
            await loadTrialData();
            showFeedback("success", `${lead.childName} 상태를 ${STATUS_CONFIG[newStatus]?.label ?? "변경"}으로 바꿨습니다.`);
        } catch {
            showFeedback("error", "상태 변경 중 문제가 생겼습니다. 잠시 후 다시 시도해주세요.");
        } finally {
            setBusy(false);
        }
    }

    async function handleSendEnrollGuide(lead: TrialLead) {
        if (busy) return;
        if (!confirm(`"${lead.childName}" 체험 후 유선상담을 완료 처리하고 수강신청/입학 안내 문자를 발송할까요?`)) return;

        setBusy(true);
        try {
            const result = await sendPostTrialEnrollGuide(lead.id);
            try {
                await navigator.clipboard.writeText(result.enrollLink);
            } catch {
                // Clipboard access can fail on some mobile browsers; SMS sending is the main action.
            }
            await loadTrialData();
            showFeedback("success", `${lead.childName} 보호자에게 수강신청/입학 안내를 보냈습니다.`);
        } catch {
            showFeedback("error", "안내 문자 발송 중 문제가 생겼습니다. 잠시 후 다시 시도해주세요.");
        } finally {
            setBusy(false);
        }
    }

    function renderEnrollGuideButton(lead: TrialLead) {
        if (lead.status !== "ATTENDED" || lead.enrollApplicationReceivedAt) return null;
        return (
            <button
                type="button"
                onClick={() => void handleSendEnrollGuide(lead)}
                disabled={busy}
                className={LIST_ACTION_PRIMARY_CLASS}
            >
                <span className="material-symbols-outlined text-base">send</span>
                {lead.enrollGuideSentAt ? "안내 재발송" : "수강신청 안내"}
            </button>
        );
    }

    async function handleSendCoachNotice(lead: TrialLead) {
        if (busy) return;
        if (!confirm(`"${lead.childName}" 체험수업 정보를 담당 선생님에게 문자로 공유할까요?`)) return;

        setBusy(true);
        try {
            const result = await sendTrialCoachNotice(lead.id);
            await loadTrialData();
            showFeedback("success", `담당 선생님에게 체험수업 알림을 보냈습니다. 수신: ${result.sentTo.join(", ")}`);
        } catch {
            showFeedback("error", "담당 선생님 알림 발송 중 문제가 생겼습니다. 잠시 후 다시 시도해주세요.");
        } finally {
            setBusy(false);
        }
    }

    async function handleResendApplicationSms(lead: TrialLead) {
        if (busy) return;
        if (!confirm(`"${lead.childName}" 체험 신청 문자 중 실패한 문자만 다시 보낼까요?`)) return;

        setBusy(true);
        try {
            const result = await resendTrialApplicationSms(lead.id);
            await loadTrialData();
            showFeedback("success", result.message);
        } catch {
            showFeedback("error", "문자 재발송 중 문제가 생겼습니다. 연락처와 문자 설정을 확인해주세요.");
        } finally {
            setBusy(false);
        }
    }

    function renderCoachNoticeCell(lead: TrialLead, isClosed: boolean) {
        const sentLabel = lead.coachNoticeSentAt ? `완료 ${formatDate(lead.coachNoticeSentAt)}` : null;
        const buttonLabel = lead.coachNoticeSentAt ? "재발송" : "발송";
        const buttonIcon = lead.coachNoticeSentAt ? "refresh" : "send";

        if (isClosed && !lead.coachNoticeSentAt) {
            return (
                <span className="inline-flex max-w-full items-center rounded-full bg-gray-100 px-2 py-1 text-xs font-bold text-gray-500 dark:bg-gray-900 dark:text-gray-400">
                    대상 아님
                </span>
            );
        }

        return (
            <div className="flex min-w-0 items-center gap-2" onClick={(event) => event.stopPropagation()}>
                {sentLabel ? (
                    <span className="min-w-0 truncate rounded-full bg-emerald-50 px-2 py-1 text-xs font-black text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200" title={sentLabel}>
                        {sentLabel}
                    </span>
                ) : (
                    <span className="min-w-0 truncate rounded-full bg-amber-50 px-2 py-1 text-xs font-black text-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
                        미발송
                    </span>
                )}
                <button
                    type="button"
                    onClick={() => void handleSendCoachNotice(lead)}
                    disabled={busy}
                    className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2 text-xs font-black text-blue-700 transition hover:border-blue-300 hover:bg-blue-100 disabled:opacity-50 dark:border-brand-neon-lime/40 dark:bg-brand-neon-lime/10 dark:text-brand-neon-lime"
                >
                    <span className="material-symbols-outlined text-sm">{buttonIcon}</span>
                    {buttonLabel}
                </button>
            </div>
        );
    }

    // 날짜 포맷 헬퍼
    function formatDate(dateStr: string | null) {
        if (!dateStr) return "-";
        const d = new Date(dateStr);
        return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
    }

    function renderTrialList() {
        return (
            <div className="overflow-x-auto overflow-y-visible rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
                <table className="w-full min-w-[1080px] table-fixed border-collapse text-left text-sm">
                    <colgroup>
                        <col className="w-[11%]" />
                        <col className="w-[30%]" />
                        <col className="w-[11%]" />
                        <col className="w-[11%]" />
                        <col className="w-[16%]" />
                        <col className="w-[13%]" />
                        <col className="w-[8%]" />
                    </colgroup>
                    <thead className="sticky top-0 z-10 bg-gray-50 text-xs font-black uppercase text-gray-500 dark:bg-gray-900 dark:text-gray-400">
                        <tr className="divide-x divide-gray-200 dark:divide-gray-700">
                            <th className="px-3 py-2">상태</th>
                            <th className="px-3 py-2">학생/연락처</th>
                            <th className="px-3 py-2">신청일</th>
                            <th className="px-3 py-2">체험일</th>
                            <th className="px-3 py-2">수업교시</th>
                            <th className="px-3 py-2">쌤알림</th>
                            <th className="px-3 py-2 text-right">액션</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {visibleLeads.map((lead) => {
                            const cfg = STATUS_CONFIG[lead.status] || STATUS_CONFIG.NEW;
                            const isClosed = isClosedTrialStatus(lead.status);
                            const scheduleItems = getTrialScheduleItems(lead, classesBySlotKey, classesById);
                            const getScheduleValue = (label: string) => scheduleItems.find((item) => item.label === label)?.value || "-";
                            const parentPhoneHref = phoneHref(lead.parentPhone);
                            const childMeta = [lead.childAge, lead.childGrade, lead.childSchool].filter(Boolean).join(" · ");
                            const studentSummary = [lead.childName, childMeta, lead.parentName || "보호자 미입력", lead.parentPhone].filter(Boolean).join(" · ");
                            const createdDateLabel = getScheduleValue("신청일");
                            const trialDateLabel = getScheduleValue("체험일");
                            const scheduleLabel = getScheduleValue("수업교시");
                            const isActionOpen = openQuickActionId === lead.id;
                            return (
                                <tr
                                    key={`${lead.id}-list`}
                                    tabIndex={0}
                                    onClick={() => {
                                        setOpenQuickActionId(null);
                                        setShowDetailModal(lead);
                                    }}
                                    onKeyDown={(event) => {
                                        if (event.key === "Enter" || event.key === " ") {
                                            event.preventDefault();
                                            setOpenQuickActionId(null);
                                            setShowDetailModal(lead);
                                        }
                                    }}
                                    className="cursor-pointer divide-x divide-gray-100 transition hover:bg-gray-50/80 focus:bg-brand-orange-50 focus:outline-none dark:divide-gray-700 dark:hover:bg-gray-900/50 dark:focus:bg-brand-neon-lime/10"
                                >
                                    <td className="px-3 py-1.5 align-middle">
                                        <span className={`inline-flex max-w-full items-center gap-1 whitespace-nowrap rounded-full px-2 py-1 text-xs font-bold ${cfg.color}`} title={cfg.label}>
                                            <span className="material-symbols-outlined text-sm">{cfg.icon}</span>
                                            <span className="truncate">{cfg.label}</span>
                                        </span>
                                    </td>
                                    <td className="px-3 py-1.5 align-middle">
                                        <span className="block truncate font-black text-gray-900 dark:text-white" title={studentSummary}>
                                            {studentSummary}
                                        </span>
                                    </td>
                                    <td className="px-3 py-1.5 align-middle">
                                        <span className="block truncate font-bold text-gray-800 dark:text-gray-100" title={createdDateLabel}>
                                            {createdDateLabel}
                                        </span>
                                    </td>
                                    <td className="px-3 py-1.5 align-middle">
                                        <span className="block truncate font-bold text-gray-800 dark:text-gray-100" title={trialDateLabel}>
                                            {trialDateLabel}
                                        </span>
                                    </td>
                                    <td className="px-3 py-1.5 align-middle">
                                        <span className="block truncate font-bold text-gray-800 dark:text-gray-100" title={scheduleLabel}>
                                            {scheduleLabel}
                                        </span>
                                    </td>
                                    <td className="px-3 py-1.5 align-middle">
                                        {renderCoachNoticeCell(lead, isClosed)}
                                    </td>
                                    <td className="relative px-3 py-1.5 text-right align-middle" onClick={(event) => event.stopPropagation()}>
                                        <button
                                            type="button"
                                            onClick={() => setOpenQuickActionId((current) => (current === lead.id ? null : lead.id))}
                                            className={LIST_ACTION_TRIGGER_CLASS}
                                            aria-expanded={isActionOpen}
                                            aria-label={`${lead.childName} 빠른 처리 열기`}
                                        >
                                            <span className="material-symbols-outlined text-lg">more_horiz</span>
                                        </button>
                                        {isActionOpen && (
                                            <div className={LIST_ACTION_MENU_CLASS}>
                                                <a href={parentPhoneHref} className={LIST_ACTION_ITEM_CLASS}>
                                                    <span className="material-symbols-outlined text-base">call</span>
                                                    전화
                                                </a>
                                                {!isClosed && (
                                                    <button type="button" onClick={() => setShowScheduleModal(lead)} className={LIST_ACTION_ITEM_CLASS}>
                                                        <span className="material-symbols-outlined text-base">event_available</span>
                                                        일정
                                                    </button>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() => handleRecordContact(lead, "CONTACTED")}
                                                    disabled={contactBusyId === lead.id}
                                                    className={`${LIST_ACTION_ITEM_CLASS} disabled:opacity-50`}
                                                >
                                                    <span className="material-symbols-outlined text-base">done_all</span>
                                                    연락 완료
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setContactModal({ lead, defaultAction: "MEMO" })}
                                                    className={LIST_ACTION_ITEM_CLASS}
                                                >
                                                    <span className="material-symbols-outlined text-base">edit_note</span>
                                                    메모
                                                </button>
                                                {!isClosed && (
                                                    <select
                                                        value={lead.status}
                                                        onChange={(event) => handleStatusChange(lead, event.target.value)}
                                                        disabled={busy}
                                                        className="mt-1 min-h-9 w-full rounded-lg border border-gray-200 bg-white px-2 text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-orange-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:focus:ring-brand-neon-lime"
                                                    >
                                                        {STATUS_ORDER.filter((s) => !isClosedTrialStatus(s)).map((s) => (
                                                            <option key={s} value={s}>
                                                                {STATUS_CONFIG[s].label}
                                                            </option>
                                                        ))}
                                                    </select>
                                                )}
                                                {renderEnrollGuideButton(lead)}
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        );
    }

    if (loading && leads.length === 0) {
        return <TrialCrmLoadingFallback />;
    }

    if (loadError && leads.length === 0) {
        return <TrialCrmErrorState onRetry={loadTrialData} />;
    }

    return (
        <div className="space-y-6">
            {/* 페이지 제목 */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <span className="material-symbols-outlined text-3xl text-brand-orange-500 dark:text-brand-neon-lime">handshake</span>
                        체험 문의 관리
                        {/* 새 신청 건수 배지 — NEW 상태가 있을 때만 표시 */}
                        {stats.NEW > 0 && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-500 text-white animate-pulse">
                                새 신청 {stats.NEW}건
                            </span>
                        )}
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">체험 신청, 연락, 수업 일정, 정규 등록까지 한 번에 확인합니다</p>
                </div>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-brand-orange-500 dark:bg-brand-neon-lime dark:text-brand-navy-900 text-white rounded-lg hover:bg-brand-orange-600 dark:hover:bg-lime-400 transition-colors font-medium"
                >
                    <span className="material-symbols-outlined text-xl">person_add</span>
                    체험 신청 등록
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

            {/* ── 한 줄 파이프라인 필터 ── */}
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                <button
                    onClick={() => setFilter("ALL")}
                    className={`inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 text-sm font-bold transition-colors ${
                        filter === "ALL"
                            ? "bg-gray-900 text-white dark:bg-brand-neon-lime dark:text-brand-navy-900"
                            : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200"
                    }`}
                >
                    전체 ({stats.total})
                </button>
                {STATUS_ORDER.map((s) => {
                    const cfg = STATUS_CONFIG[s];
                    const count = stats[s as keyof TrialStats] as number;
                    return (
                        <button
                            key={s}
                            onClick={() => setFilter(filter === s ? "ALL" : s)}
                            className={`inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 text-sm font-bold transition-colors ${
                                filter === s
                                    ? "bg-gray-900 text-white dark:bg-brand-neon-lime dark:text-brand-navy-900"
                                    : `${cfg.color} hover:opacity-80`
                            }`}
                        >
                            <span className="material-symbols-outlined text-sm">{cfg.icon}</span>
                            {cfg.label} ({count})
                        </button>
                    );
                })}
                <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-emerald-50 px-3 text-sm font-black text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200">
                    <span className="material-symbols-outlined text-sm">trending_up</span>
                    전환율 {stats.conversionRate}%
                </span>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                    <label className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-600 focus-within:border-brand-orange-400 focus-within:bg-white dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:focus-within:border-brand-neon-lime">
                        <span className="material-symbols-outlined text-lg text-gray-400">search</span>
                        <input
                            type="search"
                            value={searchQuery}
                            onChange={(event) => setSearchQuery(event.target.value)}
                            placeholder="학생, 보호자, 전화번호, 학교, 메모로 검색"
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
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                    {TRIAL_WORK_FILTERS.map((item) => (
                        <button
                            key={item.value}
                            type="button"
                            onClick={() => setWorkFilter(item.value)}
                            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition ${
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

            {/* ── 리드 목록 ── */}
            {filteredLeads.length === 0 ? (
                <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                    <span className="material-symbols-outlined text-5xl text-gray-300">person_search</span>
                    <p className="text-gray-500 dark:text-gray-400 mt-3">
                        {searchQuery || workFilter !== "ALL"
                            ? "조건에 맞는 체험 문의가 없습니다"
                            : filter === "ALL"
                            ? "등록된 체험 신청이 없습니다"
                            : `"${STATUS_CONFIG[filter]?.label}" 상태의 신청이 없습니다`}
                    </p>
                    {hasMoreServerLeads && (
                        <button
                            type="button"
                            onClick={handleShowMoreLeads}
                            disabled={loadingMore}
                            className="mt-4 rounded-lg border border-gray-200 px-4 py-2 text-sm font-bold text-gray-700 transition hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-900"
                        >
                            {loadingMore ? "불러오는 중..." : "다음 50건에서 더 찾아보기"}
                        </button>
                    )}
                </div>
            ) : (
                <div className="grid gap-4">
                    {renderTrialList()}
                    <div className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-white px-4 py-3 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 sm:flex-row sm:items-center sm:justify-between">
                        <span>
                            {filteredLeads.length}건 중 {visibleLeads.length}건 표시
                        </span>
                        {hasMoreLeads && (
                            <button
                                type="button"
                                onClick={handleShowMoreLeads}
                                disabled={loadingMore}
                                className="rounded-lg border border-gray-200 px-4 py-2 font-bold text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-900"
                            >
                                {loadingMore ? "불러오는 중..." : "50건 더 보기"}
                            </button>
                        )}
                    </div>
                </div>
            )}

            {hasTrialModal && (
                <TrialCrmModals
                    addOpen={showAddModal}
                    editLead={showEditModal}
                    scheduleLead={showScheduleModal}
                    cancelLead={showCancelModal}
                    convertLead={showConvertModal}
                    lostLead={showLostModal}
                    memoLead={showMemoModal}
                    onCloseAdd={() => setShowAddModal(false)}
                    onCloseEdit={() => setShowEditModal(null)}
                    onCloseSchedule={() => setShowScheduleModal(null)}
                    onCloseCancel={() => setShowCancelModal(null)}
                    onCloseConvert={() => setShowConvertModal(null)}
                    onCloseLost={() => setShowLostModal(null)}
                    onCloseMemo={() => setShowMemoModal(null)}
                    classes={classes}
                    onSaved={loadTrialData}
                    onFeedback={showFeedback}
                />
            )}

            {showDetailModal && (
                <TrialLeadDetailModal
                    lead={showDetailModal}
                    scheduleItems={getTrialScheduleItems(showDetailModal, classesBySlotKey, classesById)}
                    onClose={() => setShowDetailModal(null)}
                    onEdit={() => {
                        setShowEditModal(showDetailModal);
                        setShowDetailModal(null);
                    }}
                    onSchedule={() => {
                        setShowScheduleModal(showDetailModal);
                        setShowDetailModal(null);
                    }}
                    onMemo={() => {
                        setShowMemoModal(showDetailModal);
                        setShowDetailModal(null);
                    }}
                    onCoachNotice={() => void handleSendCoachNotice(showDetailModal)}
                    onResendSms={() => void handleResendApplicationSms(showDetailModal)}
                />
            )}

            {contactModal && (
                <TrialContactModal
                    lead={contactModal.lead}
                    defaultAction={contactModal.defaultAction}
                    busy={contactBusyId === contactModal.lead.id}
                    onClose={() => setContactModal(null)}
                    onSubmit={async ({ action, note, nextFollowUpAt }) => {
                        await handleRecordContact(contactModal.lead, action, note, nextFollowUpAt);
                        setContactModal(null);
                    }}
                />
            )}
        </div>
    );
}

function TrialLeadDetailModal({
    lead,
    scheduleItems,
    onClose,
    onEdit,
    onSchedule,
    onMemo,
    onCoachNotice,
    onResendSms,
}: {
    lead: TrialLead;
    scheduleItems: Array<{ label: string; icon: string; value: string; className: string }>;
    onClose: () => void;
    onEdit: () => void;
    onSchedule: () => void;
    onMemo: () => void;
    onCoachNotice: () => void;
    onResendSms: () => void;
}) {
    const cfg = STATUS_CONFIG[lead.status] || STATUS_CONFIG.NEW;
    const details = [
        ["학생", [lead.childName, lead.childAge, lead.childGrade, lead.childSchool].filter(Boolean).join(" · ")],
        ["보호자", [lead.parentName || "미입력", lead.parentPhone].filter(Boolean).join(" · ")],
        ["유입경로", SOURCE_LABELS[lead.source] || lead.source],
        ["농구 경험", lead.basketballExp || "미입력"],
        ["체험비", lead.trialFeeConfirmed ? "입금 확인" : "미확인"],
        ["최근 연락", lead.latestContactAction ? `${CONTACT_ACTION_LABELS[lead.latestContactAction] ?? lead.latestContactAction}${lead.latestContactAt ? ` · ${formatContactDateTime(lead.latestContactAt)}` : ""}` : "기록 없음"],
    ];

    return (
        <AdminModal onClose={onClose} titleId="trial-detail-modal-title" panelClassName="max-w-2xl">
            <div className="w-full p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <div className="flex flex-wrap items-center gap-2">
                            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-black ${cfg.color}`}>
                                <span className="material-symbols-outlined text-sm">{cfg.icon}</span>
                                {cfg.label}
                            </span>
                            <span className="text-xs font-bold text-gray-500 dark:text-gray-400">접수 {formatCompactDateTime(lead.createdAt)}</span>
                        </div>
                        <h2 id="trial-detail-modal-title" className="mt-2 text-xl font-black text-gray-900 dark:text-white">
                            {lead.childName} 체험 신청 상세
                        </h2>
                        <p className="mt-1 text-sm font-bold text-gray-500 dark:text-gray-400">
                            행 목록에서는 핵심만 보고, 상세 정보는 여기서 확인합니다.
                        </p>
                    </div>
                    <a
                        href={phoneHref(lead.parentPhone)}
                        className={DETAIL_ACTION_CLASS}
                    >
                        <span className="material-symbols-outlined text-base">call</span>
                        전화
                    </a>
                </div>

                <div className="mt-5 grid gap-2 sm:grid-cols-2">
                    {scheduleItems.map((item) => (
                        <div key={`trial-detail-${item.label}`} className={`rounded-lg border px-3 py-2 ${item.className}`}>
                            <p className="flex items-center gap-1 text-[11px] font-black uppercase opacity-80">
                                <span className="material-symbols-outlined text-sm">{item.icon}</span>
                                {item.label}
                            </p>
                            <p className="mt-1 break-keep text-sm font-black">{item.value}</p>
                        </div>
                    ))}
                </div>

                <dl className="mt-5 grid gap-2 sm:grid-cols-2">
                    {details.map(([label, value]) => (
                        <div key={`trial-detail-row-${label}`} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-900">
                            <dt className="text-[11px] font-black text-gray-500 dark:text-gray-400">{label}</dt>
                            <dd className="mt-0.5 break-keep text-sm font-bold text-gray-900 dark:text-white">{value || "미입력"}</dd>
                        </div>
                    ))}
                </dl>

                {(lead.hopeNote || lead.memo || lead.openFollowUpNote) && (
                    <div className="mt-5 space-y-2">
                        {lead.hopeNote && (
                            <p className="rounded-lg bg-lime-50 px-3 py-2 text-sm font-bold text-lime-800 dark:bg-lime-950/30 dark:text-lime-200">
                                희망 메모: {lead.hopeNote}
                            </p>
                        )}
                        {lead.memo && (
                            <p className="rounded-lg bg-gray-50 px-3 py-2 text-sm font-bold text-gray-700 dark:bg-gray-900 dark:text-gray-200">
                                관리 메모: {lead.memo}
                            </p>
                        )}
                        {lead.openFollowUpNote && (
                            <p className="rounded-lg bg-blue-50 px-3 py-2 text-sm font-bold text-blue-800 dark:bg-blue-950/30 dark:text-blue-200">
                                재연락 메모: {lead.openFollowUpNote}
                            </p>
                        )}
                    </div>
                )}

                <div className="mt-6 flex flex-wrap justify-end gap-2">
                    <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-bold text-gray-500 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-900">
                        닫기
                    </button>
                    <button type="button" onClick={onMemo} className={DETAIL_ACTION_CLASS}>
                        <span className="material-symbols-outlined text-base">edit_note</span>
                        메모
                    </button>
                    {!lead.coachNoticeSentAt && (
                        <button type="button" onClick={onCoachNotice} className={DETAIL_ACTION_CLASS}>
                            <span className="material-symbols-outlined text-base">school</span>
                            쌤 알림
                        </button>
                    )}
                    {lead.smsDeliveryFailed > 0 && (
                        <button type="button" onClick={onResendSms} className={DETAIL_ACTION_CLASS}>
                            <span className="material-symbols-outlined text-base">sms_failed</span>
                            문자 재발송
                        </button>
                    )}
                    <button type="button" onClick={onSchedule} className={DETAIL_ACTION_CLASS}>
                        <span className="material-symbols-outlined text-base">event_available</span>
                        일정
                    </button>
                    <button type="button" onClick={onEdit} className="inline-flex min-h-8 items-center gap-1.5 rounded-md bg-brand-orange-500 px-3 text-xs font-black text-white transition hover:bg-brand-orange-600 dark:bg-brand-neon-lime dark:text-brand-navy-900 dark:hover:bg-lime-400">
                        <span className="material-symbols-outlined text-base">edit</span>
                        수정
                    </button>
                </div>
            </div>
        </AdminModal>
    );
}

function TrialContactModal({
    lead,
    defaultAction,
    busy,
    onClose,
    onSubmit,
}: {
    lead: TrialLead;
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
        <AdminModal onClose={onClose} titleId="trial-contact-modal-title" panelClassName="max-w-md" closeOnBackdrop={!busy}>
            <form
                onSubmit={handleSubmit}
                className="w-full p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
            >
                <h2 id="trial-contact-modal-title" className="flex items-center gap-2 text-lg font-black text-gray-900 dark:text-white">
                    <span className="material-symbols-outlined text-brand-orange-500 dark:text-brand-neon-lime">phone_callback</span>
                    후속 연락 기록
                </h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {lead.childName} · {lead.parentName} {lead.parentPhone}
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
