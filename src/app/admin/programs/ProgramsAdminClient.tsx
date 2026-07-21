"use client";

import { useCallback, useState, useTransition, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { deleteProgram, reorderPrograms } from "@/app/actions/admin";
import AdminModal from "@/components/admin/AdminModal";

const ProgramFormPanel = dynamic(() => import("./ProgramFormPanel"), {
    loading: () => null,
});

// ── Constants ─────────────────────────────────────────────────────────────────

const DAY_OPTIONS = [
    { key: "Mon", label: "월" },
    { key: "Tue", label: "화" },
    { key: "Wed", label: "수" },
    { key: "Thu", label: "목" },
    { key: "Fri", label: "금" },
    { key: "Sat", label: "토" },
    { key: "Sun", label: "일" },
];

const WEEKEND = new Set(["Sat", "Sun"]);

const FREQ_TIERS = [
    { key: "priceWeek1" as const, label: "주 1회", autoShuttle: 10000 },
    { key: "priceWeek2" as const, label: "주 2회", autoShuttle: 15000 },
    { key: "priceWeek3" as const, label: "주 3회", autoShuttle: 20000 },
    { key: "priceDaily" as const, label: "매일반", autoShuttle: 20000 },
];

function isWeekendOnly(days: string[]): boolean {
    if (days.length === 0) return false;
    return days.every((d) => WEEKEND.has(d));
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface Program {
    id: string;
    name: string;
    targetAge: string | null;
    weeklyFrequency: string | null;
    frequency: string | null;
    description: string | null;
    price: number;
    days: string | null;
    priceWeek1: number | null;
    priceWeek2: number | null;
    priceWeek3: number | null;
    priceDaily: number | null;
    shuttleFeeOverride: number | null;
    imageUrl: string | null;
}

type ProgramsPayload = {
    programs: Program[];
};

// ── Helper to display shuttle fee for a given frequency + override ─────────────

function displayShuttleFee(
    shuttleFeeOverride: number | null | undefined,
    freqKey: typeof FREQ_TIERS[number]["key"],
    weekend: boolean,
): string | null {
    if (weekend) return null; // no service
    if (shuttleFeeOverride === 0) return null; // explicitly disabled
    if (shuttleFeeOverride != null && shuttleFeeOverride > 0)
        return shuttleFeeOverride.toLocaleString() + "원";
    // auto
    const tier = FREQ_TIERS.find((t) => t.key === freqKey);
    return tier ? tier.autoShuttle.toLocaleString() + "원" : null;
}

function ProgramsLoadingFallback() {
    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between gap-4">
                <div>
                    <div className="h-8 w-44 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                    <div className="mt-2 h-4 w-96 max-w-full animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
                </div>
                <div className="flex items-center gap-2">
                    <div className="h-10 w-28 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-700" />
                    <div className="h-10 w-32 animate-pulse rounded-xl bg-gray-200 dark:bg-gray-700" />
                </div>
            </div>
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                <div className="h-5 w-64 animate-pulse rounded bg-blue-100" />
                <div className="mt-3 flex flex-wrap gap-3">
                    {Array.from({ length: 4 }).map((_, index) => (
                        <div key={index} className="h-8 w-36 animate-pulse rounded-lg bg-white" />
                    ))}
                </div>
            </div>
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
                <div className="flex items-center justify-between gap-4 border-b border-gray-100 bg-gray-50 px-6 py-4 dark:border-gray-800 dark:bg-gray-900/50">
                    <div className="h-6 w-44 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                    <div className="h-4 w-44 animate-pulse rounded bg-gray-100 dark:bg-gray-700" />
                </div>
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                    {Array.from({ length: 5 }).map((_, index) => (
                        <div key={index} className="flex">
                            <div className="w-10 border-r border-gray-100 dark:border-gray-800">
                                <div className="mx-auto mt-6 h-5 w-5 animate-pulse rounded bg-gray-100 dark:bg-gray-700" />
                            </div>
                            <div className="flex-1 p-5">
                                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                                    <div className="min-w-0 flex-1 space-y-3">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <div className="h-6 w-6 animate-pulse rounded-full bg-gray-200 dark:bg-gray-700" />
                                            <div className="h-6 w-40 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                                            <div className="h-5 w-16 animate-pulse rounded-full bg-gray-100 dark:bg-gray-700" />
                                            <div className="h-5 w-16 animate-pulse rounded-full bg-gray-100 dark:bg-gray-700" />
                                        </div>
                                        <div className="h-4 w-3/4 animate-pulse rounded bg-gray-100 dark:bg-gray-700" />
                                        <div className="h-4 w-1/2 animate-pulse rounded bg-gray-100 dark:bg-gray-700" />
                                    </div>
                                    <div className="flex gap-2">
                                        <div className="h-8 w-14 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-700" />
                                        <div className="h-8 w-14 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-700" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function ProgramsErrorState({ onRetry }: { onRetry: () => void }) {
    return (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-800 dark:bg-red-950/30">
            <p className="text-sm font-bold text-red-700 dark:text-red-200">프로그램 목록을 불러오지 못했습니다.</p>
            <button
                type="button"
                onClick={onRetry}
                className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700"
            >
                다시 불러오기
            </button>
        </div>
    );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function ProgramsAdminClient({
    programs: initialPrograms,
}: {
    programs?: Program[];
}) {
    // Programs list with local state for optimistic drag-and-drop reorder
    const hasInitialData = initialPrograms !== undefined;
    const [programs, setPrograms] = useState<Program[]>(initialPrograms ?? []);
    const [loading, setLoading] = useState(!hasInitialData);
    const [loadError, setLoadError] = useState(false);
    useEffect(() => {
        if (initialPrograms) setPrograms(initialPrograms);
    }, [initialPrograms]);

    const [showAddModal, setShowAddModal] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [formPending, setFormPending] = useState(false);
    const [deletePending, startDeleteTransition] = useTransition();

    // Drag-and-drop state
    const dragIdRef = useRef<string | null>(null);
    const [dragOverId, setDragOverId] = useState<string | null>(null);
    const [reorderPending, startReorderTransition] = useTransition();

    const loadPrograms = useCallback(async () => {
        setLoading(true);
        setLoadError(false);
        try {
            const response = await fetch("/api/admin/programs", { cache: "no-store" });
            if (!response.ok) {
                throw new Error("Failed to load programs.");
            }
            const data = (await response.json()) as ProgramsPayload;
            setPrograms(data.programs);
        } catch (error) {
            console.error("Failed to load programs:", error);
            setLoadError(true);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (hasInitialData) return;
        void loadPrograms();
    }, [hasInitialData, loadPrograms]);

    function handleDragStart(e: React.DragEvent, id: string) {
        dragIdRef.current = id;
        e.dataTransfer.effectAllowed = "move";
    }
    function handleDragOver(e: React.DragEvent, id: string) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setDragOverId(id);
    }
    function handleDrop(e: React.DragEvent, targetId: string) {
        e.preventDefault();
        setDragOverId(null);
        const fromId = dragIdRef.current;
        dragIdRef.current = null;
        if (!fromId || fromId === targetId) return;
        const fromIdx = programs.findIndex((p) => p.id === fromId);
        const toIdx = programs.findIndex((p) => p.id === targetId);
        if (fromIdx === -1 || toIdx === -1) return;
        const next = [...programs];
        const [moved] = next.splice(fromIdx, 1);
        next.splice(toIdx, 0, moved);
        setPrograms(next); // optimistic
        startReorderTransition(async () => {
            try {
                await reorderPrograms(next.map((p) => p.id));
            } finally {
                await loadPrograms();
            }
        });
    }
    function handleDragEnd() {
        dragIdRef.current = null;
        setDragOverId(null);
    }

    function handleDelete(id: string) {
        startDeleteTransition(async () => {
            try {
                await deleteProgram(id);
                setDeletingId(null);
                await loadPrograms();
            } catch (e: any) {
                alert(e.message || "삭제 실패");
            }
        });
    }

    if (loading && programs.length === 0) {
        return <ProgramsLoadingFallback />;
    }

    if (loadError && programs.length === 0) {
        return <ProgramsErrorState onRetry={loadPrograms} />;
    }

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">프로그램 관리</h1>
                    <p className="text-gray-500 dark:text-gray-400">학원에서 운영하는 교육 프로그램을 등록하고 관리합니다.</p>
                </div>
                <div className="flex items-center gap-2">
                    <a
                        href="/api/admin/export-seed"
                        download="seed-data.ts"
                        title="현재 DB 데이터를 seed-data.ts 코드로 내보냅니다. 다운로드 후 prisma/seed-data.ts에 붙여넣고 git push 하세요."
                        className="flex-shrink-0 flex items-center gap-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 text-gray-700 dark:text-gray-200 font-semibold text-sm px-3 py-2.5 rounded-xl transition"
                    >
                        ↓ 시드 내보내기
                    </a>
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="flex-shrink-0 flex items-center gap-2 bg-brand-orange-500 dark:bg-brand-neon-lime dark:text-brand-navy-900 hover:bg-orange-600 text-white font-bold text-sm px-4 py-2.5 rounded-xl transition shadow-sm"
                    >
                        <span className="text-lg leading-none">+</span>
                        프로그램 등록
                    </button>
                </div>
            </div>

            {/* Add Program Modal */}
            {showAddModal && (
                <AdminModal
                    titleId="add-program-title"
                    onClose={() => { if (!formPending) setShowAddModal(false); }}
                    closeOnBackdrop={!formPending}
                    panelClassName="max-w-2xl"
                >
                    {/* Dialog */}
                    <div className="w-full">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800 sticky top-0 bg-white dark:bg-gray-800 z-10 rounded-t-2xl">
                            <h2 id="add-program-title" className="text-lg font-bold text-gray-900 dark:text-white">새 프로그램 등록</h2>
                            <button
                                type="button"
                                onClick={() => setShowAddModal(false)}
                                disabled={formPending}
                                className="text-gray-400 hover:text-gray-600 dark:text-gray-300 transition text-xl leading-none px-1"
                            >
                                ✕
                            </button>
                        </div>
                        <div className="p-6">
                            <ProgramFormPanel
                                mode="add"
                                onCancel={() => setShowAddModal(false)}
                                onSaved={() => {
                                    setShowAddModal(false);
                                    void loadPrograms();
                                }}
                                onPendingChange={setFormPending}
                            />
                        </div>
                    </div>
                </AdminModal>
            )}

            {/* Shuttle fee reference */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="text-sm font-bold text-blue-800 mb-2">🚌 셔틀버스 자동 요금 기준 (평일 수업)</p>
                <div className="flex flex-wrap gap-3">
                    {[
                        { freq: "주1회", fee: "10,000원" },
                        { freq: "주2회", fee: "15,000원" },
                        { freq: "주3회 / 매일반", fee: "20,000원" },
                        { freq: "주말 수업", fee: "셔틀 운행 없음" },
                    ].map((s) => (
                        <div key={s.freq} className="flex items-center gap-1.5 text-xs bg-white dark:bg-gray-800 border border-blue-200 rounded-lg px-3 py-1.5">
                            <span className="font-medium text-blue-700">{s.freq}</span>
                            <span className="text-gray-400">→</span>
                            <span className="font-bold text-blue-900">{s.fee}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Program List */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 flex items-center justify-between gap-4">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">등록된 프로그램 목록</h2>
                    <p className="text-xs text-gray-400">⠿ 핸들을 잡고 드래그하여 순서 변경</p>
                </div>
                <ul className="divide-y divide-gray-100">
                    {programs.length === 0 && (
                        <li className="p-8 text-center text-gray-500 dark:text-gray-400">등록된 프로그램이 없습니다.</li>
                    )}
                    {programs.map((program, i) => (
                        <li
                            key={program.id}
                            draggable={editId !== program.id}
                            onDragStart={(e) => handleDragStart(e, program.id)}
                            onDragOver={(e) => handleDragOver(e, program.id)}
                            onDrop={(e) => handleDrop(e, program.id)}
                            onDragEnd={handleDragEnd}
                            className={`transition ${dragOverId === program.id ? "bg-blue-50 border-blue-300" : "hover:bg-gray-50 dark:bg-gray-900/50"}`}
                        >
                            {editId === program.id ? (
                                <div className="p-6">
                                    <p className="text-sm font-bold text-blue-700 mb-3">수정 중...</p>
                                    <ProgramFormPanel
                                        mode="edit"
                                        program={program}
                                        onCancel={() => setEditId(null)}
                                        onSaved={() => {
                                            setEditId(null);
                                            void loadPrograms();
                                        }}
                                        onPendingChange={setFormPending}
                                    />
                                </div>
                            ) : (
                                <div className="flex items-start gap-0">
                                    {/* Drag handle */}
                                    <div
                                        className="flex-shrink-0 w-10 flex items-center justify-center self-stretch cursor-grab text-gray-300 hover:text-gray-500 dark:text-gray-400 select-none border-r border-gray-100 dark:border-gray-800"
                                        title="드래그하여 순서 변경"
                                    >
                                        <span className="text-xl leading-none">⠿</span>
                                    </div>
                                    <div className="flex-1 p-5">
                                        <ProgramCardInline
                                            program={program} index={i}
                                            onEdit={() => setEditId(program.id)}
                                            onDelete={() => handleDelete(program.id)}
                                            isDeleting={deletingId === program.id}
                                            deletePending={deletePending}
                                            onSetDeleting={() => setDeletingId(program.id)}
                                            onCancelDelete={() => setDeletingId(null)}
                                        />
                                    </div>
                                </div>
                            )}
                        </li>
                    ))}
                </ul>
            </div>

        </div>
    );
}

// ── Inline card (no onClick hell) ─────────────────────────────────────────────

function ProgramCardInline({
    program, index, onEdit, onDelete, isDeleting, deletePending, onSetDeleting, onCancelDelete,
}: {
    program: Program;
    index: number;
    onEdit: () => void;
    onDelete: () => void;
    isDeleting: boolean;
    deletePending: boolean;
    onSetDeleting: () => void;
    onCancelDelete: () => void;
}) {
    const days = program.days ? program.days.split(",").filter(Boolean) : [];
    const weekend = isWeekendOnly(days);
    const tiers = FREQ_TIERS.filter((t) => program[t.key] != null);
    const freq = program.weeklyFrequency || program.frequency;

    return (
        <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-4">
            <div className="flex-1 min-w-0">
                {/* Title row */}
                <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="bg-brand-navy-900 text-white text-xs font-black w-6 h-6 rounded-full flex items-center justify-center shrink-0">
                        {index + 1}
                    </span>
                    <h3 className="font-bold text-gray-900 dark:text-white text-lg">{program.name}</h3>
                    {/* Frequency badges */}
                    {tiers.length === 0 && freq && (
                        <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2.5 py-0.5 rounded-full">{freq}</span>
                    )}
                    {tiers.map((t) => (
                        <span key={t.key} className="bg-blue-100 text-blue-700 text-xs font-bold px-2.5 py-0.5 rounded-full">{t.label}</span>
                    ))}
                    {program.targetAge && (
                        <span className="bg-orange-50 text-orange-600 text-xs font-bold px-2.5 py-0.5 rounded-full border border-orange-200">
                            {program.targetAge}
                        </span>
                    )}
                    {/* Day badges */}
                    {days.length > 0 && days.map((d) => (
                        <span key={d} className={`text-xs font-bold px-2 py-0.5 rounded-full ${WEEKEND.has(d) ? "bg-orange-100 text-orange-700" : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"}`}>
                            {DAY_OPTIONS.find((o) => o.key === d)?.label || d}
                        </span>
                    ))}
                </div>

                {/* Pricing */}
                {tiers.length > 0 ? (
                    <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm mt-1">
                        {tiers.map((t) => {
                            const fee = displayShuttleFee(program.shuttleFeeOverride, t.key, weekend);
                            return (
                                <span key={t.key} className="text-gray-600 dark:text-gray-300">
                                    <span className="text-gray-400 text-xs">{t.label}</span>{" "}
                                    <strong className="text-brand-navy-900">{Number(program[t.key]).toLocaleString()}원</strong>
                                    {fee && (
                                        <span className="text-blue-500 ml-1 text-xs">+ 셔틀 {fee}</span>
                                    )}
                                </span>
                            );
                        })}
                        {weekend && (
                            <span className="text-xs text-orange-600 font-medium">🚌 셔틀 운행 없음</span>
                        )}
                        {!weekend && program.shuttleFeeOverride === 0 && (
                            <span className="text-xs text-gray-400">셔틀 없음</span>
                        )}
                    </div>
                ) : (
                    <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-600 dark:text-gray-300 mt-1">
                        <span>
                            <span className="text-gray-400">수강료</span>{" "}
                            <strong className="text-brand-navy-900">{program.price.toLocaleString()}원 / 월</strong>
                        </span>
                    </div>
                )}

                {program.description && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 whitespace-pre-line">{program.description}</p>
                )}
            </div>

            <div className="flex shrink-0 items-center gap-2">
                <button onClick={onEdit}
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium px-3 py-1.5 rounded hover:bg-blue-50 transition">
                    수정
                </button>
                {isDeleting ? (
                    <span className="flex items-center gap-1.5">
                        <button onClick={onDelete} disabled={deletePending}
                            className="text-sm text-red-600 hover:text-red-800 font-bold px-2 py-1">확인</button>
                        <span className="text-gray-300">/</span>
                        <button onClick={onCancelDelete}
                            className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-200 px-2 py-1">취소</button>
                    </span>
                ) : (
                    <button onClick={onSetDeleting}
                        className="text-sm text-red-500 hover:text-red-700 font-medium px-3 py-1.5 rounded hover:bg-red-50 transition">
                        삭제
                    </button>
                )}
            </div>
        </div>
    );
}
