"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { saveAttendance } from "@/app/actions/admin";

type ClassItem = {
    id: string;
    name: string;
    dayOfWeek: string;
    startTime: string;
    endTime: string;
    program: { id: string; name: string } | null;
};

type StudentRecord = {
    studentId: string;
    studentName: string;
    status: string | null;
    attendanceId: string | null;
};

const DAY_LABELS: Record<string, string> = {
    Mon: "월", Tue: "화", Wed: "수", Thu: "목", Fri: "금", Sat: "토", Sun: "일",
};

const STATUS_OPTIONS = [
    { value: "PRESENT", label: "출석", color: "bg-green-100 text-green-700 border-green-300" },
    { value: "ABSENT", label: "결석", color: "bg-red-100 text-red-700 border-red-300" },
    { value: "LATE", label: "지각", color: "bg-yellow-100 text-yellow-700 border-yellow-300" },
] as const;

function todayStr() {
    return new Date().toISOString().split("T")[0];
}

export default function AttendanceClient({ classes }: { classes: ClassItem[] }) {
    const router = useRouter();
    const [selectedClass, setSelectedClass] = useState("");
    const [date, setDate] = useState(todayStr());
    const [students, setStudents] = useState<StudentRecord[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    const loadAttendance = useCallback(async () => {
        if (!selectedClass || !date) return;
        setLoading(true);
        setSaved(false);
        try {
            const res = await fetch(`/api/admin/attendance?classId=${selectedClass}&date=${date}`);
            if (res.ok) {
                const data = await res.json();
                setStudents(data.students || []);
            }
        } catch {
            setStudents([]);
        } finally {
            setLoading(false);
        }
    }, [selectedClass, date]);

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
        if (!selectedClass || !date) return;
        const records = students
            .filter((s) => s.status)
            .map((s) => ({ studentId: s.studentId, status: s.status! }));
        if (records.length === 0) {
            alert("출결 상태를 선택해주세요.");
            return;
        }
        setSaving(true);
        try {
            await saveAttendance(selectedClass, date, records);
            setSaved(true);
            router.refresh();
        } catch (err: any) {
            alert(err.message || "저장 실패");
        } finally {
            setSaving(false);
        }
    }

    const presentCount = students.filter((s) => s.status === "PRESENT").length;
    const absentCount = students.filter((s) => s.status === "ABSENT").length;
    const lateCount = students.filter((s) => s.status === "LATE").length;

    return (
        <div className="max-w-4xl mx-auto">
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-extrabold text-gray-900">출결 관리</h1>
                    <p className="text-gray-500 text-sm mt-1">날짜와 반을 선택하여 출결을 기록합니다.</p>
                </div>
                {/* 수업 리포트 관리 페이지로 이동하는 버튼 */}
                <Link
                    href="/admin/attendance/report"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold bg-brand-navy-900 text-white hover:bg-gray-800 transition"
                >
                    <span className="material-symbols-outlined text-base">assignment</span>
                    수업 리포트
                </Link>
            </div>

            {/* Selector */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6 shadow-sm">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">날짜</label>
                        <input
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-brand-orange-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">반 선택</label>
                        <select
                            value={selectedClass}
                            onChange={(e) => setSelectedClass(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-brand-orange-500 bg-white"
                        >
                            <option value="">반을 선택하세요</option>
                            {classes.map((c) => (
                                <option key={c.id} value={c.id}>
                                    {c.name} ({DAY_LABELS[c.dayOfWeek] || c.dayOfWeek} {c.startTime}~{c.endTime}) — {c.program?.name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Attendance Grid */}
            {selectedClass && (
                <>
                    {loading ? (
                        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
                            불러오는 중...
                        </div>
                    ) : students.length === 0 ? (
                        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
                            이 반에 수강 등록된 원생이 없습니다. 먼저 원생을 수강 등록하세요.
                        </div>
                    ) : (
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                            {/* Header with stats */}
                            <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between flex-wrap gap-3">
                                <div className="flex items-center gap-4">
                                    <span className="text-sm font-bold text-gray-900">수강생 {students.length}명</span>
                                    {presentCount + absentCount + lateCount > 0 && (
                                        <div className="flex gap-2 text-xs">
                                            <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">출석 {presentCount}</span>
                                            <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold">결석 {absentCount}</span>
                                            <span className="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-bold">지각 {lateCount}</span>
                                        </div>
                                    )}
                                </div>
                                <button
                                    onClick={() => markAll("PRESENT")}
                                    className="text-xs text-brand-orange-500 font-bold hover:underline"
                                >
                                    전체 출석 처리
                                </button>
                            </div>

                            {/* Student list */}
                            <div className="divide-y divide-gray-100">
                                {students.map((s) => (
                                    <div key={s.studentId} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors">
                                        <span className="font-medium text-gray-900">{s.studentName}</span>
                                        <div className="flex gap-2">
                                            {STATUS_OPTIONS.map((opt) => (
                                                <button
                                                    key={opt.value}
                                                    onClick={() => setStatus(s.studentId, opt.value)}
                                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition
                                                        ${s.status === opt.value
                                                            ? opt.color + " ring-2 ring-offset-1 ring-gray-300"
                                                            : "bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100"
                                                        }`}
                                                >
                                                    {opt.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Save button */}
                            <div className="p-5 border-t border-gray-100 bg-gray-50/50 flex justify-end gap-3">
                                {saved && (
                                    <span className="text-sm text-green-600 font-medium self-center">저장 완료</span>
                                )}
                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="bg-brand-orange-500 text-white px-6 py-2 rounded-lg font-bold hover:bg-orange-600 transition disabled:opacity-50"
                                >
                                    {saving ? "저장 중..." : "출결 저장"}
                                </button>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
