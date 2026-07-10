"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
    addToWaitlist,
    removeFromWaitlist,
    offerWaitlistSpot,
    processWaitlistResponse,
} from "@/app/actions/admin";

// ── 타입 정의 ──────────────────────────────────────────────────────────────
type WaitlistItem = {
    id: string;
    studentId: string;
    classId: string;
    priority: number;
    status: string;
    offeredAt: string | null;
    respondBy: string | null;
    memo: string | null;
    createdAt: string;
    updatedAt: string;
    studentName: string;
    className: string;
    classDay: string;
    classStart: string;
    classEnd: string;
};

type CapacityInfo = {
    id: string;
    name: string;
    dayOfWeek: string;
    startTime: string;
    endTime: string;
    capacity: number;
    enrolled: number;
    remaining: number;
    waiting: number;
};

type Student = { id: string; name: string };
type ClassItem = { id: string; name: string; dayOfWeek: string; startTime: string; endTime: string; capacity: number };

type WaitlistPayload = {
    waitlist: WaitlistItem[];
    capacityInfo: CapacityInfo[];
    classes: ClassItem[];
};

// 요일 한글 변환
const DAY_LABELS: Record<string, string> = {
    Mon: "월", Tue: "화", Wed: "수", Thu: "목", Fri: "금", Sat: "토", Sun: "일",
};

// 상태 라벨 + 색상
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
    WAITING: { label: "대기중", color: "text-yellow-700", bg: "bg-yellow-100" },
    OFFERED: { label: "제안됨", color: "text-blue-700", bg: "bg-blue-100" },
    ENROLLED: { label: "등록완료", color: "text-green-700", bg: "bg-green-100" },
    CANCELLED: { label: "취소", color: "text-gray-500 dark:text-gray-400", bg: "bg-gray-100 dark:bg-gray-800" },
};

function WaitlistLoadingFallback() {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="space-y-2">
                    <div className="h-8 w-44 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                    <div className="h-4 w-80 rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
                </div>
                <div className="h-11 w-28 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, index) => (
                    <div
                        key={index}
                        className="h-32 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 animate-pulse"
                    />
                ))}
            </div>
            <div className="flex items-center gap-3">
                <div className="h-10 w-44 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse" />
                <div className="h-5 w-32 rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
            </div>
            <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, index) => (
                    <div
                        key={index}
                        className="h-40 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 animate-pulse"
                    />
                ))}
            </div>
        </div>
    );
}

function WaitlistErrorState({ onRetry }: { onRetry: () => void }) {
    return (
        <div className="rounded-2xl border border-red-100 bg-white p-8 text-center shadow-sm dark:border-red-900/40 dark:bg-gray-800">
            <span className="material-symbols-outlined mb-3 text-4xl text-red-500">error</span>
            <p className="font-bold text-gray-900 dark:text-white">대기자 정보를 불러오지 못했습니다.</p>
            <button
                type="button"
                onClick={onRetry}
                className="mt-4 rounded-xl bg-brand-orange-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-orange-600 dark:bg-brand-neon-lime dark:text-brand-navy-900"
            >
                다시 시도
            </button>
        </div>
    );
}

