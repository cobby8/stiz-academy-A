"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { updateEnrollmentStatus, updateStudentMemo } from "@/app/actions/admin";

type MediaItem = { url: string; type: "image" | "video" };

const DAY_LABELS: Record<string, string> = {
    Mon: "월", Tue: "화", Wed: "수", Thu: "목", Fri: "금", Sat: "토", Sun: "일",
};
const ATT_STATUS: Record<string, { label: string; color: string }> = {
    PRESENT: { label: "출석", color: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-300/10 dark:text-emerald-100 dark:ring-emerald-300/20" },
    ABSENT: { label: "결석", color: "bg-red-50 text-red-700 ring-1 ring-red-200 dark:bg-red-300/10 dark:text-red-100 dark:ring-red-300/20" },
    LATE: { label: "지각", color: "bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-300/10 dark:text-amber-100 dark:ring-amber-300/20" },
    EXCUSED: { label: "사유결석", color: "bg-sky-50 text-sky-700 ring-1 ring-sky-200 dark:bg-sky-300/10 dark:text-sky-100 dark:ring-sky-300/20" },
};
const PAY_STATUS: Record<string, { label: string; color: string }> = {
    PENDING: { label: "미납", color: "bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-300/10 dark:text-amber-100 dark:ring-amber-300/20" },
    PAID: { label: "납부완료", color: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-300/10 dark:text-emerald-100 dark:ring-emerald-300/20" },
    OVERDUE: { label: "연체", color: "bg-red-50 text-red-700 ring-1 ring-red-200 dark:bg-red-300/10 dark:text-red-100 dark:ring-red-300/20" },
    CANCELED: { label: "취소/이월", color: "bg-gray-50 text-gray-600 ring-1 ring-gray-200 dark:bg-gray-900 dark:text-gray-300 dark:ring-gray-700" },
};
const INVOICE_STATUS: Record<string, { label: string; color: string }> = {
    ISSUED: { label: "발행", color: "bg-sky-50 text-sky-700 ring-1 ring-sky-200 dark:bg-sky-300/10 dark:text-sky-100 dark:ring-sky-300/20" },
    SENT: { label: "발송", color: "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200 dark:bg-indigo-300/10 dark:text-indigo-100 dark:ring-indigo-300/20" },
    OVERDUE: { label: "연체", color: "bg-red-50 text-red-700 ring-1 ring-red-200 dark:bg-red-300/10 dark:text-red-100 dark:ring-red-300/20" },
    PAID: { label: "납부", color: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-300/10 dark:text-emerald-100 dark:ring-emerald-300/20" },
    CANCELED: { label: "취소", color: "bg-gray-50 text-gray-600 ring-1 ring-gray-200 dark:bg-gray-900 dark:text-gray-300 dark:ring-gray-700" },
};
const ENROLLMENT_STATUS: Record<string, { label: string; color: string }> = {
    ACTIVE: { label: "수강 중", color: "bg-lime-100 text-lime-800 ring-1 ring-lime-200 dark:bg-lime-300/15 dark:text-lime-100 dark:ring-lime-300/25" },
    PAUSED: { label: "휴원", color: "bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-300/10 dark:text-amber-100 dark:ring-amber-300/20" },
    WITHDRAWN: { label: "퇴원", color: "bg-red-50 text-red-700 ring-1 ring-red-200 dark:bg-red-300/10 dark:text-red-100 dark:ring-red-300/20" },
    NONE: { label: "미배정", color: "bg-gray-50 text-gray-600 ring-1 ring-gray-200 dark:bg-gray-900 dark:text-gray-300 dark:ring-gray-700" },
};
const ENROLLMENT_STATUS_OPTIONS = [
    { value: "ACTIVE", label: "수강 중" },
    { value: "PAUSED", label: "휴원" },
    { value: "WITHDRAWN", label: "퇴원" },
] as const;

function toDateStr(d: Date | string | null): string {
    if (!d) return "-";
    const date = typeof d === "string" ? new Date(d) : d;
    return date.toISOString().split("T")[0];
}
function calcAge(birthDate: Date | string): number {
    const birth = typeof birthDate === "string" ? new Date(birthDate) : birthDate;
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
}
function formatKRW(n: number): string {
    return n.toLocaleString("ko-KR") + "원";
}

function getErrorMessage(error: unknown, fallback: string) {
    return error instanceof Error ? error.message : fallback;
}

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

type StudentActivityData = {
    student: {
        id: string; name: string; birthDate: Date | string; gender: string | null;
        memo: string | null; parentId: string; createdAt: Date | string;
        // 새 필드: 학생 추가 정보
        phone: string | null; school: string | null; grade: string | null;
        address: string | null; enrollDate: Date | string | null;
        parent: { name: string | null; phone: string | null; email: string | null };
    };
    enrollments: {
        id: string; classId: string; status: string; createdAt: Date | string;
        className: string; dayOfWeek: string; startTime: string; endTime: string; programName: string;
    }[];
    attendances: { id: string; status: string; date: Date | string; className: string }[];
    payments: {
        id: string;
        amount: number;
        status: string;
        dueDate: Date | string;
        paidDate: Date | string | null;
        type?: string | null;
        description?: string | null;
        method?: string | null;
        invoiceId?: string | null;
        invoiceNo?: string | null;
        invoiceStatus?: string | null;
        invoiceSentAt?: Date | string | null;
        invoiceCheckoutUrl?: string | null;
        issuedAt?: Date | string | null;
        payableUntil?: Date | string | null;
        receiptUrl?: string | null;
    }[];
    attendanceStats: { total: number; present: number; absent: number; late: number; excused: number; rate: number };
    galleryPosts: { id: string; title: string | null; mediaJSON: string; createdAt: Date | string }[];
    monthlyHistory: {
        id: string;
        registrationMonth: string | null;
        year: number | null;
        month: number | null;
        status: string;
        rowCount: number;
        classes: {
            slotKey: string;
            className: string;
            dayOfWeek: string | null;
            startTime: string | null;
            endTime: string | null;
            programName: string | null;
        }[];
        paymentAmount: number;
        tuitionAmount: number;
        shuttleFee: number;
        carryOverAmount: number;
        paymentMethods: string[];
        paymentDate: Date | string | null;
        shuttle: {
            needed: boolean;
            pickup: string | null;
            preferredTime: string | null;
            dropoff: string | null;
        };
        school: string | null;
        grade: string | null;
        changes: { summary: string | null; note: string | null; occurredAt: Date | string | null; createdAt: Date | string | null }[];
    }[];
};

function getEnrollmentStatusInfo(status: string | null) {
    return ENROLLMENT_STATUS[status ?? "NONE"] ?? ENROLLMENT_STATUS.NONE;
}

function getInvoiceStatusInfo(status: string | null | undefined) {
    return status ? INVOICE_STATUS[status] ?? INVOICE_STATUS.ISSUED : null;
}

function getRepresentativeEnrollmentStatus(enrollments: StudentActivityData["enrollments"]) {
    if (enrollments.length === 0) return null;
    if (enrollments.some((enrollment) => enrollment.status === "ACTIVE")) return "ACTIVE";

    return [...enrollments].sort((a, b) => {
        const bTime = new Date(b.createdAt).getTime();
        const aTime = new Date(a.createdAt).getTime();
        return bTime - aTime;
    })[0]?.status ?? null;
}

function sortEnrollments(enrollments: StudentActivityData["enrollments"]) {
    const statusOrder: Record<string, number> = { ACTIVE: 0, PAUSED: 1, WITHDRAWN: 2 };

    return [...enrollments].sort((a, b) => {
        const statusDiff = (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9);
        if (statusDiff !== 0) return statusDiff;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
}

function formatMonthLabel(history: StudentActivityData["monthlyHistory"][number]) {
    if (history.registrationMonth) return history.registrationMonth;
    if (history.year && history.month) return `${history.year}년 ${history.month}월`;
    if (history.month) return `${history.month}월`;
    return "월 정보 없음";
}

function formatClassLabel(classItem: StudentActivityData["monthlyHistory"][number]["classes"][number]) {
    const day = classItem.dayOfWeek ? DAY_LABELS[classItem.dayOfWeek] || classItem.dayOfWeek : "";
    const time = classItem.startTime ? `${classItem.startTime}${classItem.endTime ? `~${classItem.endTime}` : ""}` : "";
    const prefix = [day, time].filter(Boolean).join(" ");
    return prefix ? `${prefix} · ${classItem.className}` : classItem.className;
}

function getMonthlyPaymentInfo(history: StudentActivityData["monthlyHistory"][number]) {
    const hasUnpaidMethod = history.paymentMethods.some((method) => method.includes("미결제"));
    const hasTuitionGap = history.tuitionAmount > 0 && history.paymentAmount < history.tuitionAmount;

    if (hasUnpaidMethod || hasTuitionGap) {
        return {
            label: "미납 확인",
            className: "bg-red-50 text-red-700 ring-1 ring-red-200 dark:bg-red-300/10 dark:text-red-100 dark:ring-red-300/20",
        };
    }

    if (history.paymentAmount > 0) {
        return {
            label: "납부 완료",
            className: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-300/10 dark:text-emerald-100 dark:ring-emerald-300/20",
        };
    }

    return {
        label: "수납 정보 없음",
        className: "bg-gray-50 text-gray-600 ring-1 ring-gray-200 dark:bg-gray-900 dark:text-gray-300 dark:ring-gray-700",
    };
}

function getCurrentMonthHistory(monthlyHistory: StudentActivityData["monthlyHistory"]) {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    return monthlyHistory.find((history) => history.year === currentYear && history.month === currentMonth)
        ?? monthlyHistory[0]
        ?? null;
}

export default function StudentDetailClient({
    data: initialData,
    studentId,
}: {
    data?: StudentActivityData;
    studentId?: string;
}) {
    const [activityData, setActivityData] = useState<StudentActivityData | null>(initialData ?? null);
    const [loading, setLoading] = useState(!initialData);
    const [error, setError] = useState<string | null>(null);
    const [memo, setMemo] = useState(initialData?.student.memo || "");
    const [isPending, startTransition] = useTransition();
    const [memoSaved, setMemoSaved] = useState(false);
    const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);
    const [statusFeedback, setStatusFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

    const loadData = useCallback(async () => {
        if (!studentId) return;

        setLoading(true);
        setError(null);

        try {
            const response = await fetch(`/api/admin/students/${studentId}/activity`, {
                cache: "no-store",
            });

            if (!response.ok) {
                throw new Error("Failed to load student activity.");
            }

            const payload = (await response.json()) as { data?: StudentActivityData };
            if (!payload.data) {
                throw new Error("Student activity is empty.");
            }

            setActivityData(payload.data);
            setMemo(payload.data.student.memo || "");
        } catch (loadError) {
            console.error("Failed to load student activity:", loadError);
            setError("원생 상세 정보를 불러오지 못했습니다.");
        } finally {
            setLoading(false);
        }
    }, [studentId]);

    useEffect(() => {
        if (!initialData) void loadData();
    }, [initialData, loadData]);

    if (loading && !activityData) {
        return (
            <div className="mx-auto max-w-5xl space-y-6">
                <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-lg bg-gray-200 animate-pulse dark:bg-gray-700" />
                    <div>
                        <div className="h-8 w-40 rounded bg-gray-200 animate-pulse dark:bg-gray-700" />
                        <div className="mt-2 h-4 w-80 max-w-full rounded bg-gray-100 animate-pulse dark:bg-gray-800" />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                    {Array.from({ length: 4 }).map((_, index) => (
                        <div
                            key={index}
                            className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-800"
                        >
                            <div className="h-4 w-20 rounded bg-gray-100 animate-pulse dark:bg-gray-700" />
                            <div className="mt-3 h-8 w-24 rounded bg-gray-200 animate-pulse dark:bg-gray-700" />
                            <div className="mt-2 h-3 w-16 rounded bg-gray-100 animate-pulse dark:bg-gray-700" />
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                    <div className="space-y-4">
                        {Array.from({ length: 3 }).map((_, index) => (
                            <div
                                key={index}
                                className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-800"
                            >
                                <div className="h-5 w-32 rounded bg-gray-200 animate-pulse dark:bg-gray-700" />
                                <div className="mt-4 space-y-3">
                                    {Array.from({ length: 3 }).map((__, rowIndex) => (
                                        <div key={rowIndex} className="h-4 rounded bg-gray-100 animate-pulse dark:bg-gray-700" />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="space-y-4 lg:col-span-2">
                        {Array.from({ length: 2 }).map((_, sectionIndex) => (
                            <div
                                key={sectionIndex}
                                className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-800"
                            >
                                <div className="h-5 w-32 rounded bg-gray-200 animate-pulse dark:bg-gray-700" />
                                <div className="mt-4 space-y-3">
                                    {Array.from({ length: 6 }).map((__, rowIndex) => (
                                        <div key={rowIndex} className="grid grid-cols-3 gap-3">
                                            <div className="h-4 rounded bg-gray-100 animate-pulse dark:bg-gray-700" />
                                            <div className="h-4 rounded bg-gray-100 animate-pulse dark:bg-gray-700" />
                                            <div className="h-4 rounded bg-gray-100 animate-pulse dark:bg-gray-700" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    if (error && !activityData) {
        return (
            <div className="mx-auto max-w-5xl rounded-xl border border-red-200 bg-red-50 p-8 text-center dark:border-red-900/50 dark:bg-red-950/20">
                <p className="font-bold text-red-700 dark:text-red-200">{error}</p>
                <button
                    type="button"
                    onClick={() => void loadData()}
                    className="mt-4 rounded-lg bg-brand-orange-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-orange-600 dark:bg-brand-neon-lime dark:text-brand-navy-900"
                >
                    다시 불러오기
                </button>
                <div className="mt-4">
                    <Link href="/admin/students" prefetch={false} className="text-sm font-medium text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white">
                        원생 목록으로 돌아가기
                    </Link>
                </div>
            </div>
        );
    }

    if (!activityData) return null;

    const { student, enrollments, attendances, payments, attendanceStats, galleryPosts, monthlyHistory } = activityData;

    function saveMemo() {
        startTransition(async () => {
            await updateStudentMemo(student.id, memo);
            setMemoSaved(true);
            setTimeout(() => setMemoSaved(false), 2000);
        });
    }

    async function changeEnrollmentStatus(enrollmentId: string, currentStatus: string, nextStatus: string) {
        if (currentStatus === nextStatus || statusUpdatingId) return;

        const nextInfo = getEnrollmentStatusInfo(nextStatus);
        if (!window.confirm(`이 수강 반 상태를 '${nextInfo.label}'으로 변경할까요?`)) return;

        setStatusUpdatingId(enrollmentId);
        setStatusFeedback(null);

        try {
            await updateEnrollmentStatus(enrollmentId, nextStatus);
            await loadData();
            setStatusFeedback({ type: "success", message: "수강 상태를 변경했습니다." });
            window.setTimeout(() => setStatusFeedback(null), 2500);
        } catch (statusError) {
            setStatusFeedback({
                type: "error",
                message: getErrorMessage(statusError, "수강 상태 변경에 실패했습니다."),
            });
        } finally {
            setStatusUpdatingId(null);
        }
    }

    function renderEnrollmentCard(enrollment: StudentActivityData["enrollments"][number], muted = false) {
        const info = getEnrollmentStatusInfo(enrollment.status);
        const isUpdating = statusUpdatingId === enrollment.id;

        return (
            <div
                key={enrollment.id}
                className={muted
                    ? "rounded-xl border border-gray-100 p-3 dark:border-gray-700 dark:bg-gray-900/50"
                    : "rounded-xl bg-gray-50 p-3 dark:bg-gray-900"}
            >
                <div className="flex items-start justify-between gap-2">
                    <p className={muted ? "font-medium text-sm text-gray-800 dark:text-gray-100" : "font-bold text-sm text-gray-900 dark:text-white"}>
                        {enrollment.className}
                    </p>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${info.color}`}>
                        {info.label}
                    </span>
                </div>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {enrollment.programName} · {DAY_LABELS[enrollment.dayOfWeek] || enrollment.dayOfWeek} {enrollment.startTime}~{enrollment.endTime}
                </p>
                <div className="mt-3 grid grid-cols-3 gap-1 rounded-lg bg-white p-1 dark:bg-gray-950">
                    {ENROLLMENT_STATUS_OPTIONS.map((option) => {
                        const selected = enrollment.status === option.value;
                        return (
                            <button
                                key={option.value}
                                type="button"
                                onClick={() => void changeEnrollmentStatus(enrollment.id, enrollment.status, option.value)}
                                disabled={Boolean(statusUpdatingId)}
                                className={`rounded-md px-2 py-1.5 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                                    selected
                                        ? "bg-gray-900 text-white dark:bg-brand-neon-lime dark:text-brand-navy-900"
                                        : "text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white"
                                }`}
                            >
                                {isUpdating && selected ? "저장 중" : option.label}
                            </button>
                        );
                    })}
                </div>
            </div>
        );
    }

    const sortedEnrollments = sortEnrollments(enrollments);
    const activeEnrollments = sortedEnrollments.filter(e => e.status === "ACTIVE");
    const inactiveEnrollments = sortedEnrollments.filter(e => e.status !== "ACTIVE");
    const representativeStatus = getRepresentativeEnrollmentStatus(enrollments);
    const representativeStatusInfo = getEnrollmentStatusInfo(representativeStatus);
    const totalPaid = payments.filter(p => p.status === "PAID").reduce((s, p) => s + p.amount, 0);
    const unpaid = payments.filter(p => p.status === "PENDING" || p.status === "OVERDUE");
    const unpaidAmount = unpaid.reduce((sum, payment) => sum + payment.amount, 0);
    const currentMonthHistory = getCurrentMonthHistory(monthlyHistory);
    const currentMonthStatusInfo = getEnrollmentStatusInfo(currentMonthHistory?.status ?? representativeStatus);
    const currentMonthPaymentInfo = currentMonthHistory ? getMonthlyPaymentInfo(currentMonthHistory) : null;
    const nextUnpaidPayment = [...unpaid].sort(
        (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
    )[0] ?? null;
    const latestInvoicePayment = payments.find((payment) => payment.invoiceId) ?? null;
    const latestInvoiceInfo = getInvoiceStatusInfo(latestInvoicePayment?.invoiceStatus);

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link href="/admin/students" prefetch={false} className="p-2 hover:bg-gray-100 dark:bg-gray-800 rounded-lg transition">
                    <SymbolIcon name="arrow_back" size={20} className="text-gray-500 dark:text-gray-400" />
                </Link>
                <div>
                    <div className="flex flex-wrap items-center gap-2">
                        <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">
                            {student.name} <span className="text-gray-400 font-normal text-lg">학생</span>
                        </h1>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${representativeStatusInfo.color}`}>
                            {representativeStatusInfo.label}
                        </span>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        {calcAge(student.birthDate)}세 ({toDateStr(student.birthDate)})
                        {student.gender && ` · ${student.gender}`}
                        {/* 학교/학년 있으면 표시 */}
                        {student.school && ` · ${student.school}`}
                        {student.grade && ` ${student.grade}`}
                        {" · "}등록일 {toDateStr(student.createdAt)}
                    </p>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">출석률</p>
                    <p className="text-2xl font-extrabold text-gray-900 dark:text-white">{attendanceStats.rate}%</p>
                    <p className="text-xs text-gray-400">{attendanceStats.present}/{attendanceStats.total}회 출석</p>
                </div>
                <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">결석/지각</p>
                    <p className="text-2xl font-extrabold">
                        <span className={attendanceStats.absent > 0 ? "text-red-600 dark:text-red-300" : "text-gray-900 dark:text-white"}>{attendanceStats.absent}</span>
                        <span className="text-gray-300 mx-1">/</span>
                        <span className={attendanceStats.late > 0 ? "text-amber-600 dark:text-amber-200" : "text-gray-900 dark:text-white"}>{attendanceStats.late}</span>
                    </p>
                    <p className="text-xs text-gray-400">결석 / 지각</p>
                </div>
                <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">수강 중</p>
                    <p className="text-2xl font-extrabold text-gray-900 dark:text-white">{activeEnrollments.length}개</p>
                    <p className="text-xs text-gray-400">반</p>
                </div>
                <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">총 납부액</p>
                    <p className="text-2xl font-extrabold text-gray-900 dark:text-white">{formatKRW(totalPaid)}</p>
                    {unpaid.length > 0 && <p className="text-xs text-red-500 dark:text-red-300">미납 {unpaid.length}건</p>}
                </div>
            </div>

            <div className="rounded-2xl border border-lime-200/70 bg-white p-5 shadow-sm dark:border-lime-300/20 dark:bg-gray-800">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <h2 className="text-base font-extrabold text-gray-900 dark:text-white">운영 요약</h2>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            현재 상태, 최신 월 수강, 수납/청구서를 한 번에 확인합니다.
                        </p>
                    </div>
                    {currentMonthHistory && (
                        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-700 dark:bg-gray-900 dark:text-gray-200">
                            기준 {formatMonthLabel(currentMonthHistory)}
                        </span>
                    )}
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-900">
                        <p className="text-xs text-gray-500 dark:text-gray-400">현재 상태</p>
                        <span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${currentMonthStatusInfo.color}`}>
                            {currentMonthStatusInfo.label}
                        </span>
                        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                            수강 중 {activeEnrollments.length}개 · 이전/휴원 {inactiveEnrollments.length}개
                        </p>
                    </div>

                    <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-900">
                        <p className="text-xs text-gray-500 dark:text-gray-400">최신 월 수강</p>
                        <p className="mt-2 text-sm font-extrabold text-gray-900 dark:text-white">
                            {currentMonthHistory ? `${currentMonthHistory.classes.length}개 반` : "이력 없음"}
                        </p>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            {currentMonthHistory
                                ? `원장 ${currentMonthHistory.rowCount}줄 · ${currentMonthHistory.grade ?? "학년 미입력"}`
                                : "최신 이관 장부에 연결된 월별 이력이 없습니다."}
                        </p>
                    </div>

                    <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-900">
                        <p className="text-xs text-gray-500 dark:text-gray-400">수납 상태</p>
                        <span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${currentMonthPaymentInfo?.className ?? PAY_STATUS.PENDING.color}`}>
                            {currentMonthPaymentInfo?.label ?? (unpaid.length > 0 ? "미납 확인" : "수납 정보 없음")}
                        </span>
                        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                            {unpaid.length > 0
                                ? `미납 ${unpaid.length}건 · ${formatKRW(unpaidAmount)}`
                                : `총 납부 ${formatKRW(totalPaid)}`}
                        </p>
                    </div>

                    <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-900">
                        <p className="text-xs text-gray-500 dark:text-gray-400">청구서</p>
                        {latestInvoicePayment ? (
                            <>
                                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${latestInvoiceInfo?.color ?? INVOICE_STATUS.ISSUED.color}`}>
                                        {latestInvoiceInfo?.label ?? "발행"}
                                    </span>
                                    {latestInvoicePayment.invoiceNo && (
                                        <span className="text-xs font-bold text-gray-700 dark:text-gray-200">
                                            {latestInvoicePayment.invoiceNo}
                                        </span>
                                    )}
                                </div>
                                {latestInvoicePayment.invoiceCheckoutUrl && (
                                    <a
                                        href={latestInvoicePayment.invoiceCheckoutUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="mt-2 inline-flex text-xs font-bold text-blue-700 hover:text-blue-900 dark:text-lime-200 dark:hover:text-lime-100"
                                    >
                                        납부 링크 열기
                                    </a>
                                )}
                            </>
                        ) : (
                            <p className="mt-2 text-sm font-bold text-gray-500 dark:text-gray-300">청구서 없음</p>
                        )}
                        {nextUnpaidPayment && (
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                다음 기한 {toDateStr(nextUnpaidPayment.dueDate)}
                            </p>
                        )}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column: 학부모 정보 + 메모 */}
                <div className="space-y-4">
                    {/* 학부모 정보 */}
                    <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
                        <h3 className="font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                            <SymbolIcon name="person" size={16} className="text-gray-400" /> 학부모 정보
                        </h3>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-500 dark:text-gray-400">이름</span>
                                <span className="font-medium">{student.parent.name || "-"}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500 dark:text-gray-400">연락처</span>
                                <span className="font-medium">{student.parent.phone || "-"}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500 dark:text-gray-400">이메일</span>
                                <span className="font-medium text-xs">{student.parent.email || "-"}</span>
                            </div>
                        </div>
                    </div>

                    {/* 학생 추가 정보: 학교, 학년, 주소, 연락처, 입회일 */}
                    {(student.phone || student.school || student.grade || student.address || student.enrollDate) && (
                        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
                            <h3 className="font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                                <SymbolIcon name="menu_book" size={16} className="text-gray-400" /> 학생 추가 정보
                            </h3>
                            <div className="space-y-2 text-sm">
                                {student.phone && (
                                    <div className="flex justify-between">
                                        <span className="text-gray-500 dark:text-gray-400">연락처</span>
                                        <span className="font-medium">{student.phone}</span>
                                    </div>
                                )}
                                {student.school && (
                                    <div className="flex justify-between">
                                        <span className="text-gray-500 dark:text-gray-400">학교</span>
                                        <span className="font-medium">{student.school}</span>
                                    </div>
                                )}
                                {student.grade && (
                                    <div className="flex justify-between">
                                        <span className="text-gray-500 dark:text-gray-400">학년</span>
                                        <span className="font-medium">{student.grade}</span>
                                    </div>
                                )}
                                {student.address && (
                                    <div className="flex justify-between">
                                        <span className="text-gray-500 dark:text-gray-400">주소</span>
                                        <span className="font-medium text-xs">{student.address}</span>
                                    </div>
                                )}
                                {student.enrollDate && (
                                    <div className="flex justify-between">
                                        <span className="text-gray-500 dark:text-gray-400">입회일</span>
                                        <span className="font-medium">{toDateStr(student.enrollDate)}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* 메모 */}
                    <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
                        <h3 className="font-bold text-gray-900 dark:text-white mb-3">메모</h3>
                        <textarea
                            value={memo}
                            onChange={e => { setMemo(e.target.value); setMemoSaved(false); }}
                            rows={4}
                            placeholder="원생에 대한 메모를 입력하세요 (특이사항, 건강 이슈 등)"
                            className="w-full border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 resize-none rounded-xl focus:ring-2 focus:ring-brand-orange-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:placeholder:text-gray-500 dark:focus:ring-brand-neon-lime"
                        />
                        <div className="flex items-center justify-between mt-2">
                            {memoSaved && <span className="text-xs text-green-600 font-medium dark:text-lime-200">저장됨</span>}
                            {!memoSaved && <span />}
                            <button onClick={saveMemo} disabled={isPending}
                                className="flex items-center gap-1 text-sm bg-brand-orange-500 dark:bg-brand-neon-lime dark:text-brand-navy-900 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-orange-600 dark:hover:bg-lime-200 transition disabled:opacity-50">
                                <SymbolIcon name="save" size={14} /> {isPending ? "저장 중..." : "저장"}
                            </button>
                        </div>
                    </div>

                    {/* 수강 반 */}
                    <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
                        <h3 className="font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                            <SymbolIcon name="menu_book" size={16} className="text-gray-400" /> 수강 정보
                        </h3>
                        {statusFeedback && (
                            <p className={`mb-3 rounded-lg px-3 py-2 text-xs font-bold ${
                                statusFeedback.type === "success"
                                    ? "bg-lime-50 text-lime-700 dark:bg-lime-300/10 dark:text-lime-100"
                                    : "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-200"
                            }`}>
                                {statusFeedback.message}
                            </p>
                        )}
                        {activeEnrollments.length === 0 ? (
                            <p className="text-sm text-gray-400">수강 중인 반이 없습니다</p>
                        ) : (
                            <div className="space-y-2">
                                {activeEnrollments.map(e => renderEnrollmentCard(e))}
                            </div>
                        )}
                        {inactiveEnrollments.length > 0 && (
                            <div className="mt-4 border-t border-gray-100 pt-4 dark:border-gray-700">
                                <p className="mb-2 text-xs font-bold text-gray-500 dark:text-gray-400">이전/휴원 이력</p>
                                <div className="space-y-2">
                                    {inactiveEnrollments.map((e) => renderEnrollmentCard(e, true))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Column: 활동 이력 */}
                <div className="lg:col-span-2 space-y-4">
                    {/* 월별 운영 히스토리 */}
                    <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
                        <h3 className="font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                            <SymbolIcon name="history" size={16} className="text-gray-400" /> 월별 운영 히스토리
                            <span className="text-xs text-gray-400 font-normal ml-1">최신 시트 이관 기준</span>
                        </h3>
                        {monthlyHistory.length === 0 ? (
                            <p className="text-sm text-gray-400">월별 이관 이력이 없습니다</p>
                        ) : (
                            <div className="space-y-3">
                                {monthlyHistory.map((history) => {
                                    const statusInfo = getEnrollmentStatusInfo(history.status);
                                    const paymentInfo = getMonthlyPaymentInfo(history);
                                    const visibleClasses = history.classes.slice(0, 6);
                                    const hiddenClassCount = Math.max(0, history.classes.length - visibleClasses.length);

                                    return (
                                        <div
                                            key={history.id}
                                            className="rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/70"
                                        >
                                            <div className="flex flex-wrap items-start justify-between gap-2">
                                                <div>
                                                    <p className="font-extrabold text-gray-900 dark:text-white">
                                                        {formatMonthLabel(history)}
                                                    </p>
                                                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                                        {history.classes.length}개 반 · 원장 {history.rowCount}줄
                                                    </p>
                                                </div>
                                                <div className="flex flex-wrap gap-1.5">
                                                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${statusInfo.color}`}>
                                                        {statusInfo.label}
                                                    </span>
                                                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${paymentInfo.className}`}>
                                                        {paymentInfo.label}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="mt-3 flex flex-wrap gap-1.5">
                                                {visibleClasses.map((classItem) => (
                                                    <span
                                                        key={classItem.slotKey}
                                                        className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-gray-700 ring-1 ring-gray-200 dark:bg-gray-950 dark:text-gray-200 dark:ring-gray-700"
                                                    >
                                                        {formatClassLabel(classItem)}
                                                    </span>
                                                ))}
                                                {hiddenClassCount > 0 && (
                                                    <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-500 ring-1 ring-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700">
                                                        +{hiddenClassCount}
                                                    </span>
                                                )}
                                            </div>

                                            <div className="mt-3 grid gap-2 text-xs text-gray-600 dark:text-gray-300 sm:grid-cols-2">
                                                <div className="rounded-lg bg-white p-2.5 ring-1 ring-gray-100 dark:bg-gray-950 dark:ring-gray-800">
                                                    <p className="font-bold text-gray-900 dark:text-white">수납</p>
                                                    <p className="mt-1">
                                                        납부 {formatKRW(history.paymentAmount)} / 청구 {formatKRW(history.tuitionAmount)}
                                                    </p>
                                                    <p className="mt-0.5 text-gray-500 dark:text-gray-400">
                                                        {history.paymentMethods.length > 0 ? history.paymentMethods.join(" · ") : "결제수단 없음"}
                                                        {history.paymentDate ? ` · ${toDateStr(history.paymentDate)}` : ""}
                                                    </p>
                                                </div>
                                                <div className="rounded-lg bg-white p-2.5 ring-1 ring-gray-100 dark:bg-gray-950 dark:ring-gray-800">
                                                    <p className="font-bold text-gray-900 dark:text-white">셔틀</p>
                                                    {history.shuttle.needed ? (
                                                        <p className="mt-1">
                                                            {history.shuttle.pickup || "승차지 미입력"}
                                                            {history.shuttle.preferredTime ? ` · ${history.shuttle.preferredTime}` : ""}
                                                        </p>
                                                    ) : (
                                                        <p className="mt-1 text-gray-500 dark:text-gray-400">이용 안 함</p>
                                                    )}
                                                </div>
                                            </div>

                                            {history.changes.length > 0 && (
                                                <div className="mt-3 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-800 ring-1 ring-amber-200 dark:bg-amber-300/10 dark:text-amber-100 dark:ring-amber-300/20">
                                                    <p className="font-bold">변동 기록</p>
                                                    <ul className="mt-1 space-y-1">
                                                        {history.changes.slice(0, 3).map((change, index) => (
                                                            <li key={`${history.id}-change-${index}`}>
                                                                {change.summary || change.note}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* 출결 기록 */}
                    <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
                        <h3 className="font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                            <SymbolIcon name="event_available" size={16} className="text-gray-400" /> 출결 기록
                            <span className="text-xs text-gray-400 font-normal ml-1">최근 50건</span>
                        </h3>
                        {attendances.length === 0 ? (
                            <p className="text-sm text-gray-400">출결 기록이 없습니다</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-gray-100 dark:border-gray-800">
                                            <th className="text-left py-2 px-3 text-xs text-gray-500 dark:text-gray-400 font-medium">날짜</th>
                                            <th className="text-left py-2 px-3 text-xs text-gray-500 dark:text-gray-400 font-medium">반</th>
                                            <th className="text-left py-2 px-3 text-xs text-gray-500 dark:text-gray-400 font-medium">상태</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {attendances.map(a => {
                                            const info = ATT_STATUS[a.status] || ATT_STATUS.PRESENT;
                                            return (
                                                <tr key={a.id} className="border-b border-gray-50 transition hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900/70">
                                                    <td className="py-2 px-3 text-gray-700 dark:text-gray-200">{toDateStr(a.date)}</td>
                                                    <td className="py-2 px-3 text-gray-600 dark:text-gray-300">{a.className}</td>
                                                    <td className="py-2 px-3">
                                                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${info.color}`}>{info.label}</span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* 수납 내역 */}
                    <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
                        <h3 className="font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                            <SymbolIcon name="credit_card" size={16} className="text-gray-400" /> 수납 내역
                        </h3>
                        {payments.length === 0 ? (
                            <p className="text-sm text-gray-400">수납 내역이 없습니다</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-gray-100 dark:border-gray-800">
                                            <th className="text-left py-2 px-3 text-xs text-gray-500 dark:text-gray-400 font-medium">납부기한</th>
                                            <th className="text-left py-2 px-3 text-xs text-gray-500 dark:text-gray-400 font-medium">금액</th>
                                            <th className="text-left py-2 px-3 text-xs text-gray-500 dark:text-gray-400 font-medium">상태</th>
                                            <th className="text-left py-2 px-3 text-xs text-gray-500 dark:text-gray-400 font-medium">청구서</th>
                                            <th className="text-left py-2 px-3 text-xs text-gray-500 dark:text-gray-400 font-medium">납부일</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {payments.map(p => {
                                            const info = PAY_STATUS[p.status] || PAY_STATUS.PENDING;
                                            const invoiceInfo = getInvoiceStatusInfo(p.invoiceStatus);
                                            return (
                                                <tr key={p.id} className="border-b border-gray-50 transition hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900/70">
                                                    <td className="py-2 px-3 text-gray-700 dark:text-gray-200">{toDateStr(p.dueDate)}</td>
                                                    <td className="py-2 px-3 font-medium text-gray-900 dark:text-white">{formatKRW(p.amount)}</td>
                                                    <td className="py-2 px-3">
                                                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${info.color}`}>{info.label}</span>
                                                    </td>
                                                    <td className="py-2 px-3">
                                                        {p.invoiceId ? (
                                                            <div className="space-y-1">
                                                                <div className="flex flex-wrap items-center gap-1.5">
                                                                    {invoiceInfo && (
                                                                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${invoiceInfo.color}`}>
                                                                            {invoiceInfo.label}
                                                                        </span>
                                                                    )}
                                                                    {p.invoiceNo && (
                                                                        <span className="text-xs font-bold text-gray-600 dark:text-gray-300">{p.invoiceNo}</span>
                                                                    )}
                                                                </div>
                                                                {p.invoiceCheckoutUrl && (
                                                                    <a
                                                                        href={p.invoiceCheckoutUrl}
                                                                        target="_blank"
                                                                        rel="noreferrer"
                                                                        className="text-xs font-bold text-blue-700 hover:text-blue-900 dark:text-lime-200 dark:hover:text-lime-100"
                                                                    >
                                                                        납부 링크
                                                                    </a>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <span className="text-xs text-gray-400">없음</span>
                                                        )}
                                                    </td>
                                                    <td className="py-2 px-3 text-gray-500 dark:text-gray-400">{toDateStr(p.paidDate)}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* 수업 사진 */}
                    {galleryPosts.length > 0 && (
                        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
                            <h3 className="font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                                <SymbolIcon name="image" size={16} className="text-gray-400" /> 수업 사진
                            </h3>
                            <div className="grid grid-cols-3 gap-2">
                                {galleryPosts.map(g => {
                                    let media: MediaItem[] = [];
                                    try { media = JSON.parse(g.mediaJSON); } catch {}
                                    const first = media[0];
                                    if (!first) return null;
                                    return (
                                        <div key={g.id} className="aspect-square rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800">
                                            {first.type === "image" ? (
                                                <img src={first.url} alt={g.title || ""} className="w-full h-full object-cover" />
                                            ) : (
                                                <video src={first.url} className="w-full h-full object-cover" muted />
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
