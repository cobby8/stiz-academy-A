"use client";

import { useState, useMemo } from "react";
import {
    createTrialLead,
    updateTrialLead,
    deleteTrialLead,
    convertTrialToStudent,
    generateEnrollLink,
} from "@/app/actions/admin";
import { useRouter } from "next/navigation";

// ── 타입 정의 ──────────────────────────────────────────────────────────────────

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
    basketballExp: string | null;
    preferredSlotKey: string | null;
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

// ── 상태별 라벨/색상/아이콘 매핑 ──────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
    NEW: { label: "신규", color: "bg-blue-100 text-blue-800", icon: "fiber_new" },
    CONTACTED: { label: "연락완료", color: "bg-yellow-100 text-yellow-800", icon: "call" },
    SCHEDULED: { label: "체험예정", color: "bg-purple-100 text-purple-800", icon: "event" },
    ATTENDED: { label: "체험완료", color: "bg-green-100 text-green-800", icon: "check_circle" },
    CONVERTED: { label: "등록전환", color: "bg-emerald-100 text-emerald-800", icon: "how_to_reg" },
    LOST: { label: "이탈", color: "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400", icon: "person_off" },
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
const STATUS_ORDER = ["NEW", "CONTACTED", "SCHEDULED", "ATTENDED", "CONVERTED", "LOST"] as const;

// ── 메인 컴포넌트 ──────────────────────────────────────────────────────────────

