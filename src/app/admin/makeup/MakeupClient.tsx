"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
    bookMakeupSession,
    cancelMakeupSession,
    updateMakeupStatus,
} from "@/app/actions/admin";
import { getAvailableMakeupSlots } from "@/lib/queries";

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

// 요일 한글 변환
const DAY_LABELS: Record<string, string> = {
    Mon: "월", Tue: "화", Wed: "수", Thu: "목", Fri: "금", Sat: "토", Sun: "일",
};

// 상태 라벨 + 색상
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
    BOOKED:    { label: "예약", color: "text-blue-700", bg: "bg-blue-100" },
    ATTENDED:  { label: "출석", color: "text-green-700", bg: "bg-green-100" },
    CANCELLED: { label: "취소", color: "text-gray-500", bg: "bg-gray-100" },
    NO_SHOW:   { label: "노쇼", color: "text-red-700", bg: "bg-red-100" },
};

// 상태 필터 탭 목록
const STATUS_TABS = [
    { key: "ALL", label: "전체" },
    { key: "BOOKED", label: "예약" },
    { key: "ATTENDED", label: "출석" },
    { key: "CANCELLED", label: "취소" },
    { key: "NO_SHOW", label: "노쇼" },
];

export default function MakeupClient({
    sessions,
    students,
    classes,
}: {
    sessions: MakeupItem[];
    students: Student[];
    classes: ClassItem[];
}) {
    const router = useRouter();
    const [busy, setBusy] = useState(false);
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [showBookModal, setShowBookModal] = useState(false);

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
            router.refresh();
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
            router.refresh();
        } catch (e: any) {
            alert(e.message || "취소 실패");
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="space-y-6">
            {/* 페이지 제목 + 예약 버튼 */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">보강 관리</h1>
                    <p className="text-sm text-gray-500 mt-1">결석 학생의 보강 수업을 예약하고 관리합니다</p>
                </div>
                <button
                    onClick={() => setShowBookModal(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                    <span className="material-symbols-outlined text-[20px]">event_repeat</span>
                    보강 예약
                </button>
            </div>

            {/* 요약 카드 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                    <div
                        key={key}
                        className={`p-4 rounded-xl border cursor-pointer transition-all ${
                            statusFilter === key ? "ring-2 ring-blue-500 border-blue-300" : "border-gray-200"
                        }`}
                        onClick={() => setStatusFilter(statusFilter === key ? "ALL" : key)}
                    >
                        <p className="text-sm text-gray-500">{cfg.label}</p>
                        <p className="text-2xl font-bold mt-1">{statusCounts[key] ?? 0}</p>
                    </div>
                ))}
            </div>

            {/* 상태 필터 탭 */}
            <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
                {STATUS_TABS.map((tab) => (
                    <button
                        key={tab.key}
                        onClick={() => setStatusFilter(tab.key)}
                        className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                            statusFilter === tab.key
                                ? "bg-white text-gray-900 shadow-sm"
                                : "text-gray-500 hover:text-gray-700"
                        }`}
                    >
                        {tab.label}
                        {tab.key !== "ALL" && (
                            <span className="ml-1 text-xs text-gray-400">
                                {statusCounts[tab.key] ?? 0}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* 보강 목록 테이블 */}
            {filteredSessions.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                    <span className="material-symbols-outlined text-5xl mb-3 block">event_busy</span>
                    <p>보강 예약이 없습니다</p>
                </div>
            ) : (
                <div className="overflow-x-auto bg-white rounded-xl border border-gray-200">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="text-left px-4 py-3 font-semibold text-gray-600">원생</th>
                                <th className="text-left px-4 py-3 font-semibold text-gray-600">원래 반</th>
                                <th className="text-left px-4 py-3 font-semibold text-gray-600">결석일</th>
                                <th className="text-left px-4 py-3 font-semibold text-gray-600">보강 반</th>
                                <th className="text-left px-4 py-3 font-semibold text-gray-600">보강일</th>
                                <th className="text-left px-4 py-3 font-semibold text-gray-600">상태</th>
                                <th className="text-right px-4 py-3 font-semibold text-gray-600">관리</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredSessions.map((item) => {
                                const cfg = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.BOOKED;
                                return (
                                    <tr key={item.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-3 font-medium text-gray-900">
                                            {item.studentName}
                                        </td>
                                        <td className="px-4 py-3 text-gray-600">
                                            {item.originalClassName}
                                            <span className="text-gray-400 ml-1">
                                                ({DAY_LABELS[item.originalDay] ?? item.originalDay})
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-gray-600">{fmtDate(item.originalDate)}</td>
                                        <td className="px-4 py-3 text-gray-600">
                                            {item.makeupClassName}
                                            <span className="text-gray-400 ml-1">
                                                ({DAY_LABELS[item.makeupDay] ?? item.makeupDay})
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-gray-600">{fmtDate(item.makeupDate)}</td>
                                        <td className="px-4 py-3">
                                            {/* 상태 드롭다운: BOOKED일 때만 변경 가능 */}
                                            {item.status === "BOOKED" ? (
                                                <select
                                                    className={`text-xs font-semibold px-2 py-1 rounded-full border-0 ${cfg.bg} ${cfg.color}`}
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
                                                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${cfg.bg} ${cfg.color}`}>
                                                    {cfg.label}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            {item.status === "BOOKED" && (
                                                <button
                                                    onClick={() => handleCancel(item.id)}
                                                    disabled={busy}
                                                    className="text-xs text-red-600 hover:text-red-800 font-medium"
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
                    classes={classes}
                    onClose={() => setShowBookModal(false)}
                    onSuccess={() => {
                        setShowBookModal(false);
                        router.refresh();
                    }}
                />
            )}
        </div>
    );
}

// ── 보강 예약 모달 ─────────────────────────────────────────────────────────

function BookMakeupModal({
    students,
    classes,
    onClose,
    onSuccess,
}: {
    students: Student[];
    classes: ClassItem[];
    onClose: () => void;
    onSuccess: () => void;
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

    // 학생 검색 필터
    const [studentSearch, setStudentSearch] = useState("");

    // 선택한 원래 반의 프로그램/정보
    const selectedClass = classes.find((c) => c.id === originalClassId);

    // 학생 필터링 (이름 검색)
    const filteredStudents = useMemo(() => {
        if (!studentSearch) return students;
        return students.filter((s) => s.name.includes(studentSearch));
    }, [students, studentSearch]);

    // 빈자리 조회 — 원래 반 선택 후 같은 프로그램의 다른 반 조회
    async function fetchSlots() {
        if (!selectedClass?.programId || !originalClassId) return;
        setLoading(true);
        try {
            // Server Action이 아닌 쿼리 함수이므로 직접 호출 불가
            // API route를 통해 조회하거나, 이미 가진 classes 데이터로 필터링
            // 여기서는 classes 데이터를 활용하여 같은 프로그램의 다른 반 표시
            const sameProgram = classes.filter(
                (c) => c.programId === selectedClass.programId && c.id !== originalClassId,
            );
            setAvailableSlots(
                sameProgram.map((c) => ({
                    id: c.id,
                    name: c.name,
                    dayOfWeek: c.dayOfWeek,
                    startTime: c.startTime,
                    endTime: c.endTime,
                    capacity: c.capacity,
                    enrolled: 0,
                    bookedMakeups: 0,
                    remaining: c.capacity, // 정확한 잔여석은 서버에서 계산 — 여기선 최대값 표시
                })),
            );
        } finally {
            setLoading(false);
        }
    }

    // 다음 단계로 이동
    function goToStep2() {
        if (!studentId || !originalClassId || !originalDate) {
            alert("원생, 원래 반, 결석일을 모두 선택해주세요");
            return;
        }
        fetchSlots();
        setStep(2);
    }

    // 예약 실행
    async function handleBook() {
        if (!makeupClassId || !makeupDate) {
            alert("보강 반과 보강일을 선택해주세요");
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
            onSuccess();
        } catch (e: any) {
            alert(e.message || "보강 예약 실패");
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-2xl w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto">
                {/* 모달 헤더 */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                    <h2 className="text-lg font-bold text-gray-900">
                        {step === 1 ? "보강 예약 - 원생/결석 정보" : "보강 예약 - 보강 반 선택"}
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    {step === 1 && (
                        <>
                            {/* 원생 선택 */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">원생 선택</label>
                                <input
                                    type="text"
                                    placeholder="이름 검색..."
                                    value={studentSearch}
                                    onChange={(e) => setStudentSearch(e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-2"
                                />
                                <select
                                    value={studentId}
                                    onChange={(e) => setStudentId(e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                                    size={5}
                                >
                                    <option value="">-- 원생 선택 --</option>
                                    {filteredStudents.map((s) => (
                                        <option key={s.id} value={s.id}>
                                            {s.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* 원래 반 선택 */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">원래 반 (결석한 반)</label>
                                <select
                                    value={originalClassId}
                                    onChange={(e) => setOriginalClassId(e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
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
                                <label className="block text-sm font-medium text-gray-700 mb-1">결석일</label>
                                <input
                                    type="date"
                                    min="2020-01-01" max="2030-12-31"
                                    value={originalDate}
                                    onChange={(e) => setOriginalDate(e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                                />
                            </div>

                            <button
                                onClick={goToStep2}
                                className="w-full py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
                            >
                                다음: 보강 반 선택
                            </button>
                        </>
                    )}

                    {step === 2 && (
                        <>
                            {/* 선택된 정보 요약 */}
                            <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
                                <p>
                                    <span className="text-gray-500">원생:</span>{" "}
                                    <span className="font-medium">{students.find((s) => s.id === studentId)?.name}</span>
                                </p>
                                <p>
                                    <span className="text-gray-500">원래 반:</span>{" "}
                                    <span className="font-medium">
                                        {selectedClass?.name} ({DAY_LABELS[selectedClass?.dayOfWeek ?? ""] ?? selectedClass?.dayOfWeek})
                                    </span>
                                </p>
                                <p>
                                    <span className="text-gray-500">결석일:</span>{" "}
                                    <span className="font-medium">{originalDate}</span>
                                </p>
                            </div>

                            {/* 보강 반 선택 */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    보강 반 선택 (같은 프로그램: {selectedClass?.program?.name ?? "미지정"})
                                </label>
                                {loading ? (
                                    <p className="text-sm text-gray-400 py-4 text-center">조회 중...</p>
                                ) : availableSlots.length === 0 ? (
                                    <p className="text-sm text-gray-400 py-4 text-center">
                                        같은 프로그램의 다른 반이 없습니다
                                    </p>
                                ) : (
                                    <div className="space-y-2">
                                        {availableSlots.map((slot) => (
                                            <label
                                                key={slot.id}
                                                className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-all ${
                                                    makeupClassId === slot.id
                                                        ? "border-blue-500 bg-blue-50"
                                                        : "border-gray-200 hover:border-gray-300"
                                                }`}
                                            >
                                                <input
                                                    type="radio"
                                                    name="makeupClass"
                                                    value={slot.id}
                                                    checked={makeupClassId === slot.id}
                                                    onChange={() => setMakeupClassId(slot.id)}
                                                    className="accent-blue-600"
                                                />
                                                <div className="flex-1">
                                                    <p className="font-medium text-sm">{slot.name}</p>
                                                    <p className="text-xs text-gray-500">
                                                        {DAY_LABELS[slot.dayOfWeek] ?? slot.dayOfWeek}요일 {slot.startTime}~{slot.endTime}
                                                        {" / "}정원 {slot.capacity}명
                                                    </p>
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* 보강일 */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">보강 수업일</label>
                                <input
                                    type="date"
                                    min="2020-01-01" max="2030-12-31"
                                    value={makeupDate}
                                    onChange={(e) => setMakeupDate(e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                                />
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setStep(1)}
                                    className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
                                >
                                    이전
                                </button>
                                <button
                                    onClick={handleBook}
                                    disabled={busy || !makeupClassId || !makeupDate}
                                    className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors disabled:opacity-50"
                                >
                                    {busy ? "처리 중..." : "보강 예약"}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
