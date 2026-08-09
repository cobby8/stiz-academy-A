"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
    bookMakeupSession,
    cancelMakeupSession,
    loadMakeupSlotAvailability,
    updateMakeupStatus,
} from "@/app/actions/admin";
import AdminModal from "@/components/admin/AdminModal";
// 잔여석 표시/판정은 서버(queries.ts)와 같은 계산식을 쓴다 — 화면만 낙관 표시하는 사고 방지
import { formatSeatLabel, isMakeupSlotFull } from "@/lib/makeup/capacity";

// ── 타입 정의 ──────────────────────────────────────────────────────────────
type MakeupItem = {
    id: string;
    studentId: string;
    originalClassId: string;
    originalDate: string;
    makeupClassId: string;
    makeupDate: string;
    status: string;
    requestId: string | null;
    createdAt: string;
    updatedAt: string;
    studentName: string;
    originalClassName: string;
    originalDay: string;
    makeupClassName: string;
    makeupDay: string;
    makeupStart: string;
    makeupEnd: string;
    programName: string;
};

type Student = {
    id: string;
    name: string;
    parent?: { name: string | null };
};

type ClassItem = {
    id: string;
    name: string;
    dayOfWeek: string;
    startTime: string;
    endTime: string;
    capacity: number;
    programId: string;
    program: { id: string; name: string } | null;
};

type MakeupSlot = {
    id: string;
    name: string;
    dayOfWeek: string;
    startTime: string;
    endTime: string;
    capacity: number;
    enrolled: number;
    bookedMakeups: number;
    remaining: number;
};

type MakeupPayload = {
    sessions: MakeupItem[];
    classes: ClassItem[];
};

// 요일 한글 변환
const DAY_LABELS: Record<string, string> = {
    Mon: "월", Tue: "화", Wed: "수", Thu: "목", Fri: "금", Sat: "토", Sun: "일",
};

// 상태 라벨 + 색상
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
    BOOKED:    { label: "예약", color: "text-[var(--doc-ink-2)]", bg: "bg-[var(--doc-grid-head)]" },
    ATTENDED:  { label: "출석", color: "text-[var(--doc-accent)]", bg: "bg-[var(--doc-accent-soft)]" },
    CANCELLED: { label: "취소", color: "text-[var(--doc-ink-2)] ", bg: "bg-[var(--doc-grid-head)] " },
    NO_SHOW:   { label: "노쇼", color: "text-[var(--doc-crit)]", bg: "bg-[var(--doc-crit-soft)]" },
};

// 상태 필터 탭 목록
const STATUS_TABS = [
    { key: "ALL", label: "전체" },
    { key: "BOOKED", label: "예약" },
    { key: "ATTENDED", label: "출석" },
    { key: "CANCELLED", label: "취소" },
    { key: "NO_SHOW", label: "노쇼" },
];

function MakeupLoadingFallback() {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="space-y-2">
                    <div className="h-8 w-32 rounded bg-[var(--doc-grid-head)]" />
                    <div className="h-4 w-72 rounded bg-[var(--doc-grid-head)]" />
                </div>
                <div className="h-10 w-28 rounded-[3px] bg-[var(--doc-grid-head)]" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, index) => (
                    <div
                        key={index}
                        className="h-24 rounded-[3px] border border-[var(--doc-rule)] bg-[var(--doc-surface)]"
                    />
                ))}
            </div>
            <div className="h-10 w-80 rounded-[3px] bg-[var(--doc-grid-head)]" />
            <div className="rounded-[3px] border border-[var(--doc-rule)] bg-[var(--doc-surface)] overflow-hidden">
                {Array.from({ length: 8 }).map((_, index) => (
                    <div
                        key={index}
                        className="h-14 border-b border-[var(--doc-rule)] last:border-b-0 bg-[var(--doc-grid-head)]/60"
                    />
                ))}
            </div>
        </div>
    );
}

