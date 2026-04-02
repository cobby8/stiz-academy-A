"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
    updateAcademySettings,
    approveEnrollApplication,
    rejectEnrollApplication,
} from "@/app/actions/admin";

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

interface ApplyAdminClientProps {
    initialApplications: EnrollApplication[];
    initialStats: EnrollStats;
    initialClasses: ClassInfo[];
    initialSettings: {
        trialTitle: string;
        trialContent: string | null;
        trialFormUrl: string | null;
        enrollTitle: string;
        enrollContent: string | null;
        enrollFormUrl: string | null;
        uniformFormUrl: string | null;
    };
}

// ── 상태별 설정 ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
    PENDING: { label: "대기중", color: "bg-yellow-100 text-yellow-800", icon: "hourglass_top" },
    APPROVED: { label: "승인완료", color: "bg-green-100 text-green-800", icon: "check_circle" },
    REJECTED: { label: "반려", color: "bg-red-100 text-red-800", icon: "cancel" },
    CANCELLED: { label: "취소", color: "bg-gray-100 text-gray-500", icon: "block" },
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

// 요일 한글 매핑
const DAY_LABELS: Record<string, string> = {
    Mon: "월", Tue: "화", Wed: "수", Thu: "목", Fri: "금", Sat: "토", Sun: "일",
};

const STATUS_ORDER = ["PENDING", "APPROVED", "REJECTED", "CANCELLED"] as const;

// ── 탭 상수 ──────────────────────────────────────────────────────────────────────

type TabType = "applications" | "settings";

// ── 메인 컴포넌트 ──────────────────────────────────────────────────────────────

