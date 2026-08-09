"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { saveAttendance } from "@/app/actions/admin";
import { DocHead, DocSheet, DocButton, DocEmpty, DocFoot, issuedAt, DOC_SERIF } from "@/components/doc";

type ClassItem = {
    id: string;
    lessonKey?: string;
    kind?: "REGULAR" | "SEASONAL";
    name: string;
    dayOfWeek: string;
    startTime: string;
    endTime: string;
    location?: string | null;
    sessionDateId?: string | null;
    sessionId?: string | null;
    sessionStatus?: string | null;
    studentCount?: number;
    coachName?: string | null;
    program: { id: string; name: string } | null;
};

type StudentRecord = {
    studentId: string;
    studentName: string;
    status: string | null;
    attendanceId: string | null;
};

type AttendanceClassesPayload = {
    classes: ClassItem[];
};

const DAY_LABELS: Record<string, string> = {
    Mon: "월", Tue: "화", Wed: "수", Thu: "목", Fri: "금", Sat: "토", Sun: "일",
};

// 출결 표기는 색이 아니라 서류 관습의 기호로 한다 — 출석 ○ · 지각 △ · 결석 ✕.
// 흑백으로 인쇄해도 그대로 읽히는 것이 학적부의 요건이다.
const STATUS_OPTIONS = [
    { value: "PRESENT", label: "출석", mark: "○" },
    { value: "ABSENT", label: "결석", mark: "✕" },
    { value: "LATE", label: "지각", mark: "△" },
] as const;

function todayStr() {
    return new Date().toISOString().split("T")[0];
}

function lessonKeyOf(item: ClassItem) {
    return item.lessonKey || `${item.kind === "SEASONAL" ? "seasonal" : "regular"}:${item.sessionDateId || item.id}`;
}

function AttendanceLoadingFallback() {
    return (
        <div className="max-w-4xl mx-auto">
            <div className="mb-6 flex items-center justify-between">
                <div className="space-y-2">
                    <div className="h-8 w-32 rounded bg-[var(--doc-grid-head)]" />
                    <div className="h-4 w-72 rounded bg-[var(--doc-grid-head)]" />
                </div>
                <div className="h-10 w-28 rounded-[3px] bg-[var(--doc-grid-head)]" />
            </div>
            <div className="rounded-[3px] border border-[var(--doc-rule)] bg-[var(--doc-surface)] p-5">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="h-16 rounded-[3px] bg-[var(--doc-grid-head)]" />
                    <div className="h-16 rounded-[3px] bg-[var(--doc-grid-head)]" />
                </div>
            </div>
        </div>
    );
}

function AttendanceErrorState({ onRetry }: { onRetry: () => void }) {
    return (
        <div className="mx-auto max-w-4xl rounded-[3px] border border-[var(--doc-crit)] bg-[var(--doc-crit-soft)] p-6 text-center">
            <p className="text-sm font-bold text-[var(--doc-crit)]">출석 관리 데이터를 불러오지 못했습니다.</p>
            <button
                type="button"
                onClick={onRetry}
                className="mt-4 rounded-[3px] bg-[var(--doc-crit)] px-4 py-2 text-sm font-bold text-white hover:bg-[var(--doc-crit)]"
            >
                다시 불러오기
            </button>
        </div>
    );
}