function MakeupErrorState({ onRetry }: { onRetry: () => void }) {
    return (
        <div className="rounded-[6px] border border-[var(--doc-crit)] bg-[var(--doc-surface)] p-8 text-center">
            <span className="material-symbols-outlined mb-3 text-4xl text-[var(--doc-crit)]">error</span>
            <p className="font-bold text-[var(--doc-ink)]">보강 예약 정보를 불러오지 못했습니다.</p>
            <button
                type="button"
                onClick={onRetry}
                className="mt-4 rounded-[3px] bg-[var(--doc-accent)] px-4 py-2 text-sm font-bold text-white transition hover:bg-[var(--doc-grid-head)] dark:text-[var(--doc-ink)]"
            >
                다시 시도
            </button>
        </div>
    );
}

export default function MakeupClient({
    sessions: initialSessions,
    classes: initialClasses,
}: {
    sessions?: MakeupItem[];
    classes?: ClassItem[];
}) {
    const hasInitialData = Boolean(initialSessions && initialClasses);
    const [sessions, setSessions] = useState<MakeupItem[]>(initialSessions ?? []);
    const [classes, setClasses] = useState<ClassItem[]>(initialClasses ?? []);
    const [loading, setLoading] = useState(!hasInitialData);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [showBookModal, setShowBookModal] = useState(false);
    const [students, setStudents] = useState<Student[]>([]);
    const [studentsLoaded, setStudentsLoaded] = useState(false);
    const [studentsLoading, setStudentsLoading] = useState(false);
    const [studentsError, setStudentsError] = useState<string | null>(null);

    const hasAnyData = sessions.length > 0 || classes.length > 0;

    const loadMakeupData = useCallback(async () => {
        setLoading(true);
        setLoadError(null);

        try {
            const response = await fetch("/api/admin/makeup", { cache: "no-store" });
            if (!response.ok) {
                throw new Error("Failed to load makeup data.");
            }
            const data = (await response.json()) as MakeupPayload;
            setSessions(data.sessions);
            setClasses(data.classes);
        } catch (error) {
            console.error("Failed to load makeup data:", error);
            setLoadError("failed");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (hasInitialData) return;
        void loadMakeupData();
    }, [hasInitialData, loadMakeupData]);

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

    // 상태별 필터링
    const filteredSessions = useMemo(() => {
        if (statusFilter === "ALL") return sessions;
        return sessions.filter((s) => s.status === statusFilter);
    }, [sessions, statusFilter]);

    // 상태별 카운트 (요약 카드용)
    const statusCounts = useMemo(() => {
        const counts: Record<string, number> = { BOOKED: 0, ATTENDED: 0, CANCELLED: 0, NO_SHOW: 0 };
        sessions.forEach((s) => {
            if (counts[s.status] !== undefined) counts[s.status]++;
        });
        return counts;
    }, [sessions]);

    // 날짜 포맷 (YYYY-MM-DD)
    function fmtDate(d: string | null) {
        if (!d) return "-";
        try {
            return new Date(d).toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" });
        } catch {
            return "-";
        }
    }

    // 상태 변경 핸들러
    async function handleStatusChange(id: string, newStatus: string) {
        if (busy) return;
        setBusy(true);
        try {
            await updateMakeupStatus(id, newStatus);
            await loadMakeupData();
        } catch (e: any) {
            alert(e.message || "상태 변경 실패");
        } finally {
            setBusy(false);
        }
    }

    // 보강 취소 핸들러
    async function handleCancel(id: string) {
        if (busy) return;
        if (!confirm("이 보강 예약을 취소하시겠습니까?")) return;
        setBusy(true);
        try {
            await cancelMakeupSession(id);
            await loadMakeupData();
        } catch (e: any) {
            alert(e.message || "취소 실패");
        } finally {
            setBusy(false);
        }
    }

    if (loading && !hasAnyData) {
        return <MakeupLoadingFallback />;
    }

    if (loadError && !hasAnyData) {
        return <MakeupErrorState onRetry={loadMakeupData} />;
    }

    return (
        <div className="space-y-6">
            {/* 페이지 제목 + 예약 버튼 */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-[var(--doc-ink)]">보강 관리</h1>
                </div>
                <button
                    onClick={() => {
                        setShowBookModal(true);
                        void loadStudents();
                    }}
                    className="px-4 py-2 bg-[var(--doc-grid-head)] text-white rounded-[3px] hover:bg-[var(--doc-grid-head)] transition-colors flex items-center gap-2"
                >
                    <span className="material-symbols-outlined text-[20px]">event_repeat</span>
                    보강 예약
                </button>
            </div>

            {/* 요약 카드 — 건수만 보여주는 표시용. 필터링은 아래 상태 탭에서만 한다 (같은 기능이 두 곳에 있어 혼란스러웠음) */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                    <div
                        key={key}
                        className="p-4 rounded-[3px] border border-[var(--doc-rule)]"
                    >
                        <p className="text-sm text-[var(--doc-ink-2)]">{cfg.label}</p>
                        <p className="text-2xl font-bold mt-1">{statusCounts[key] ?? 0}</p>
                    </div>
                ))}
            </div>

            {/* 상태 필터 탭 */}
            <div className="flex gap-1 bg-[var(--doc-grid-head)] p-1 rounded-[3px] w-fit">
                {STATUS_TABS.map((tab) => (
                    <button
                        key={tab.key}
                        onClick={() => setStatusFilter(tab.key)}
                        className={`px-4 py-1.5 text-sm font-medium rounded-[3px] transition-colors ${
 statusFilter === tab.key
 ? "bg-[var(--doc-surface)] text-[var(--doc-ink)] "
 : "text-[var(--doc-ink-2)] hover:text-[var(--doc-ink-2)] "
 }`}
                    >
                        {tab.label}
                        {tab.key !== "ALL" && (
                            <span className="ml-1 text-xs text-[var(--doc-ink-3)]">
                                {statusCounts[tab.key] ?? 0}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* 보강 목록 테이블 */}
            {filteredSessions.length === 0 ? (
                <div className="text-center py-16 text-[var(--doc-ink-3)]">
                    <span className="material-symbols-outlined text-5xl mb-3 block">event_busy</span>
                    <p>보강 예약이 없습니다</p>
                </div>
            ) : (
                <div className="overflow-x-auto bg-[var(--doc-surface)] rounded-[3px] border border-[var(--doc-rule)]">
                    <table className="w-full text-sm">
                        <thead className="bg-[var(--doc-grid-head)] border-b border-[var(--doc-rule)]">
                            <tr>
                                <th className="text-left px-4 py-3 font-semibold text-[var(--doc-ink-2)]">원생</th>
                                <th className="text-left px-4 py-3 font-semibold text-[var(--doc-ink-2)]">원래 반</th>
                                <th className="text-left px-4 py-3 font-semibold text-[var(--doc-ink-2)]">결석일</th>
                                <th className="text-left px-4 py-3 font-semibold text-[var(--doc-ink-2)]">보강 반</th>
                                <th className="text-left px-4 py-3 font-semibold text-[var(--doc-ink-2)]">보강일</th>
                                <th className="text-left px-4 py-3 font-semibold text-[var(--doc-ink-2)]">상태</th>
                                <th className="text-right px-4 py-3 font-semibold text-[var(--doc-ink-2)]">관리</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--doc-rule)]">
                            {filteredSessions.map((item) => {
                                const cfg = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.BOOKED;
                                return (
                                    <tr key={item.id} className="hover:bg-[var(--doc-grid-head)]">
                                        <td className="px-4 py-3 font-medium text-[var(--doc-ink)]">
                                            {item.studentName}
                                        </td>
                                        <td className="px-4 py-3 text-[var(--doc-ink-2)]">
                                            {item.originalClassName}
                                            <span className="text-[var(--doc-ink-3)] ml-1">
                                                ({DAY_LABELS[item.originalDay] ?? item.originalDay})
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-[var(--doc-ink-2)]">{fmtDate(item.originalDate)}</td>
                                        <td className="px-4 py-3 text-[var(--doc-ink-2)]">
                                            {item.makeupClassName}
                                            <span className="text-[var(--doc-ink-3)] ml-1">
                                                ({DAY_LABELS[item.makeupDay] ?? item.makeupDay})
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-[var(--doc-ink-2)]">{fmtDate(item.makeupDate)}</td>
                                        <td className="px-4 py-3">
                                            {/* 상태 드롭다운: BOOKED일 때만 변경 가능 */}
                                            {item.status === "BOOKED" ? (
                                                <select
                                                    className={`text-xs font-semibold px-2 py-1 rounded-[3px] border-0 ${cfg.bg} ${cfg.color}`}
                                                    value={item.status}
                                                    onChange={(e) => handleStatusChange(item.id, e.target.value)}
                                                    disabled={busy}
                                                >
                                                    <option value="BOOKED">예약</option>
                                                    <option value="ATTENDED">출석</option>
                                                    <option value="NO_SHOW">노쇼</option>
                                                    <option value="CANCELLED">취소</option>
                                                </select>
                                            ) : (
                                                <span className={`text-xs font-semibold px-2 py-1 rounded-[3px] ${cfg.bg} ${cfg.color}`}>
                                                    {cfg.label}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            {item.status === "BOOKED" && (
                                                <button
                                                    onClick={() => handleCancel(item.id)}
                                                    disabled={busy}
                                                    className="text-xs text-[var(--doc-crit)] hover:text-[var(--doc-crit)] font-medium"
                                                >
                                                    취소
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* 보강 예약 모달 */}
            {showBookModal && (
                <BookMakeupModal
                    students={students}
                    studentsLoading={studentsLoading}
                    studentsError={studentsError}
                    onRetryLoadStudents={loadStudents}
                    classes={classes}
                    onClose={() => setShowBookModal(false)}
                    onSuccess={async () => {
                        setShowBookModal(false);
                        await loadMakeupData();
                    }}
                />
            )}
        </div>
    );
}

// ── 보강 예약 모달 ─────────────────────────────────────────────────────────

function BookMakeupModal({
    students,
    studentsLoading,
    studentsError,
    onRetryLoadStudents,
    classes,
    onClose,
    onSuccess,
}: {
    students: Student[];
    studentsLoading: boolean;
    studentsError: string | null;
    onRetryLoadStudents: () => Promise<void>;
    classes: ClassItem[];
    onClose: () => void;
    onSuccess: () => Promise<void> | void;
}) {
    const [step, setStep] = useState(1); // 1: 학생+원래반 선택, 2: 보강반 선택
    const [studentId, setStudentId] = useState("");
    const [originalClassId, setOriginalClassId] = useState("");
    const [originalDate, setOriginalDate] = useState("");
    const [makeupClassId, setMakeupClassId] = useState("");
    const [makeupDate, setMakeupDate] = useState("");
    const [availableSlots, setAvailableSlots] = useState<MakeupSlot[]>([]);
    const [loading, setLoading] = useState(false);
    const [busy, setBusy] = useState(false);
    // 잔여석을 서버에서 실제로 받아왔는지 여부. false면 "확인 중"으로 중립 표시한다.
    const [seatsLoaded, setSeatsLoaded] = useState(false);

    // 학생 검색 필터
    const [studentSearch, setStudentSearch] = useState("");

    // 선택한 원래 반의 프로그램/정보
    const selectedClass = classes.find((c) => c.id === originalClassId);

    // 학생 필터링 (이름 검색)
    const filteredStudents = useMemo(() => {
        if (!studentSearch) return students;
        return students.filter((s) => s.name.includes(studentSearch));
    }, [students, studentSearch]);

    // 보강 반 후보 목록 — 같은 프로그램의 다른 반. 잔여석은 "모름" 상태로 둔다.
    // (예전에는 remaining 에 총정원을 넣어 빈자리인 것처럼 보여줘 정원 초과 예약이 났다)
    const buildBaseSlots = useCallback((): MakeupSlot[] => {
        if (!selectedClass?.programId || !originalClassId) return [];
        return classes
            .filter((c) => c.programId === selectedClass.programId && c.id !== originalClassId)
            .map((c) => ({
                id: c.id,
                name: c.name,
                dayOfWeek: c.dayOfWeek,
                startTime: c.startTime,
                endTime: c.endTime,
                capacity: c.capacity,
                enrolled: 0,
                bookedMakeups: 0,
                remaining: 0, // seatsLoaded=false 이므로 화면에는 "확인 중"으로만 표시된다
            }));
    }, [classes, originalClassId, selectedClass?.programId]);

    // 보강일이 정해지면 그 날짜 기준 실제 잔여석을 서버에서 조회한다.
    useEffect(() => {
        if (step !== 2) return;
        const programId = selectedClass?.programId;
        if (!programId || !originalClassId) return;

        // 날짜 미선택 → 잔여석을 알 수 없는 상태. 총정원을 잔여석처럼 보여주지 않는다.
        if (!/^\d{4}-\d{2}-\d{2}$/.test(makeupDate)) {
            setAvailableSlots(buildBaseSlots());
            setSeatsLoaded(false);
            return;
        }

        let aborted = false;
        setLoading(true);
        loadMakeupSlotAvailability({ programId, excludeClassId: originalClassId, makeupDate })
            .then((res) => {
                if (aborted) return;
                if (res?.ok && Array.isArray(res.slots)) {
                    setAvailableSlots(res.slots as MakeupSlot[]);
                    setSeatsLoaded(true); // 실제 잔여석 확보
                } else {
                    setAvailableSlots(buildBaseSlots());
                    setSeatsLoaded(false);
                }
            })
            .catch((e) => {
                if (aborted) return;
                console.error("Failed to load makeup slot availability:", e);
                setAvailableSlots(buildBaseSlots());
                setSeatsLoaded(false); // 실패 시에도 낙관 표시 금지
            })
            .finally(() => {
                if (!aborted) setLoading(false);
            });

        return () => {
            aborted = true;
        };
    }, [step, makeupDate, originalClassId, selectedClass?.programId, buildBaseSlots]);

    // 잔여석을 받아본 결과 이미 선택해 둔 반이 마감이면 선택을 해제한다.
    useEffect(() => {
        if (!seatsLoaded || !makeupClassId) return;
        const picked = availableSlots.find((s) => s.id === makeupClassId);
        if (picked && isMakeupSlotFull(picked)) setMakeupClassId("");
    }, [seatsLoaded, availableSlots, makeupClassId]);

    // 다음 단계로 이동
    function goToStep2() {
        if (!studentId || !originalClassId || !originalDate) {
            alert("원생, 원래 반, 결석일을 모두 선택해주세요");
            return;
        }
        setStep(2); // 슬롯/잔여석은 위 useEffect가 채운다
    }

    // 예약 실행
    async function handleBook() {
        if (!makeupClassId || !makeupDate) {
            alert("보강 반과 보강일을 선택해주세요");
            return;
        }
        // 마감된 반은 화면에서도 막는다(최종 판단은 서버가 다시 한다).
        const picked = availableSlots.find((s) => s.id === makeupClassId);
        if (seatsLoaded && picked && isMakeupSlotFull(picked)) {
            alert("이미 정원이 찼습니다. 다른 날짜나 반을 선택해 주세요.");
            return;
        }
        setBusy(true);
        try {
            await bookMakeupSession({
                studentId,
                originalClassId,
                originalDate,
                makeupClassId,
                makeupDate,
            });
            await onSuccess();
        } catch (e: any) {
            alert(e.message || "보강 예약 실패");
        } finally {
            setBusy(false);
        }
    }

    return (
        <AdminModal
            titleId="book-makeup-title"
            onClose={onClose}
            closeOnBackdrop={false}
            panelClassName="max-w-lg"
        >
            <div className="w-full">
                {/* 모달 헤더 */}
                <div className="flex items-center justify-between p-6 border-b border-[var(--doc-rule)]">
                    <h2 id="book-makeup-title" className="text-lg font-bold text-[var(--doc-ink)]">
                        {step === 1 ? "보강 예약 - 원생/결석 정보" : "보강 예약 - 보강 반 선택"}
                    </h2>
                    <button onClick={onClose} className="text-[var(--doc-ink-3)] hover:text-[var(--doc-ink-2)]">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    {step === 1 && (
                        <>
                            {/* 원생 선택 */}
                            <div>
                                <label className="block text-sm font-medium text-[var(--doc-ink-2)] mb-1">원생 선택</label>
                                <input
                                    type="text"
                                    placeholder="이름 검색..."
                                    value={studentSearch}
                                    onChange={(e) => setStudentSearch(e.target.value)}
                                    disabled={studentsLoading || Boolean(studentsError)}
                                    className="w-full border border-[var(--doc-rule)] rounded-[3px] px-3 py-2 text-sm mb-2"
                                />
                                <select
                                    value={studentId}
                                    onChange={(e) => setStudentId(e.target.value)}
                                    disabled={studentsLoading || Boolean(studentsError)}
                                    className="w-full border border-[var(--doc-rule)] rounded-[3px] px-3 py-2 text-sm"
                                    size={5}
                                >
                                    <option value="">
                                        {studentsLoading ? "원생 목록 로딩 중..." : "-- 원생 선택 --"}
                                    </option>
                                    {filteredStudents.map((s) => (
                                        <option key={s.id} value={s.id}>
                                            {s.name}
                                        </option>
                                    ))}
                                </select>
                                {studentsError && (
                                    <div className="mt-2 flex items-center justify-between gap-3 rounded-[3px] bg-[var(--doc-crit-soft)] px-3 py-2 text-sm text-[var(--doc-crit)]">
                                        <span>{studentsError}</span>
                                        <button
                                            type="button"
                                            onClick={() => void onRetryLoadStudents()}
                                            className="shrink-0 rounded-[3px] border border-[var(--doc-crit)] px-2 py-1 text-xs font-medium text-[var(--doc-crit)] hover:bg-[var(--doc-crit-soft)]"
                                        >
                                            다시 시도
                                        </button>
                                    </div>
                                )}
                                {!studentsLoading && !studentsError && students.length === 0 && (
                                    <p className="mt-2 text-sm text-[var(--doc-ink-2)]">
                                        등록된 원생이 없습니다.
                                    </p>
                                )}
                            </div>

                            {/* 원래 반 선택 */}
                            <div>
                                <label className="block text-sm font-medium text-[var(--doc-ink-2)] mb-1">원래 반 (결석한 반)</label>
                                <select
                                    value={originalClassId}
                                    onChange={(e) => setOriginalClassId(e.target.value)}
                                    className="w-full border border-[var(--doc-rule)] rounded-[3px] px-3 py-2 text-sm"
                                >
                                    <option value="">-- 반 선택 --</option>
                                    {classes.map((c) => (
                                        <option key={c.id} value={c.id}>
                                            {c.name} ({DAY_LABELS[c.dayOfWeek] ?? c.dayOfWeek} {c.startTime}~{c.endTime})
                                            {c.program ? ` - ${c.program.name}` : ""}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* 결석일 */}
                            <div>
                                <label className="block text-sm font-medium text-[var(--doc-ink-2)] mb-1">결석일</label>
                                <input
                                    type="date"
                                    min="2020-01-01" max="2030-12-31"
                                    value={originalDate}
                                    onChange={(e) => setOriginalDate(e.target.value)}
                                    className="w-full border border-[var(--doc-rule)] rounded-[3px] px-3 py-2 text-sm"
                                />
                            </div>

                            <button
                                onClick={goToStep2}
                                className="w-full py-2.5 bg-[var(--doc-grid-head)] text-white rounded-[3px] hover:bg-[var(--doc-grid-head)] font-medium transition-colors"
                            >
                                다음: 보강 반 선택
                            </button>
                        </>
                    )}

                    {step === 2 && (
                        <>
                            {/* 선택된 정보 요약 */}
                            <div className="bg-[var(--doc-grid-head)] rounded-[3px] p-3 text-sm space-y-1">
                                <p>
                                    <span className="text-[var(--doc-ink-2)]">원생:</span>{" "}
                                    <span className="font-medium">{students.find((s) => s.id === studentId)?.name}</span>
                                </p>
                                <p>
                                    <span className="text-[var(--doc-ink-2)]">원래 반:</span>{" "}
                                    <span className="font-medium">
                                        {selectedClass?.name} ({DAY_LABELS[selectedClass?.dayOfWeek ?? ""] ?? selectedClass?.dayOfWeek})
                                    </span>
                                </p>
                                <p>
                                    <span className="text-[var(--doc-ink-2)]">결석일:</span>{" "}
                                    <span className="font-medium">{originalDate}</span>
                                </p>
                            </div>

                            {/* 보강 반 선택 */}
                            <div>
                                <label className="block text-sm font-medium text-[var(--doc-ink-2)] mb-1">
                                    보강 반 선택 (같은 프로그램: {selectedClass?.program?.name ?? "미지정"})
                                </label>
                                {loading ? (
                                    <p className="text-sm text-[var(--doc-ink-3)] py-4 text-center">조회 중...</p>
                                ) : availableSlots.length === 0 ? (
                                    <p className="text-sm text-[var(--doc-ink-3)] py-4 text-center">
                                        같은 프로그램의 다른 반이 없습니다
                                    </p>
                                ) : (
                                    <div className="space-y-2">
                                        {!seatsLoaded && (
                                            <p className="text-xs text-[var(--doc-ink-2)]">
                                                아래 &quot;보강 수업일&quot;을 선택하면 그 날짜의 실제 잔여석이 표시됩니다.
                                            </p>
                                        )}
                                        {availableSlots.map((slot) => {
                                            // 잔여석을 실제로 확인한 경우에만 마감 판정(모르면 막지 않고 서버가 최종 검증)
                                            const full = seatsLoaded && isMakeupSlotFull(slot);
                                            return (
                                            <label
                                                key={slot.id}
                                                className={`flex items-center gap-3 p-3 border rounded-[3px] transition-all ${
 full
 ? "border-[var(--doc-rule)] opacity-60 cursor-not-allowed"
 : makeupClassId === slot.id
 ? "border-[var(--doc-rule)] bg-[var(--doc-grid-head)] cursor-pointer"
 : "border-[var(--doc-rule)] hover:border-[var(--doc-rule)] cursor-pointer"
 }`}
                                            >
                                                <input
                                                    type="radio"
                                                    name="makeupClass"
                                                    value={slot.id}
                                                    checked={makeupClassId === slot.id}
                                                    onChange={() => setMakeupClassId(slot.id)}
                                                    disabled={full}
                                                    className="accent-blue-600"
                                                />
                                                <div className="flex-1">
                                                    <p className="font-medium text-sm">{slot.name}</p>
                                                    <p className="text-xs text-[var(--doc-ink-2)]">
                                                        {DAY_LABELS[slot.dayOfWeek] ?? slot.dayOfWeek}요일 {slot.startTime}~{slot.endTime}
                                                        {" / "}
                                                        {/* 잔여 N석 · 정원 M명 (아직 모르면 "잔여석 확인 중") */}
                                                        <span className={full ? "font-semibold text-[var(--doc-crit)]" : ""}>
                                                            {formatSeatLabel(slot, seatsLoaded)}
                                                        </span>
                                                    </p>
                                                </div>
                                            </label>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* 보강일 */}
                            <div>
                                <label className="block text-sm font-medium text-[var(--doc-ink-2)] mb-1">보강 수업일</label>
                                <input
                                    type="date"
                                    min="2020-01-01" max="2030-12-31"
                                    value={makeupDate}
                                    onChange={(e) => setMakeupDate(e.target.value)}
                                    className="w-full border border-[var(--doc-rule)] rounded-[3px] px-3 py-2 text-sm"
                                />
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setStep(1)}
                                    className="flex-1 py-2.5 border border-[var(--doc-rule)] text-[var(--doc-ink-2)] rounded-[3px] hover:bg-[var(--doc-grid-head)] font-medium transition-colors"
                                >
                                    이전
                                </button>
                                <button
                                    onClick={handleBook}
                                    disabled={busy || !makeupClassId || !makeupDate}
                                    className="flex-1 py-2.5 bg-[var(--doc-grid-head)] text-white rounded-[3px] hover:bg-[var(--doc-grid-head)] font-medium transition-colors disabled:opacity-50"
                                >
                                    {busy ? "처리 중..." : "보강 예약"}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </AdminModal>
    );
}
