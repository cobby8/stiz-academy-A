"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
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

// 요일 한글 변환
const DAY_LABELS: Record<string, string> = {
    Mon: "월", Tue: "화", Wed: "수", Thu: "목", Fri: "금", Sat: "토", Sun: "일",
};

// 상태 라벨 + 색상
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
    WAITING: { label: "대기중", color: "text-yellow-700", bg: "bg-yellow-100" },
    OFFERED: { label: "제안됨", color: "text-blue-700", bg: "bg-blue-100" },
    ENROLLED: { label: "등록완료", color: "text-green-700", bg: "bg-green-100" },
    CANCELLED: { label: "취소", color: "text-gray-500", bg: "bg-gray-100" },
};

export default function WaitlistClient({
    waitlist,
    capacityInfo,
    students,
    classes,
}: {
    waitlist: WaitlistItem[];
    capacityInfo: CapacityInfo[];
    students: Student[];
    classes: ClassItem[];
}) {
    const router = useRouter();
    const [busy, setBusy] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);
    // 필터: 특정 반만 보기
    const [filterClassId, setFilterClassId] = useState<string>("ALL");
    // 상태 필터: 활성(WAITING+OFFERED) or 전체
    const [showAll, setShowAll] = useState(false);

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
            router.refresh();
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
            router.refresh();
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
            router.refresh();
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
            router.refresh();
        } catch (e: any) {
            alert(e.message || "대기 취소 실패");
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="space-y-6">
            {/* 페이지 헤더 */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <span className="material-symbols-outlined text-3xl text-brand-orange-500">hourglass_top</span>
                        대기자 관리
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">
                        반 정원 초과 시 대기열을 관리하고, 자리가 나면 학부모에게 알림을 보냅니다.
                    </p>
                </div>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="flex items-center gap-2 bg-brand-orange-500 text-white px-4 py-2.5 rounded-lg font-semibold hover:bg-brand-orange-600 transition-colors"
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
                                    ? "border-brand-orange-500 bg-brand-orange-50 ring-1 ring-brand-orange-500"
                                    : "border-gray-200 bg-white hover:border-gray-300"
                            }`}
                        >
                            <p className="text-sm font-semibold text-gray-700 truncate">{c.name}</p>
                            <p className="text-xs text-gray-400 mt-0.5">
                                {DAY_LABELS[c.dayOfWeek] ?? c.dayOfWeek} {c.startTime}~{c.endTime}
                            </p>
                            <div className="mt-3 flex items-end gap-3">
                                {/* 정원 바 */}
                                <div className="flex-1">
                                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                                        <span>등록 {c.enrolled}/{c.capacity}</span>
                                        <span>잔여 {c.remaining}</span>
                                    </div>
                                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
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

                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
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
                <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
                    <span className="material-symbols-outlined text-5xl text-gray-300">hourglass_empty</span>
                    <p className="text-gray-400 mt-2">대기자가 없습니다</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {Array.from(groupedByClass.entries()).map(([classId, items]) => (
                        <div key={classId} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                            {/* 반 헤더 */}
                            <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
                                <span className="material-symbols-outlined text-lg text-gray-500">school</span>
                                <span className="font-semibold text-gray-700">{items[0].className}</span>
                                <span className="text-xs text-gray-400">
                                    {DAY_LABELS[items[0].classDay] ?? items[0].classDay} {items[0].classStart}~{items[0].classEnd}
                                </span>
                                <span className="ml-auto text-xs text-gray-500">{items.length}명 대기</span>
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
                                                <p className="text-sm font-semibold text-gray-800">{w.studentName}</p>
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
                    classes={classes}
                    onClose={() => setShowAddModal(false)}
                    onDone={() => { setShowAddModal(false); router.refresh(); }}
                />
            )}
        </div>
    );
}

// ── 대기 등록 모달 ──────────────────────────────────────────────────────────
function AddWaitlistModal({
    students,
    classes,
    onClose,
    onDone,
}: {
    students: Student[];
    classes: ClassItem[];
    onClose: () => void;
    onDone: () => void;
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
            onDone();
        } catch (err: any) {
            alert(err.message || "대기 등록 실패");
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
                <div className="flex items-center justify-between mb-5">
                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        <span className="material-symbols-outlined text-brand-orange-500">person_add</span>
                        대기 등록
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* 학생 선택 */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">학생 *</label>
                        <input
                            type="text"
                            placeholder="이름 검색..."
                            value={studentSearch}
                            onChange={(e) => setStudentSearch(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-1"
                        />
                        <select
                            value={studentId}
                            onChange={(e) => setStudentId(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                            size={5}
                        >
                            <option value="">-- 학생 선택 --</option>
                            {filteredStudents.map((s) => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* 반 선택 */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">반 *</label>
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
                        <label className="block text-sm font-medium text-gray-700 mb-1">메모 (선택)</label>
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
                            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
                        >
                            취소
                        </button>
                        <button
                            type="submit"
                            disabled={busy}
                            className="px-5 py-2 bg-brand-orange-500 text-white text-sm font-semibold rounded-lg hover:bg-brand-orange-600 disabled:opacity-50 transition-colors"
                        >
                            {busy ? "등록 중..." : "대기 등록"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