export default function ApplyAdminClient({
    initialApplications,
    initialStats,
    initialClasses,
    initialSettings,
}: ApplyAdminClientProps) {
    const router = useRouter();
    const [applications] = useState(initialApplications);
    const [stats] = useState(initialStats);
    const [filter, setFilter] = useState<string>("ALL");
    const [busy, setBusy] = useState(false);
    const [activeTab, setActiveTab] = useState<TabType>("applications");

    // 모달 상태
    const [showApproveModal, setShowApproveModal] = useState<EnrollApplication | null>(null);
    const [showRejectModal, setShowRejectModal] = useState<EnrollApplication | null>(null);
    const [showDetailModal, setShowDetailModal] = useState<EnrollApplication | null>(null);

    // 필터링된 신청서 목록
    const filteredApps = useMemo(() => {
        if (filter === "ALL") return applications;
        return applications.filter((a) => a.status === filter);
    }, [applications, filter]);

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

    return (
        <div className="space-y-6">
            {/* 페이지 헤더 + 탭 전환 */}
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <span className="material-symbols-outlined text-3xl text-brand-orange-500">how_to_reg</span>
                        수강 신청 관리
                        {/* PENDING 건수 배지 */}
                        {stats.PENDING > 0 && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-500 text-white animate-pulse">
                                {stats.PENDING}건 대기
                            </span>
                        )}
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">수강 신청서를 확인하고 승인/반려 처리합니다</p>
                </div>
                <a
                    href="/apply"
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 text-sm text-brand-navy-900 border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 transition flex items-center gap-1.5"
                >
                    <span className="material-symbols-outlined text-base">open_in_new</span>
                    신청 페이지 미리보기
                </a>
            </div>

            {/* 탭 버튼 */}
            <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
                <button
                    onClick={() => setActiveTab("applications")}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition ${
                        activeTab === "applications"
                            ? "bg-white text-gray-900 shadow-sm"
                            : "text-gray-500 hover:text-gray-700"
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
                            ? "bg-white text-gray-900 shadow-sm"
                            : "text-gray-500 hover:text-gray-700"
                    }`}
                >
                    <span className="material-symbols-outlined text-lg">settings</span>
                    안내 설정
                </button>
            </div>

            {/* 탭 내용 */}
            {activeTab === "applications" ? (
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
                                            ? "border-brand-orange-500 shadow-md"
                                            : "border-transparent hover:border-gray-200"
                                    } bg-white`}
                                >
                                    <span className={`material-symbols-outlined text-2xl ${cfg.color.split(" ")[1]}`}>
                                        {cfg.icon}
                                    </span>
                                    <p className="text-2xl font-bold text-gray-900 mt-1">{count}</p>
                                    <p className="text-xs text-gray-500">{cfg.label}</p>
                                </button>
                            );
                        })}
                        {/* 전체 카드 */}
                        <button
                            onClick={() => setFilter("ALL")}
                            className={`rounded-xl p-4 text-center transition-all border-2 ${
                                filter === "ALL"
                                    ? "border-brand-orange-500 shadow-md"
                                    : "border-transparent hover:border-gray-200"
                            } bg-white`}
                        >
                            <span className="material-symbols-outlined text-2xl text-gray-600">summarize</span>
                            <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
                            <p className="text-xs text-gray-500">전체</p>
                        </button>
                    </div>

                    {/* 필터 탭 */}
                    <div className="flex gap-2 flex-wrap">
                        <button
                            onClick={() => setFilter("ALL")}
                            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                                filter === "ALL"
                                    ? "bg-gray-900 text-white"
                                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
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
                        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
                            <span className="material-symbols-outlined text-5xl text-gray-300">inbox</span>
                            <p className="text-gray-500 mt-3">
                                {filter === "ALL"
                                    ? "접수된 수강 신청이 없습니다"
                                    : `"${STATUS_CONFIG[filter]?.label}" 상태의 신청이 없습니다`}
                            </p>
                        </div>
                    ) : (
                        <div className="grid gap-4">
                            {filteredApps.map((app) => {
                                const cfg = STATUS_CONFIG[app.status] || STATUS_CONFIG.PENDING;
                                const age = calcAge(app.childBirthDate);
                                return (
                                    <div
                                        key={app.id}
                                        className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow"
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
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600">
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
                                                <h3 className="text-lg font-semibold text-gray-900">
                                                    {app.childName}
                                                    {age !== null && (
                                                        <span className="text-sm font-normal text-gray-500 ml-2">
                                                            (만 {age}세)
                                                        </span>
                                                    )}
                                                </h3>

                                                {/* 보호자 + 연락처 + 신청일 */}
                                                <div className="flex items-center gap-4 mt-1 text-sm text-gray-500 flex-wrap">
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
                                                    <p className="mt-2 text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
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
                                                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                                    title="상세 보기"
                                                >
                                                    <span className="material-symbols-outlined text-xl">visibility</span>
                                                </button>

                                                {/* 승인 버튼 — PENDING 상태에서만 */}
                                                {app.status === "PENDING" && (
                                                    <button
                                                        onClick={() => setShowApproveModal(app)}
                                                        disabled={busy}
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
                                                        disabled={busy}
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
                        </div>
                    )}
                </>
            ) : (
                /* 설정 탭 — 기존 안내 설정 UI */
                <SettingsTab initialSettings={initialSettings} />
            )}

            {/* 모달들 */}
            {showApproveModal && (
                <ApproveModal
                    app={showApproveModal}
                    classes={initialClasses}
                    onClose={() => setShowApproveModal(null)}
                    onSubmit={async (classIds, note) => {
                        setBusy(true);
                        try {
                            await approveEnrollApplication(showApproveModal.id, {
                                classIds,
                                processedNote: note,
                            });
                            setShowApproveModal(null);
                            router.refresh();
                        } catch (e) {
                            alert((e as Error).message);
                        } finally {
                            setBusy(false);
                        }
                    }}
                    busy={busy}
                />
            )}

            {showRejectModal && (
                <RejectModal
                    app={showRejectModal}
                    onClose={() => setShowRejectModal(null)}
                    onSubmit={async (reason) => {
                        setBusy(true);
                        try {
                            await rejectEnrollApplication(showRejectModal.id, reason);
                            setShowRejectModal(null);
                            router.refresh();
                        } catch (e) {
                            alert((e as Error).message);
                        } finally {
                            setBusy(false);
                        }
                    }}
                    busy={busy}
                />
            )}

            {showDetailModal && (
                <DetailModal
                    app={showDetailModal}
                    onClose={() => setShowDetailModal(null)}
                />
            )}
        </div>
    );
}

// ── 승인 모달 ──────────────────────────────────────────────────────────────────

function ApproveModal({
    app,
    classes,
    onClose,
    onSubmit,
    busy,
}: {
    app: EnrollApplication;
    classes: ClassInfo[];
    onClose: () => void;
    onSubmit: (classIds: string[], note: string) => void;
    busy: boolean;
}) {
    // 희망 슬롯키에 해당하는 반을 미리 선택
    const preferredKeys = app.preferredSlotKeys?.split(",").map(k => k.trim()) ?? [];
    const [selectedClassIds, setSelectedClassIds] = useState<string[]>(() => {
        // preferredSlotKeys와 매칭되는 반을 자동 선택
        return classes
            .filter((c) => c.slotKey && preferredKeys.includes(c.slotKey))
            .map((c) => c.id);
    });
    const [note, setNote] = useState("");

    function toggleClass(classId: string) {
        setSelectedClassIds((prev) =>
            prev.includes(classId)
                ? prev.filter((id) => id !== classId)
                : [...prev, classId]
        );
    }

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (selectedClassIds.length === 0) {
            alert("최소 1개의 반을 선택해주세요.");
            return;
        }
        onSubmit(selectedClassIds, note);
    }

    // 요일별 반 그룹핑
    const classesByDay = classes.reduce<Record<string, ClassInfo[]>>((acc, c) => {
        const day = c.dayOfWeek || "기타";
        if (!acc[day]) acc[day] = [];
        acc[day].push(c);
        return acc;
    }, {});

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
            <div
                className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6 max-h-[80vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
            >
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-1">
                    <span className="material-symbols-outlined text-green-500">check_circle</span>
                    수강 신청 승인
                </h2>
                <p className="text-sm text-gray-500 mb-4">
                    <span className="font-medium text-gray-900">{app.childName}</span>을(를) 어떤 반에 배정하시겠습니까?
                </p>

                {/* 희망 시간대 안내 */}
                {app.preferredSlotKeys && (
                    <div className="bg-purple-50 text-purple-700 text-sm rounded-lg px-3 py-2 mb-4 flex items-center gap-2">
                        <span className="material-symbols-outlined text-base">info</span>
                        <span>희망 시간대: <span className="font-medium">{app.preferredSlotKeys}</span></span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* 반 선택 — 요일별 그룹 */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            배정할 반 선택 (복수 선택 가능) *
                        </label>
                        <div className="space-y-3 max-h-60 overflow-y-auto">
                            {Object.entries(classesByDay).map(([day, dayClasses]) => (
                                <div key={day}>
                                    <p className="text-xs font-bold text-gray-500 mb-1">
                                        {DAY_LABELS[day] || day}요일
                                    </p>
                                    <div className="space-y-1">
                                        {dayClasses.map((c) => {
                                            const selected = selectedClassIds.includes(c.id);
                                            return (
                                                <button
                                                    key={c.id}
                                                    type="button"
                                                    onClick={() => toggleClass(c.id)}
                                                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition border ${
                                                        selected
                                                            ? "border-green-500 bg-green-50 text-green-800"
                                                            : "border-gray-200 hover:border-gray-300 text-gray-700"
                                                    }`}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <span>
                                                            {c.name}
                                                            <span className="text-gray-400 ml-2">
                                                                {c.startTime}~{c.endTime}
                                                            </span>
                                                        </span>
                                                        {selected && (
                                                            <span className="material-symbols-outlined text-green-500 text-lg">check</span>
                                                        )}
                                                    </div>
                                                    {c.program && (
                                                        <span className="text-xs text-gray-400">{c.program.name}</span>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* 관리자 메모 */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">관리자 메모</label>
                        <textarea
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            rows={2}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                            placeholder="내부 참고용 메모 (선택사항)"
                        />
                    </div>

                    {/* 버튼 */}
                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition"
                        >
                            취소
                        </button>
                        <button
                            type="submit"
                            disabled={busy || selectedClassIds.length === 0}
                            className="flex items-center gap-1.5 px-5 py-2.5 bg-green-500 text-white rounded-xl hover:bg-green-600 transition font-medium text-sm disabled:opacity-40"
                        >
                            {busy ? (
                                <span className="material-symbols-outlined text-lg animate-spin">progress_activity</span>
                            ) : (
                                <span className="material-symbols-outlined text-lg">check_circle</span>
                            )}
                            {busy ? "처리 중..." : `승인 (${selectedClassIds.length}개 반)`}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ── 반려 모달 ──────────────────────────────────────────────────────────────────

function RejectModal({
    app,
    onClose,
    onSubmit,
    busy,
}: {
    app: EnrollApplication;
    onClose: () => void;
    onSubmit: (reason: string) => void;
    busy: boolean;
}) {
    const [reason, setReason] = useState("");

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6" onClick={(e) => e.stopPropagation()}>
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-1">
                    <span className="material-symbols-outlined text-red-500">cancel</span>
                    수강 신청 반려
                </h2>
                <p className="text-sm text-gray-500 mb-4">
                    <span className="font-medium text-gray-900">{app.childName}</span>의 신청을 반려합니다.
                </p>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">반려 사유</label>
                        <textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            rows={3}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
                            placeholder="반려 사유를 입력하세요 (선택)"
                        />
                    </div>

                    <div className="flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition"
                        >
                            취소
                        </button>
                        <button
                            onClick={() => onSubmit(reason)}
                            disabled={busy}
                            className="flex items-center gap-1.5 px-5 py-2.5 bg-red-500 text-white rounded-xl hover:bg-red-600 transition font-medium text-sm disabled:opacity-40"
                        >
                            {busy ? (
                                <span className="material-symbols-outlined text-lg animate-spin">progress_activity</span>
                            ) : (
                                <span className="material-symbols-outlined text-lg">cancel</span>
                            )}
                            {busy ? "처리 중..." : "반려 처리"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── 상세 보기 모달 ──────────────────────────────────────────────────────────────

function DetailModal({
    app,
    onClose,
}: {
    app: EnrollApplication;
    onClose: () => void;
}) {
    const cfg = STATUS_CONFIG[app.status] || STATUS_CONFIG.PENDING;

    function formatDate(dateStr: string | null) {
        if (!dateStr) return "-";
        const d = new Date(dateStr);
        return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
    }

    // 정보 행 렌더링 헬퍼
    function InfoRow({ label, value }: { label: string; value: string | null | undefined | boolean }) {
        if (value === null || value === undefined || value === "") return null;
        const displayValue = typeof value === "boolean" ? (value ? "네" : "아니오") : value;
        return (
            <div className="flex items-start gap-2 text-sm">
                <span className="text-gray-500 min-w-[80px] flex-shrink-0">{label}</span>
                <span className="text-gray-900 font-medium">{displayValue}</span>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
            <div
                className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6 max-h-[80vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        <span className="material-symbols-outlined text-brand-orange-500">assignment</span>
                        수강 신청 상세
                    </h2>
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.color}`}>
                        <span className="material-symbols-outlined text-sm">{cfg.icon}</span>
                        {cfg.label}
                    </span>
                </div>

                <div className="space-y-5">
                    {/* 아이 정보 */}
                    <div>
                        <h3 className="text-xs font-bold text-gray-500 uppercase mb-2 flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm">child_care</span>
                            아이 정보
                        </h3>
                        <div className="space-y-1.5 bg-gray-50 rounded-lg p-3">
                            <InfoRow label="이름" value={app.childName} />
                            <InfoRow label="생년월일" value={formatDate(app.childBirthDate)} />
                            <InfoRow label="성별" value={app.childGender} />
                            <InfoRow label="학년" value={app.childGrade} />
                            <InfoRow label="학교" value={app.childSchool} />
                            <InfoRow label="전화번호" value={app.childPhone} />
                        </div>
                    </div>

                    {/* 보호자 정보 */}
                    <div>
                        <h3 className="text-xs font-bold text-gray-500 uppercase mb-2 flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm">person</span>
                            보호자 정보
                        </h3>
                        <div className="space-y-1.5 bg-gray-50 rounded-lg p-3">
                            <InfoRow label="이름" value={app.parentName} />
                            <InfoRow label="연락처" value={app.parentPhone} />
                            <InfoRow label="관계" value={app.parentRelation} />
                            <InfoRow label="주소" value={app.address} />
                        </div>
                    </div>

                    {/* 수강 정보 */}
                    <div>
                        <h3 className="text-xs font-bold text-gray-500 uppercase mb-2 flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm">sports_basketball</span>
                            수강 정보
                        </h3>
                        <div className="space-y-1.5 bg-gray-50 rounded-lg p-3">
                            <InfoRow label="희망 시간" value={app.preferredSlotKeys} />
                            <InfoRow label="농구 경험" value={app.basketballExp} />
                            <InfoRow label="셔틀" value={app.shuttleNeeded} />
                            <InfoRow label="탑승지" value={app.shuttlePickup} />
                            <InfoRow label="하차지" value={app.shuttleDropoff} />
                            <InfoRow label="셔틀 시간" value={app.shuttleTime} />
                            <InfoRow label="유입경로" value={app.referralSource ? (SOURCE_LABELS[app.referralSource] || app.referralSource) : null} />
                        </div>
                    </div>

                    {/* 메모 */}
                    {app.memo && (
                        <div>
                            <h3 className="text-xs font-bold text-gray-500 uppercase mb-2">보호자 메모</h3>
                            <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">{app.memo}</p>
                        </div>
                    )}

                    {/* 처리 결과 */}
                    {app.processedAt && (
                        <div>
                            <h3 className="text-xs font-bold text-gray-500 uppercase mb-2">처리 정보</h3>
                            <div className="space-y-1.5 bg-gray-50 rounded-lg p-3">
                                <InfoRow label="처리일" value={formatDate(app.processedAt)} />
                                <InfoRow label="처리메모" value={app.processedNote} />
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex justify-end mt-5">
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition font-medium text-sm"
                    >
                        닫기
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── 설정 탭 (기존 안내 설정) ──────────────────────────────────────────────────────

const INPUT = "w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-brand-orange-500 focus:border-brand-orange-500 transition";
const TEXTAREA = INPUT + " resize-none";

function SettingsTab({ initialSettings }: { initialSettings: ApplyAdminClientProps["initialSettings"] }) {
    const router = useRouter();

    const [trialTitle, setTrialTitle] = useState(initialSettings.trialTitle);
    const [trialContent, setTrialContent] = useState(initialSettings.trialContent || "");
    const [trialFormUrl, setTrialFormUrl] = useState(initialSettings.trialFormUrl || "");
    const [enrollTitle, setEnrollTitle] = useState(initialSettings.enrollTitle);
    const [enrollContent, setEnrollContent] = useState(initialSettings.enrollContent || "");
    const [enrollFormUrl, setEnrollFormUrl] = useState(initialSettings.enrollFormUrl || "");
    const [uniformFormUrl, setUniformFormUrl] = useState(initialSettings.uniformFormUrl || "");
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleSave() {
        setSaving(true);
        setSaved(false);
        setError(null);
        try {
            await updateAcademySettings({
                trialTitle: trialTitle.trim() || "체험수업 안내",
                trialContent: trialContent.trim() || undefined,
                trialFormUrl: trialFormUrl.trim() || undefined,
                enrollTitle: enrollTitle.trim() || "수강신청 안내",
                enrollContent: enrollContent.trim() || undefined,
                enrollFormUrl: enrollFormUrl.trim() || undefined,
                uniformFormUrl: uniformFormUrl.trim() || undefined,
            });
            setSaved(true);
            router.refresh();
            setTimeout(() => setSaved(false), 3000);
        } catch (e: any) {
            setError(e.message ?? "저장 실패");
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="space-y-8">
            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-4">
                    {error}
                </div>
            )}

            {/* 체험수업 */}
            <SectionCard badge="체험수업" badgeColor="bg-orange-100 text-brand-orange-600 border border-orange-200" title="체험수업 안내 설정">
                <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">섹션 제목</label>
                    <input type="text" value={trialTitle} onChange={(e) => setTrialTitle(e.target.value)} className={INPUT} placeholder="체험수업 안내" />
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                        안내 내용 <span className="text-gray-400 font-normal ml-1">(체험수업 절차, 혜택, 대상 등)</span>
                    </label>
                    <textarea value={trialContent} onChange={(e) => setTrialContent(e.target.value)} rows={6} className={TEXTAREA} placeholder={"예:\n- 체험수업 1회 1만원\n- 초등학생~중학생 누구나 신청 가능"} />
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                        구글폼 URL <span className="text-gray-400 font-normal ml-1">(기존 구글폼 백업용, 현재는 자체 폼 사용)</span>
                    </label>
                    <input type="url" value={trialFormUrl} onChange={(e) => setTrialFormUrl(e.target.value)} className={INPUT} placeholder="https://docs.google.com/forms/d/e/..." />
                </div>
            </SectionCard>

            {/* 수강신청 */}
            <SectionCard badge="수강신청" badgeColor="bg-blue-50 text-blue-700 border border-blue-200" title="수강신청 안내 설정">
                <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">섹션 제목</label>
                    <input type="text" value={enrollTitle} onChange={(e) => setEnrollTitle(e.target.value)} className={INPUT} placeholder="수강신청 안내" />
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                        안내 내용 <span className="text-gray-400 font-normal ml-1">(수강신청 방법, 준비물, 수강료 납부 방법 등)</span>
                    </label>
                    <textarea value={enrollContent} onChange={(e) => setEnrollContent(e.target.value)} rows={6} className={TEXTAREA} placeholder={"예:\n- 신청서 작성 후 원장님 확인\n- 수강료는 매월 1일 납부"} />
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                        구글폼 URL <span className="text-gray-400 font-normal ml-1">(기존 구글폼 백업용, 현재는 자체 폼 사용)</span>
                    </label>
                    <input type="url" value={enrollFormUrl} onChange={(e) => setEnrollFormUrl(e.target.value)} className={INPUT} placeholder="https://docs.google.com/forms/d/e/..." />
                </div>
            </SectionCard>

            {/* 유니폼 신청 */}
            <SectionCard badge="유니폼" badgeColor="bg-green-50 text-green-700 border border-green-200" title="유니폼 신청 설정">
                <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                        구글폼 URL <span className="text-gray-400 font-normal ml-1">(유니폼 신청용 구글폼)</span>
                    </label>
                    <input type="url" value={uniformFormUrl} onChange={(e) => setUniformFormUrl(e.target.value)} className={INPUT} placeholder="https://docs.google.com/forms/d/e/..." />
                </div>
            </SectionCard>

            <div className="flex justify-end gap-3">
                {saved && <span className="text-sm text-green-600 font-medium self-center">저장 완료</span>}
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-brand-orange-500 hover:bg-orange-600 text-white font-bold px-8 py-3 rounded-xl transition disabled:opacity-40 shadow-sm"
                >
                    {saving ? "저장 중..." : "저장하기"}
                </button>
            </div>
        </div>
    );
}

// ── 공통 UI 컴포넌트 ──────────────────────────────────────────────────────────

function SectionCard({
    badge,
    badgeColor,
    title,
    children,
}: {
    badge: string;
    badgeColor: string;
    title: string;
    children: React.ReactNode;
}) {
    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${badgeColor}`}>{badge}</span>
                <h2 className="text-base font-bold text-gray-800">{title}</h2>
            </div>
            <div className="p-6 space-y-4">{children}</div>
        </div>
    );
}