export default function WaitlistClient({
    waitlist: initialWaitlist,
    capacityInfo: initialCapacityInfo,
    classes: initialClasses,
}: {
    waitlist?: WaitlistItem[];
    capacityInfo?: CapacityInfo[];
    classes?: ClassItem[];
}) {
    const hasInitialData = Boolean(initialWaitlist && initialCapacityInfo && initialClasses);
    const [waitlist, setWaitlist] = useState<WaitlistItem[]>(initialWaitlist ?? []);
    const [capacityInfo, setCapacityInfo] = useState<CapacityInfo[]>(initialCapacityInfo ?? []);
    const [classes, setClasses] = useState<ClassItem[]>(initialClasses ?? []);
    const [loading, setLoading] = useState(!hasInitialData);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);
    const [students, setStudents] = useState<Student[]>([]);
    const [studentsLoaded, setStudentsLoaded] = useState(false);
    const [studentsLoading, setStudentsLoading] = useState(false);
    const [studentsError, setStudentsError] = useState<string | null>(null);
    // 필터: 특정 반만 보기
    const [filterClassId, setFilterClassId] = useState<string>("ALL");
    // 상태 필터: 활성(WAITING+OFFERED) or 전체
    const [showAll, setShowAll] = useState(false);

    const hasAnyData = waitlist.length > 0 || capacityInfo.length > 0 || classes.length > 0;

    const loadWaitlistData = useCallback(async () => {
        setLoading(true);
        setLoadError(null);

        try {
            const response = await fetch("/api/admin/waitlist", { cache: "no-store" });
            if (!response.ok) {
                throw new Error("Failed to load waitlist.");
            }
            const data = (await response.json()) as WaitlistPayload;
            setWaitlist(data.waitlist);
            setCapacityInfo(data.capacityInfo);
            setClasses(data.classes);
        } catch (error) {
            console.error("Failed to load waitlist:", error);
            setLoadError("failed");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (hasInitialData) return;
        void loadWaitlistData();
    }, [hasInitialData, loadWaitlistData]);

    const loadStudents = useCallback(async () => {
        if (studentsLoaded || studentsLoading) return;

        setStudentsLoading(true);
        setStudentsError(null);

        try {
            const response = await fetch("/api/admin/student-options");

            if (!response.ok) {
                throw new Error("Failed to load student options.");
            }

            const data = (await response.json()) as { students?: Student[] };
            setStudents(data.students ?? []);
            setStudentsLoaded(true);
        } catch (error) {
            console.error("Failed to load student options:", error);
            setStudentsError("원생 목록을 불러오지 못했습니다.");
        } finally {
            setStudentsLoading(false);
        }
    }, [studentsLoaded, studentsLoading]);

    // 활성 대기자만 필터링 (WAITING + OFFERED), showAll이면 전체
    const filteredList = useMemo(() => {
        let list = showAll
            ? waitlist
            : waitlist.filter((w) => w.status === "WAITING" || w.status === "OFFERED");
        if (filterClassId !== "ALL") {
            list = list.filter((w) => w.classId === filterClassId);
        }
        return list;
    }, [waitlist, filterClassId, showAll]);

    // 반별로 그룹핑
    const groupedByClass = useMemo(() => {
        const map = new Map<string, WaitlistItem[]>();
        for (const item of filteredList) {
            const key = item.classId;
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(item);
        }
        return map;
    }, [filteredList]);

    // 정원 초과 또는 대기 있는 반만 상단 카드에 표시
    const classesWithActivity = useMemo(
        () => capacityInfo.filter((c) => c.waiting > 0 || c.remaining <= 0),
        [capacityInfo],
    );

    // ── 액션 핸들러 ──────────────────────────────────────────────────────────
    async function handleOffer(id: string) {
        if (!confirm("이 대기자에게 자리를 제안하시겠습니까?")) return;
        setBusy(true);
        try {
            await offerWaitlistSpot(id);
            await loadWaitlistData();
        } catch (e: any) {
            alert(e.message || "자리 제안 실패");
        } finally {
            setBusy(false);
        }
    }

    async function handleAccept(id: string) {
        if (!confirm("수락 처리하시겠습니까? 수강 등록이 생성됩니다.")) return;
        setBusy(true);
        try {
            await processWaitlistResponse(id, true);
            await loadWaitlistData();
        } catch (e: any) {
            alert(e.message || "수락 처리 실패");
        } finally {
            setBusy(false);
        }
    }

    async function handleReject(id: string) {
        if (!confirm("거절 처리하시겠습니까?")) return;
        setBusy(true);
        try {
            await processWaitlistResponse(id, false);
            await loadWaitlistData();
        } catch (e: any) {
            alert(e.message || "거절 처리 실패");
        } finally {
            setBusy(false);
        }
    }

    async function handleCancel(id: string) {
        if (!confirm("대기를 취소하시겠습니까?")) return;
        setBusy(true);
        try {
            await removeFromWaitlist(id);
            await loadWaitlistData();
        } catch (e: any) {
            alert(e.message || "대기 취소 실패");
        } finally {
            setBusy(false);
        }
    }

    if (loading && !hasAnyData) {
        return <WaitlistLoadingFallback />;
    }

    if (loadError && !hasAnyData) {
        return <WaitlistErrorState onRetry={loadWaitlistData} />;
    }

    return (
        <div className="space-y-6">
            {/* 페이지 헤더 */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <span className="material-symbols-outlined text-3xl text-brand-orange-500 dark:text-brand-neon-lime">hourglass_top</span>
                        대기자 관리
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        반 정원 초과 시 대기열을 관리하고, 자리가 나면 학부모에게 알림을 보냅니다.
                    </p>
                </div>
                <button
                    onClick={() => {
                        setShowAddModal(true);
                        void loadStudents();
                    }}
                    className="flex items-center gap-2 bg-brand-orange-500 dark:bg-brand-neon-lime dark:text-brand-navy-900 text-white px-4 py-2.5 rounded-lg font-semibold hover:bg-brand-orange-600 dark:hover:bg-lime-400 transition-colors"
                >
                    <span className="material-symbols-outlined text-xl">person_add</span>
                    대기 등록
                </button>
            </div>

            {/* 반별 정원 현황 카드 */}
            {classesWithActivity.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {classesWithActivity.map((c) => (
                        <button
                            key={c.id}
                            onClick={() => setFilterClassId(filterClassId === c.id ? "ALL" : c.id)}
                            className={`p-4 rounded-xl border text-left transition-all ${
                                filterClassId === c.id
                                    ? "border-brand-orange-500 dark:border-brand-neon-lime bg-brand-orange-50 dark:bg-brand-neon-lime/10  ring-1 ring-brand-orange-500 dark:focus:ring-brand-neon-lime"
                                    : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300"
                            }`}
                        >
                            <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 truncate">{c.name}</p>
                            <p className="text-xs text-gray-400 mt-0.5">
                                {DAY_LABELS[c.dayOfWeek] ?? c.dayOfWeek} {c.startTime}~{c.endTime}
                            </p>
                            <div className="mt-3 flex items-end gap-3">
                                {/* 정원 바 */}
                                <div className="flex-1">
                                    <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                                        <span>등록 {c.enrolled}/{c.capacity}</span>
                                        <span>잔여 {c.remaining}</span>
                                    </div>
                                    <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all ${
                                                c.remaining <= 0 ? "bg-red-500" : c.remaining <= 2 ? "bg-yellow-500" : "bg-green-500"
                                            }`}
                                            style={{ width: `${Math.min(100, (c.enrolled / Math.max(c.capacity, 1)) * 100)}%` }}
                                        />
                                    </div>
                                </div>
                                {/* 대기자 수 */}
                                {c.waiting > 0 && (
                                    <div className="text-center">
                                        <span className="text-lg font-bold text-yellow-600">{c.waiting}</span>
                                        <p className="text-[10px] text-gray-400">대기</p>
                                    </div>
                                )}
                            </div>
                        </button>
                    ))}
                </div>
            )}

            {/* 필터 바 */}
            <div className="flex items-center gap-3 flex-wrap">
                <select
                    value={filterClassId}
                    onChange={(e) => setFilterClassId(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                    <option value="ALL">전체 반</option>
                    {classes.map((c) => (
                        <option key={c.id} value={c.id}>
                            {c.name} ({DAY_LABELS[c.dayOfWeek] ?? c.dayOfWeek})
                        </option>
                    ))}
                </select>

                <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={showAll}
                        onChange={(e) => setShowAll(e.target.checked)}
                        className="rounded border-gray-300"
                    />
                    완료/취소 항목 포함
                </label>

                <span className="text-sm text-gray-400 ml-auto">
                    총 {filteredList.length}건
                </span>
            </div>

            {/* 대기자 목록 — 반별 그룹핑 */}
            {filteredList.length === 0 ? (
                <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                    <span className="material-symbols-outlined text-5xl text-gray-300">hourglass_empty</span>
                    <p className="text-gray-400 mt-2">대기자가 없습니다</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {Array.from(groupedByClass.entries()).map(([classId, items]) => (
                        <div key={classId} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                            {/* 반 헤더 */}
                            <div className="px-5 py-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
                                <span className="material-symbols-outlined text-lg text-gray-500 dark:text-gray-400">school</span>
                                <span className="font-semibold text-gray-700 dark:text-gray-200">{items[0].className}</span>
                                <span className="text-xs text-gray-400">
                                    {DAY_LABELS[items[0].classDay] ?? items[0].classDay} {items[0].classStart}~{items[0].classEnd}
                                </span>
                                <span className="ml-auto text-xs text-gray-500 dark:text-gray-400">{items.length}명 대기</span>
                            </div>
                            {/* 대기자 행 */}
                            <div className="divide-y divide-gray-100">
                                {items.map((w, idx) => {
                                    const cfg = STATUS_CONFIG[w.status] ?? STATUS_CONFIG.WAITING;
                                    return (
                                        <div key={w.id} className="px-5 py-3 flex items-center gap-4">
                                            {/* 순번 */}
                                            <span className="text-sm font-mono text-gray-400 w-6 text-center">{idx + 1}</span>
                                            {/* 학생명 */}
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{w.studentName}</p>
                                                {w.memo && (
                                                    <p className="text-xs text-gray-400 truncate">{w.memo}</p>
                                                )}
                                            </div>
                                            {/* 상태 뱃지 */}
                                            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.bg} ${cfg.color}`}>
                                                {cfg.label}
                                            </span>
                                            {/* 응답 기한 (OFFERED일 때) */}
                                            {w.status === "OFFERED" && w.respondBy && (
                                                <span className="text-xs text-blue-500">
                                                    기한: {new Date(w.respondBy).toLocaleDateString("ko-KR")}
                                                </span>
                                            )}
                                            {/* 액션 버튼 */}
                                            <div className="flex items-center gap-1">
                                                {w.status === "WAITING" && (
                                                    <button
                                                        onClick={() => handleOffer(w.id)}
                                                        disabled={busy}
                                                        className="text-xs bg-blue-500 text-white px-3 py-1.5 rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors"
                                                        title="자리 제안"
                                                    >
                                                        자리 제안
                                                    </button>
                                                )}
                                                {w.status === "OFFERED" && (
                                                    <>
                                                        <button
                                                            onClick={() => handleAccept(w.id)}
                                                            disabled={busy}
                                                            className="text-xs bg-green-500 text-white px-3 py-1.5 rounded-lg hover:bg-green-600 disabled:opacity-50 transition-colors"
                                                        >
                                                            수락
                                                        </button>
                                                        <button
                                                            onClick={() => handleReject(w.id)}
                                                            disabled={busy}
                                                            className="text-xs bg-red-500 text-white px-3 py-1.5 rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors"
                                                        >
                                                            거절
                                                        </button>
                                                    </>
                                                )}
                                                {(w.status === "WAITING" || w.status === "OFFERED") && (
                                                    <button
                                                        onClick={() => handleCancel(w.id)}
                                                        disabled={busy}
                                                        className="text-xs text-gray-400 hover:text-red-500 px-2 py-1.5 transition-colors"
                                                        title="대기 취소"
                                                    >
                                                        <span className="material-symbols-outlined text-base">close</span>
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* 대기 등록 모달 */}
            {showAddModal && (
                <AddWaitlistModal
                    students={students}
                    studentsLoading={studentsLoading}
                    studentsError={studentsError}
                    onRetryLoadStudents={loadStudents}
                    classes={classes}
                    onClose={() => setShowAddModal(false)}
                    onDone={async () => {
                        setShowAddModal(false);
                        await loadWaitlistData();
                    }}
                />
            )}
        </div>
    );
}

// ── 대기 등록 모달 ──────────────────────────────────────────────────────────
function AddWaitlistModal({
    students,
    studentsLoading,
    studentsError,
    onRetryLoadStudents,
    classes,
    onClose,
    onDone,
}: {
    students: Student[];
    studentsLoading: boolean;
    studentsError: string | null;
    onRetryLoadStudents: () => Promise<void>;
    classes: ClassItem[];
    onClose: () => void;
    onDone: () => Promise<void> | void;
}) {
    const [studentId, setStudentId] = useState("");
    const [classId, setClassId] = useState("");
    const [memo, setMemo] = useState("");
    const [busy, setBusy] = useState(false);
    // 학생 검색 필터
    const [studentSearch, setStudentSearch] = useState("");

    const filteredStudents = useMemo(
        () => studentSearch.trim()
            ? students.filter((s) => s.name.includes(studentSearch.trim()))
            : students,
        [students, studentSearch],
    );

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!studentId || !classId) {
            alert("학생과 반을 선택해주세요.");
            return;
        }
        setBusy(true);
        try {
            await addToWaitlist(studentId, classId, memo || undefined);
            await onDone();
        } catch (err: any) {
            alert(err.message || "대기 등록 실패");
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
                <div className="flex items-center justify-between mb-5">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <span className="material-symbols-outlined text-brand-orange-500 dark:text-brand-neon-lime">person_add</span>
                        대기 등록
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:text-gray-300">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* 학생 선택 */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">학생 *</label>
                        <input
                            type="text"
                            placeholder="이름 검색..."
                            value={studentSearch}
                            onChange={(e) => setStudentSearch(e.target.value)}
                            disabled={studentsLoading || Boolean(studentsError)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-1"
                        />
                        <select
                            value={studentId}
                            onChange={(e) => setStudentId(e.target.value)}
                            disabled={studentsLoading || Boolean(studentsError)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                            size={5}
                        >
                            <option value="">
                                {studentsLoading ? "학생 목록 로딩 중..." : "-- 학생 선택 --"}
                            </option>
                            {filteredStudents.map((s) => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                        {studentsError && (
                            <div className="mt-2 flex items-center justify-between gap-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-200">
                                <span>{studentsError}</span>
                                <button
                                    type="button"
                                    onClick={() => void onRetryLoadStudents()}
                                    className="shrink-0 rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100 dark:border-red-800 dark:text-red-200 dark:hover:bg-red-900/40"
                                >
                                    다시 시도
                                </button>
                            </div>
                        )}
                        {!studentsLoading && !studentsError && students.length === 0 && (
                            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                                등록된 학생이 없습니다.
                            </p>
                        )}
                    </div>

                    {/* 반 선택 */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">반 *</label>
                        <select
                            value={classId}
                            onChange={(e) => setClassId(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                        >
                            <option value="">-- 반 선택 --</option>
                            {classes.map((c) => (
                                <option key={c.id} value={c.id}>
                                    {c.name} ({DAY_LABELS[c.dayOfWeek] ?? c.dayOfWeek} {c.startTime}~{c.endTime})
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* 메모 */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">메모 (선택)</label>
                        <input
                            type="text"
                            value={memo}
                            onChange={(e) => setMemo(e.target.value)}
                            placeholder="대기 사유나 참고사항"
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                        />
                    </div>

                    {/* 버튼 */}
                    <div className="flex justify-end gap-2 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 dark:text-gray-100"
                        >
                            취소
                        </button>
                        <button
                            type="submit"
                            disabled={busy}
                            className="px-5 py-2 bg-brand-orange-500 dark:bg-brand-neon-lime dark:text-brand-navy-900 text-white text-sm font-semibold rounded-lg hover:bg-brand-orange-600 dark:hover:bg-lime-400 disabled:opacity-50 transition-colors"
                        >
                            {busy ? "등록 중..." : "대기 등록"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