export default function AttendanceClient({ classes: initialClasses }: { classes?: ClassItem[] }) {
    const hasInitialClasses = initialClasses !== undefined;
    const [classes, setClasses] = useState<ClassItem[]>(initialClasses ?? []);
    const [classesLoading, setClassesLoading] = useState(!hasInitialClasses);
    const [classesError, setClassesError] = useState(false);
    const [selectedClass, setSelectedClass] = useState("");
    const [date, setDate] = useState(todayStr());
    const [students, setStudents] = useState<StudentRecord[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    const loadClasses = useCallback(async (targetDate = date) => {
        setClassesLoading(true);
        setClassesError(false);
        try {
            const response = await fetch(`/api/admin/attendance?date=${encodeURIComponent(targetDate)}`, { cache: "no-store" });
            if (!response.ok) {
                throw new Error("Failed to load classes.");
            }
            const data = (await response.json()) as AttendanceClassesPayload;
            setClasses(data.classes);
        } catch (error) {
            console.error("Failed to load attendance classes:", error);
            setClassesError(true);
        } finally {
            setClassesLoading(false);
        }
    }, [date]);

    useEffect(() => {
        void loadClasses(date);
    }, [date, loadClasses]);

    useEffect(() => {
        if (!selectedClass) return;
        if (classes.some((item) => lessonKeyOf(item) === selectedClass)) return;
        setSelectedClass("");
        setStudents([]);
    }, [classes, selectedClass]);

    const selectedLesson = classes.find((item) => lessonKeyOf(item) === selectedClass) ?? null;

    const loadAttendance = useCallback(async (options?: { resetSaved?: boolean }) => {
        if (!selectedLesson || !date) return;
        setLoading(true);
        if (options?.resetSaved !== false) {
            setSaved(false);
        }
        try {
            const params = new URLSearchParams({ classId: selectedLesson.id, date });
            if (selectedLesson.sessionDateId) params.set("sessionDateId", selectedLesson.sessionDateId);
            const res = await fetch(`/api/admin/attendance?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                setStudents(data.students || []);
            }
        } catch {
            setStudents([]);
        } finally {
            setLoading(false);
        }
    }, [date, selectedLesson]);

    useEffect(() => {
        loadAttendance();
    }, [loadAttendance]);

    function setStatus(studentId: string, status: string) {
        setStudents((prev) =>
            prev.map((s) =>
                s.studentId === studentId ? { ...s, status } : s
            )
        );
        setSaved(false);
    }

    function markAll(status: string) {
        setStudents((prev) => prev.map((s) => ({ ...s, status })));
        setSaved(false);
    }

    async function handleSave() {
        if (!selectedLesson || !date) return;
        const records = students
            .filter((s) => s.status)
            .map((s) => ({ studentId: s.studentId, status: s.status! }));
        if (records.length === 0) {
            alert("출결 상태를 선택해주세요.");
            return;
        }
        setSaving(true);
        try {
            await saveAttendance(selectedLesson.id, date, records, { sessionDateId: selectedLesson.sessionDateId });
            await loadAttendance({ resetSaved: false });
            setSaved(true);
        } catch (err: any) {
            alert(err.message || "저장 실패");
        } finally {
            setSaving(false);
        }
    }

    const presentCount = students.filter((s) => s.status === "PRESENT").length;
    const absentCount = students.filter((s) => s.status === "ABSENT").length;
    const lateCount = students.filter((s) => s.status === "LATE").length;

    if (classesLoading && classes.length === 0) {
        return <AttendanceLoadingFallback />;
    }

    if (classesError && classes.length === 0) {
        return <AttendanceErrorState onRetry={loadClasses} />;
    }

    return (
        <div className="mx-auto" style={{ maxWidth: "var(--page-width)" }}>
            <DocHead
                title="《출석부》"
                period={date ? date.replace(/-/g, ".") : ""}
                right={
                    <Link
                        href="/admin/attendance/report"
                        prefetch={false}
                        className="no-print rounded-[3px] px-3 py-1.5 text-[12.5px] font-bold"
                        style={{ border: "1.5px solid var(--doc-rule-strong)", color: "var(--doc-ink)" }}
                    >
                        수업 리포트
                    </Link>
                }
                // 요약은 화면의 실제 데이터에서 계산한다(고정 문자열 금지 — 서류와 화면이 어긋난다).
                summary={selectedLesson && students.length > 0 ? [
                    { label: "수강생", value: `${students.length}명` },
                    { label: "출석", value: `${presentCount}명` },
                    { label: "지각", value: `${lateCount}명` },
                    { label: "결석", value: `${absentCount}명`, tone: absentCount > 0 ? "negative" as const : undefined },
                ] : undefined}
            />

            {/* 대상 선택 */}
            <div className="no-print mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="block">
                    <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: "var(--doc-ink-3)" }}>날짜</span>
                    <input
                        type="date"
                        min="2020-01-01" max="2030-12-31"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="w-full rounded-[3px] px-3 py-2 text-[13px] tabular-nums outline-none"
                        style={{ background: "var(--doc-surface)", border: "1px solid var(--doc-rule-strong)", color: "var(--doc-ink)" }}
                    />
                </label>
                <label className="block">
                    <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: "var(--doc-ink-3)" }}>반</span>
                    <select
                        value={selectedClass}
                        onChange={(e) => setSelectedClass(e.target.value)}
                        className="w-full rounded-[3px] px-3 py-2 text-[13px] outline-none"
                        style={{ background: "var(--doc-surface)", border: "1px solid var(--doc-rule-strong)", color: "var(--doc-ink)" }}
                    >
                        <option value="">반을 선택하세요</option>
                        {classes.map((c) => (
                            <option key={lessonKeyOf(c)} value={lessonKeyOf(c)}>
                                [{c.kind === "SEASONAL" ? "특강" : "정규"}] {c.name} ({DAY_LABELS[c.dayOfWeek] || c.dayOfWeek} {c.startTime}~{c.endTime}) — {c.program?.name}{c.coachName ? ` · ${c.coachName}` : ""}{c.kind === "SEASONAL" ? ` · ${c.studentCount ?? 0}명` : ""}
                            </option>
                        ))}
                    </select>
                </label>
            </div>

            {/* 출결 명부 */}
            {selectedLesson && (
                <div className="mt-5">
                    {loading ? (
                        <p className="py-12 text-center text-[12.5px]" style={{ color: "var(--doc-ink-3)" }}>불러오는 중</p>
                    ) : students.length === 0 ? (
                        <DocEmpty title="기록이 없습니다." hint="이 반에 수강 등록된 원생이 없습니다." />
                    ) : (
                        <DocSheet className="p-0">
                            <div className="overflow-x-auto">
                                <table className="w-full border-collapse" style={{ minWidth: 520 }}>
                                    <thead>
                                        <tr style={{ borderBottom: "1.5px solid var(--doc-ink)" }}>
                                            <th className="h-[30px] px-3 text-left text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: "var(--doc-ink-3)" }}>번호</th>
                                            <th className="h-[30px] px-3 text-left text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: "var(--doc-ink-3)" }}>성명</th>
                                            <th className="h-[30px] px-3 text-right text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: "var(--doc-ink-3)" }}>출결</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {students.map((st, idx) => (
                                            <tr key={st.studentId}
                                                style={{ borderBottom: "1px solid var(--doc-rule)", borderLeft: "2px solid transparent" }}
                                                onMouseEnter={(e) => { e.currentTarget.style.borderLeftColor = "var(--doc-accent)"; }}
                                                onMouseLeave={(e) => { e.currentTarget.style.borderLeftColor = "transparent"; }}>
                                                <td className="h-[34px] px-3 text-[12.5px] font-semibold tabular-nums" style={{ color: "var(--doc-ink-3)" }}>{idx + 1}</td>
                                                <td className="h-[34px] px-3 text-[12.5px] font-medium" style={{ color: "var(--doc-ink)" }}>{st.studentName}</td>
                                                <td className="h-[34px] px-3">
                                                    <div className="flex justify-end gap-1.5">
                                                        {STATUS_OPTIONS.map((opt) => {
                                                            const on = st.status === opt.value;
                                                            return (
                                                                <button
                                                                    key={opt.value}
                                                                    onClick={() => setStatus(st.studentId, opt.value)}
                                                                    title={opt.label}
                                                                    className="w-9 rounded-[3px] py-1 text-[13px] font-bold transition-colors"
                                                                    style={{
                                                                        border: "1px solid " + (on ? "var(--doc-accent)" : "var(--doc-rule)"),
                                                                        background: on ? "var(--doc-accent-soft)" : "transparent",
                                                                        color: on ? "var(--doc-accent)" : "var(--doc-ink-3)",
                                                                    }}
                                                                >
                                                                    {opt.mark}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="no-print flex flex-wrap items-center justify-between gap-3 px-3 py-3" style={{ borderTop: "1px solid var(--doc-rule)" }}>
                                <button
                                    onClick={() => markAll("PRESENT")}
                                    className="text-[12px] font-bold"
                                    style={{ color: "var(--doc-accent)" }}
                                >
                                    전체 출석 처리
                                </button>
                                <div className="flex items-center gap-3">
                                    {saved && (
                                        <span className="text-[12px] font-bold" style={{ color: "var(--doc-accent)" }}>저장했습니다.</span>
                                    )}
                                    <DocButton kind="primary" onClick={handleSave} disabled={saving}>
                                        {saving ? "저장 중" : "출결 저장"}
                                    </DocButton>
                                </div>
                            </div>
                        </DocSheet>
                    )}

                    <p className="mt-2 text-[11px]" style={{ color: "var(--doc-ink-3)", fontFamily: DOC_SERIF }}>
                        출석 ○ · 지각 △ · 결석 ✕
                    </p>
                    <DocFoot issued={issuedAt()} />
                </div>
            )}
        </div>
    );
}