export default function TrialCrmClient({
    initialLeads,
    initialStats,
}: {
    initialLeads: TrialLead[];
    initialStats: TrialStats;
}) {
    const router = useRouter();
    const [leads] = useState(initialLeads);
    const [stats] = useState(initialStats);
    const [filter, setFilter] = useState<string>("ALL");
    const [busy, setBusy] = useState(false);

    // 모달 상태
    const [showAddModal, setShowAddModal] = useState(false);
    const [showConvertModal, setShowConvertModal] = useState<TrialLead | null>(null);
    const [showLostModal, setShowLostModal] = useState<TrialLead | null>(null);
    const [showMemoModal, setShowMemoModal] = useState<TrialLead | null>(null);

    // 필터링된 리드 목록
    const filteredLeads = useMemo(() => {
        if (filter === "ALL") return leads;
        return leads.filter((l) => l.status === filter);
    }, [leads, filter]);

    // 상태 변경 핸들러
    async function handleStatusChange(lead: TrialLead, newStatus: string) {
        if (busy) return;
        setBusy(true);
        try {
            const updates: Record<string, any> = { status: newStatus };
            // 상태에 따른 날짜 자동 설정
            if (newStatus === "ATTENDED") {
                updates.attendedDate = new Date().toISOString();
            }
            await updateTrialLead(lead.id, updates);
            router.refresh();
        } catch (e) {
            alert((e as Error).message);
        } finally {
            setBusy(false);
        }
    }

    // 삭제 핸들러
    async function handleDelete(lead: TrialLead) {
        if (!confirm(`"${lead.childName}" 체험 신청을 삭제하시겠습니까?`)) return;
        setBusy(true);
        try {
            await deleteTrialLead(lead.id);
            router.refresh();
        } catch (e) {
            alert((e as Error).message);
        } finally {
            setBusy(false);
        }
    }

    // 날짜 포맷 헬퍼
    function formatDate(dateStr: string | null) {
        if (!dateStr) return "-";
        const d = new Date(dateStr);
        return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
    }

    return (
        <div className="space-y-6">
            {/* 페이지 제목 */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <span className="material-symbols-outlined text-3xl text-brand-orange-500 dark:text-brand-neon-lime">handshake</span>
                        체험수업 CRM
                        {/* 새 신청 건수 배지 — NEW 상태가 있을 때만 표시 */}
                        {stats.NEW > 0 && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-500 text-white animate-pulse">
                                새 신청 {stats.NEW}건
                            </span>
                        )}
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">체험 신청부터 정규 등록까지 전환 과정을 추적합니다</p>
                </div>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-brand-orange-500 dark:bg-brand-neon-lime dark:text-brand-navy-900 text-white rounded-lg hover:bg-brand-orange-600 dark:hover:bg-lime-400 transition-colors font-medium"
                >
                    <span className="material-symbols-outlined text-xl">person_add</span>
                    체험 신청 등록
                </button>
            </div>

            {/* ── 파이프라인 요약 카드 ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                {STATUS_ORDER.map((s) => {
                    const cfg = STATUS_CONFIG[s];
                    const count = stats[s as keyof TrialStats] as number;
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
                {/* 전환율 카드 */}
                <div className="rounded-xl p-4 text-center bg-white dark:bg-gray-800 border-2 border-transparent">
                    <span className="material-symbols-outlined text-2xl text-emerald-600">trending_up</span>
                    <p className="text-2xl font-bold text-emerald-600 mt-1">{stats.conversionRate}%</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">전환율</p>
                </div>
            </div>

            {/* ── 필터 탭 ── */}
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
                    const count = stats[s as keyof TrialStats] as number;
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

            {/* ── 리드 목록 ── */}
            {filteredLeads.length === 0 ? (
                <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                    <span className="material-symbols-outlined text-5xl text-gray-300">person_search</span>
                    <p className="text-gray-500 dark:text-gray-400 mt-3">
                        {filter === "ALL" ? "등록된 체험 신청이 없습니다" : `"${STATUS_CONFIG[filter]?.label}" 상태의 신청이 없습니다`}
                    </p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {filteredLeads.map((lead) => {
                        const cfg = STATUS_CONFIG[lead.status] || STATUS_CONFIG.NEW;
                        return (
                            <div
                                key={lead.id}
                                className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 hover:shadow-md transition-shadow"
                            >
                                <div className="flex flex-col md:flex-row md:items-center gap-4">
                                    {/* 왼쪽: 기본 정보 */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.color}`}>
                                                <span className="material-symbols-outlined text-sm">{cfg.icon}</span>
                                                {cfg.label}
                                            </span>
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300`}>
                                                {SOURCE_LABELS[lead.source] || lead.source}
                                            </span>
                                        </div>
                                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                            {lead.childName}
                                            {lead.childAge && (
                                                <span className="text-sm font-normal text-gray-500 dark:text-gray-400 ml-2">({lead.childAge})</span>
                                            )}
                                        </h3>
                                        <div className="flex items-center gap-4 mt-1 text-sm text-gray-500 dark:text-gray-400">
                                            <span className="flex items-center gap-1">
                                                <span className="material-symbols-outlined text-base">person</span>
                                                {lead.parentName}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <span className="material-symbols-outlined text-base">phone</span>
                                                {lead.parentPhone}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <span className="material-symbols-outlined text-base">calendar_today</span>
                                                {formatDate(lead.createdAt)}
                                            </span>
                                        </div>
                                        {/* 날짜 정보 표시 */}
                                        {(lead.scheduledDate || lead.attendedDate || lead.convertedDate) && (
                                            <div className="flex gap-4 mt-2 text-xs text-gray-400">
                                                {lead.scheduledDate && (
                                                    <span>체험예정: {formatDate(lead.scheduledDate)}</span>
                                                )}
                                                {lead.attendedDate && (
                                                    <span>체험일: {formatDate(lead.attendedDate)}</span>
                                                )}
                                                {lead.convertedDate && (
                                                    <span>전환일: {formatDate(lead.convertedDate)}</span>
                                                )}
                                            </div>
                                        )}
                                        {/* Phase A 추가 정보 — 학년, 농구경험, 희망슬롯 */}
                                        {(lead.childGrade || lead.basketballExp || lead.preferredSlotKey) && (
                                            <div className="flex flex-wrap gap-2 mt-2">
                                                {lead.childGrade && (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-blue-50 text-blue-700">
                                                        <span className="material-symbols-outlined text-xs">school</span>
                                                        {lead.childGrade}
                                                    </span>
                                                )}
                                                {lead.basketballExp && (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-orange-50 text-orange-700">
                                                        <span className="material-symbols-outlined text-xs">sports_basketball</span>
                                                        {lead.basketballExp}
                                                    </span>
                                                )}
                                                {lead.preferredSlotKey && (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-purple-50 text-purple-700">
                                                        <span className="material-symbols-outlined text-xs">schedule</span>
                                                        희망: {lead.preferredSlotKey}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                        {/* 바라는 점 표시 */}
                                        {lead.hopeNote && (
                                            <p className="mt-2 text-sm text-blue-700 bg-blue-50 rounded-lg px-3 py-2">
                                                <span className="font-medium">바라는 점:</span> {lead.hopeNote}
                                            </p>
                                        )}
                                        {/* 메모 표시 */}
                                        {lead.memo && (
                                            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-900 rounded-lg px-3 py-2">
                                                {lead.memo}
                                            </p>
                                        )}
                                        {/* 이탈 사유 표시 */}
                                        {lead.lostReason && (
                                            <p className="mt-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                                                이탈 사유: {lead.lostReason}
                                            </p>
                                        )}
                                    </div>

                                    {/* 오른쪽: 액션 버튼 */}
                                    <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
                                        {/* 상태 변경 드롭다운 — CONVERTED/LOST가 아닌 경우만 */}
                                        {lead.status !== "CONVERTED" && lead.status !== "LOST" && (
                                            <select
                                                value={lead.status}
                                                onChange={(e) => handleStatusChange(lead, e.target.value)}
                                                disabled={busy}
                                                className="text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-orange-500 dark:focus:ring-brand-neon-lime"
                                            >
                                                {STATUS_ORDER.filter((s) => s !== "CONVERTED" && s !== "LOST").map((s) => (
                                                    <option key={s} value={s}>
                                                        {STATUS_CONFIG[s].label}
                                                    </option>
                                                ))}
                                            </select>
                                        )}

                                        {/* 메모 편집 버튼 */}
                                        <button
                                            onClick={() => setShowMemoModal(lead)}
                                            className="p-2 text-gray-400 hover:text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:bg-gray-800 rounded-lg transition-colors"
                                            title="메모 편집"
                                        >
                                            <span className="material-symbols-outlined text-xl">edit_note</span>
                                        </button>

                                        {/* 수강 안내 링크 복사 — ATTENDED 상태에서만 활성 */}
                                        {/* 체험 완료된 학부모에게 수강 신청 링크를 보낼 때 사용 */}
                                        {lead.status === "ATTENDED" && (
                                            <button
                                                onClick={async () => {
                                                    try {
                                                        const link = await generateEnrollLink(lead.id);
                                                        await navigator.clipboard.writeText(link);
                                                        alert("수강 안내 링크가 클립보드에 복사되었습니다.\n학부모님께 보내주세요.");
                                                    } catch (e) {
                                                        alert((e as Error).message);
                                                    }
                                                }}
                                                disabled={busy}
                                                className="flex items-center gap-1.5 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium"
                                                title="수강 신청 링크를 복사하여 학부모에게 전달"
                                            >
                                                <span className="material-symbols-outlined text-lg">content_copy</span>
                                                수강 안내
                                            </button>
                                        )}

                                        {/* 정규 등록 전환 — ATTENDED 상태에서만 활성 */}
                                        {lead.status === "ATTENDED" && (
                                            <button
                                                onClick={() => setShowConvertModal(lead)}
                                                disabled={busy}
                                                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors text-sm font-medium"
                                            >
                                                <span className="material-symbols-outlined text-lg">how_to_reg</span>
                                                정규 등록
                                            </button>
                                        )}

                                        {/* 이탈 처리 — CONVERTED/LOST가 아닌 경우만 */}
                                        {lead.status !== "CONVERTED" && lead.status !== "LOST" && (
                                            <button
                                                onClick={() => setShowLostModal(lead)}
                                                disabled={busy}
                                                className="flex items-center gap-1 px-3 py-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors text-sm"
                                            >
                                                <span className="material-symbols-outlined text-lg">person_off</span>
                                                이탈
                                            </button>
                                        )}

                                        {/* 삭제 */}
                                        <button
                                            onClick={() => handleDelete(lead)}
                                            disabled={busy}
                                            className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                            title="삭제"
                                        >
                                            <span className="material-symbols-outlined text-xl">delete</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ── 모달들 ── */}
            {showAddModal && (
                <AddLeadModal
                    onClose={() => setShowAddModal(false)}
                    onSubmit={async (data) => {
                        setBusy(true);
                        try {
                            await createTrialLead(data);
                            setShowAddModal(false);
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

            {showConvertModal && (
                <ConvertModal
                    lead={showConvertModal}
                    onClose={() => setShowConvertModal(null)}
                    onSubmit={async (studentData) => {
                        setBusy(true);
                        try {
                            await convertTrialToStudent(showConvertModal.id, studentData);
                            setShowConvertModal(null);
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

            {showLostModal && (
                <LostModal
                    lead={showLostModal}
                    onClose={() => setShowLostModal(null)}
                    onSubmit={async (reason) => {
                        setBusy(true);
                        try {
                            await updateTrialLead(showLostModal.id, {
                                status: "LOST",
                                lostReason: reason,
                            });
                            setShowLostModal(null);
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

            {showMemoModal && (
                <MemoModal
                    lead={showMemoModal}
                    onClose={() => setShowMemoModal(null)}
                    onSubmit={async (memo) => {
                        setBusy(true);
                        try {
                            await updateTrialLead(showMemoModal.id, { memo });
                            setShowMemoModal(null);
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
        </div>
    );
}

// ── 체험 신청 등록 모달 ──────────────────────────────────────────────────────────

function AddLeadModal({
    onClose,
    onSubmit,
    busy,
}: {
    onClose: () => void;
    onSubmit: (data: { childName: string; childAge?: string; parentName: string; parentPhone: string; source?: string; memo?: string }) => void;
    busy: boolean;
}) {
    const [form, setForm] = useState({
        childName: "",
        childAge: "",
        parentName: "",
        parentPhone: "",
        source: "WEBSITE",
        memo: "",
    });

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!form.childName.trim() || !form.parentName.trim() || !form.parentPhone.trim()) {
            alert("아이 이름, 학부모 이름, 연락처는 필수입니다.");
            return;
        }
        onSubmit({
            childName: form.childName,
            childAge: form.childAge || undefined,
            parentName: form.parentName,
            parentPhone: form.parentPhone,
            source: form.source,
            memo: form.memo || undefined,
        });
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md mx-4 p-6" onClick={(e) => e.stopPropagation()}>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                    <span className="material-symbols-outlined text-brand-orange-500 dark:text-brand-neon-lime">person_add</span>
                    체험 신청 등록
                </h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* 아이 이름 */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">아이 이름 *</label>
                        <input
                            type="text"
                            value={form.childName}
                            onChange={(e) => setForm({ ...form, childName: e.target.value })}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange-500 dark:focus:ring-brand-neon-lime"
                            placeholder="홍길동"
                        />
                    </div>
                    {/* 나이/학년 */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">나이/학년</label>
                        <input
                            type="text"
                            value={form.childAge}
                            onChange={(e) => setForm({ ...form, childAge: e.target.value })}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange-500 dark:focus:ring-brand-neon-lime"
                            placeholder="초등 3학년"
                        />
                    </div>
                    {/* 학부모 이름 */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">학부모 이름 *</label>
                        <input
                            type="text"
                            value={form.parentName}
                            onChange={(e) => setForm({ ...form, parentName: e.target.value })}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange-500 dark:focus:ring-brand-neon-lime"
                            placeholder="홍부모"
                        />
                    </div>
                    {/* 연락처 */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">연락처 *</label>
                        <input
                            type="tel"
                            value={form.parentPhone}
                            onChange={(e) => {
                                // 숫자만 추출 후 000-0000-0000 자동 포맷팅
                                const nums = e.target.value.replace(/\D/g, "").slice(0, 11);
                                let formatted = nums;
                                if (nums.length > 7) formatted = `${nums.slice(0,3)}-${nums.slice(3,7)}-${nums.slice(7)}`;
                                else if (nums.length > 3) formatted = `${nums.slice(0,3)}-${nums.slice(3)}`;
                                setForm({ ...form, parentPhone: formatted });
                            }}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange-500 dark:focus:ring-brand-neon-lime"
                            placeholder="숫자만 입력 (자동 변환: 010-1234-5678)"
                        />
                        <p className="text-xs text-gray-400 mt-1">숫자만 입력하면 자동으로 000-0000-0000 형식으로 변환됩니다</p>
                    </div>
                    {/* 유입경로 */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">유입 경로</label>
                        <select
                            value={form.source}
                            onChange={(e) => setForm({ ...form, source: e.target.value })}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange-500 dark:focus:ring-brand-neon-lime"
                        >
                            <option value="WEBSITE">홈페이지</option>
                            <option value="NAVER">네이버</option>
                            <option value="REFERRAL">지인소개</option>
                            <option value="OTHER">기타</option>
                        </select>
                    </div>
                    {/* 메모 */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">메모</label>
                        <textarea
                            value={form.memo}
                            onChange={(e) => setForm({ ...form, memo: e.target.value })}
                            rows={3}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange-500 dark:focus:ring-brand-neon-lime resize-none"
                            placeholder="추가 메모 사항"
                        />
                    </div>
                    {/* 버튼 */}
                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:bg-gray-900 transition-colors text-sm font-medium"
                        >
                            취소
                        </button>
                        <button
                            type="submit"
                            disabled={busy}
                            className="flex-1 px-4 py-2.5 bg-brand-orange-500 dark:bg-brand-neon-lime dark:text-brand-navy-900 text-white rounded-lg hover:bg-brand-orange-600 dark:hover:bg-lime-400 transition-colors text-sm font-medium disabled:opacity-50"
                        >
                            {busy ? "등록 중..." : "등록"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ── 정규 등록 전환 모달 ──────────────────────────────────────────────────────────

function ConvertModal({
    lead,
    onClose,
    onSubmit,
    busy,
}: {
    lead: TrialLead;
    onClose: () => void;
    onSubmit: (data: {
        name: string;
        birthDate: string;
        gender?: string | null;
        parentName: string;
        parentPhone?: string | null;
        parentEmail?: string | null;
        memo?: string | null;
    }) => void;
    busy: boolean;
}) {
    // 체험 리드 정보를 기본값으로 사용 (입력 편의)
    const [form, setForm] = useState({
        name: lead.childName,
        birthDate: "2015-01-01",
        gender: "",
        parentName: lead.parentName,
        parentPhone: lead.parentPhone,
        parentEmail: "",
        memo: lead.memo || "",
    });

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!form.name.trim() || !form.birthDate || !form.parentName.trim()) {
            alert("아이 이름, 생년월일, 학부모 이름은 필수입니다.");
            return;
        }
        onSubmit({
            name: form.name,
            birthDate: form.birthDate,
            gender: form.gender || null,
            parentName: form.parentName,
            parentPhone: form.parentPhone || null,
            parentEmail: form.parentEmail || null,
            memo: form.memo || null,
        });
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md mx-4 p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                    <span className="material-symbols-outlined text-emerald-500">how_to_reg</span>
                    정규 등록 전환
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    체험 학생 &quot;{lead.childName}&quot;을 정규 원생으로 등록합니다.
                </p>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">아이 이름 *</label>
                        <input
                            type="text"
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange-500 dark:focus:ring-brand-neon-lime"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">생년월일 *</label>
                        <input
                            type="date"
                            min="1950-01-01" max="2025-12-31"
                            value={form.birthDate}
                            onChange={(e) => setForm({ ...form, birthDate: e.target.value })}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange-500 dark:focus:ring-brand-neon-lime"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">성별</label>
                        <select
                            value={form.gender}
                            onChange={(e) => setForm({ ...form, gender: e.target.value })}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange-500 dark:focus:ring-brand-neon-lime"
                        >
                            <option value="">선택 안함</option>
                            <option value="남">남</option>
                            <option value="여">여</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">학부모 이름 *</label>
                        <input
                            type="text"
                            value={form.parentName}
                            onChange={(e) => setForm({ ...form, parentName: e.target.value })}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange-500 dark:focus:ring-brand-neon-lime"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">학부모 연락처</label>
                        <input
                            type="tel"
                            value={form.parentPhone}
                            onChange={(e) => {
                                // 숫자만 추출 후 000-0000-0000 자동 포맷팅
                                const nums = e.target.value.replace(/\D/g, "").slice(0, 11);
                                let formatted = nums;
                                if (nums.length > 7) formatted = `${nums.slice(0,3)}-${nums.slice(3,7)}-${nums.slice(7)}`;
                                else if (nums.length > 3) formatted = `${nums.slice(0,3)}-${nums.slice(3)}`;
                                setForm({ ...form, parentPhone: formatted });
                            }}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange-500 dark:focus:ring-brand-neon-lime"
                            placeholder="숫자만 입력 (자동 변환: 010-1234-5678)"
                        />
                        <p className="text-xs text-gray-400 mt-1">숫자만 입력하면 자동으로 000-0000-0000 형식으로 변환됩니다</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">학부모 이메일</label>
                        <input
                            type="email"
                            value={form.parentEmail}
                            onChange={(e) => setForm({ ...form, parentEmail: e.target.value })}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange-500 dark:focus:ring-brand-neon-lime"
                            placeholder="로그인에 사용됩니다 (선택)"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">메모</label>
                        <textarea
                            value={form.memo}
                            onChange={(e) => setForm({ ...form, memo: e.target.value })}
                            rows={2}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange-500 dark:focus:ring-brand-neon-lime resize-none"
                        />
                    </div>
                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:bg-gray-900 transition-colors text-sm font-medium"
                        >
                            취소
                        </button>
                        <button
                            type="submit"
                            disabled={busy}
                            className="flex-1 px-4 py-2.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors text-sm font-medium disabled:opacity-50"
                        >
                            {busy ? "등록 중..." : "정규 등록"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ── 이탈 처리 모달 ──────────────────────────────────────────────────────────────

function LostModal({
    lead,
    onClose,
    onSubmit,
    busy,
}: {
    lead: TrialLead;
    onClose: () => void;
    onSubmit: (reason: string) => void;
    busy: boolean;
}) {
    const [reason, setReason] = useState("");

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md mx-4 p-6" onClick={(e) => e.stopPropagation()}>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                    <span className="material-symbols-outlined text-red-500">person_off</span>
                    이탈 처리
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    &quot;{lead.childName}&quot; 체험 건을 이탈로 처리합니다.
                </p>
                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">이탈 사유</label>
                    <textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        rows={3}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange-500 dark:focus:ring-brand-neon-lime resize-none"
                        placeholder="사유를 입력하세요 (선택)"
                    />
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:bg-gray-900 transition-colors text-sm font-medium"
                    >
                        취소
                    </button>
                    <button
                        onClick={() => onSubmit(reason)}
                        disabled={busy}
                        className="flex-1 px-4 py-2.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm font-medium disabled:opacity-50"
                    >
                        {busy ? "처리 중..." : "이탈 처리"}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── 메모 편집 모달 ──────────────────────────────────────────────────────────────

function MemoModal({
    lead,
    onClose,
    onSubmit,
    busy,
}: {
    lead: TrialLead;
    onClose: () => void;
    onSubmit: (memo: string) => void;
    busy: boolean;
}) {
    const [memo, setMemo] = useState(lead.memo || "");

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md mx-4 p-6" onClick={(e) => e.stopPropagation()}>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                    <span className="material-symbols-outlined text-brand-orange-500 dark:text-brand-neon-lime">edit_note</span>
                    메모 편집
                </h2>
                <div className="mb-4">
                    <textarea
                        value={memo}
                        onChange={(e) => setMemo(e.target.value)}
                        rows={4}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange-500 dark:focus:ring-brand-neon-lime resize-none"
                        placeholder="메모를 입력하세요"
                        autoFocus
                    />
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:bg-gray-900 transition-colors text-sm font-medium"
                    >
                        취소
                    </button>
                    <button
                        onClick={() => onSubmit(memo)}
                        disabled={busy}
                        className="flex-1 px-4 py-2.5 bg-brand-orange-500 dark:bg-brand-neon-lime dark:text-brand-navy-900 text-white rounded-lg hover:bg-brand-orange-600 dark:hover:bg-lime-400 transition-colors text-sm font-medium disabled:opacity-50"
                    >
                        {busy ? "저장 중..." : "저장"}
                    </button>
                </div>
            </div>
        </div>
    );
}
