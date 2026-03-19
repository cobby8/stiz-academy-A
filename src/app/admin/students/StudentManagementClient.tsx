"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
    createStudent,
    updateStudent,
    deleteStudent,
    enrollStudent,
    deleteEnrollment,
} from "@/app/actions/admin";

type Student = {
    id: string;
    name: string;
    birthDate: Date | string;
    gender: string | null;
    parentId: string;
    createdAt: Date | string;
    parent: {
        name: string | null;
        phone: string | null;
        email: string | null;
    };
};

type ClassItem = {
    id: string;
    name: string;
    dayOfWeek: string;
    startTime: string;
    endTime: string;
    program: { id: string; name: string } | null;
};

const DAY_LABELS: Record<string, string> = {
    Mon: "월", Tue: "화", Wed: "수", Thu: "목", Fri: "금", Sat: "토", Sun: "일",
};

function toDateStr(d: Date | string | null): string {
    if (!d) return "";
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

export default function StudentManagementClient({
    students,
    classes,
}: {
    students: Student[];
    classes: ClassItem[];
}) {
    const router = useRouter();
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [enrollModal, setEnrollModal] = useState<string | null>(null);

    // Form state
    const [name, setName] = useState("");
    const [birthDate, setBirthDate] = useState("");
    const [gender, setGender] = useState("");
    const [parentName, setParentName] = useState("");
    const [parentPhone, setParentPhone] = useState("");
    const [parentEmail, setParentEmail] = useState("");

    function resetForm() {
        setName("");
        setBirthDate("");
        setGender("");
        setParentName("");
        setParentPhone("");
        setParentEmail("");
        setShowForm(false);
        setEditingId(null);
    }

    function startEdit(s: Student) {
        setName(s.name);
        setBirthDate(toDateStr(s.birthDate));
        setGender(s.gender || "");
        setParentName(s.parent.name || "");
        setParentPhone(s.parent.phone || "");
        setParentEmail(s.parent.email || "");
        setEditingId(s.id);
        setShowForm(true);
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!name.trim() || !birthDate || !parentName.trim()) return;
        setBusy(true);
        try {
            if (editingId) {
                await updateStudent(editingId, {
                    name: name.trim(),
                    birthDate,
                    gender: gender || null,
                    parentName: parentName.trim(),
                    parentPhone: parentPhone.trim() || null,
                });
            } else {
                await createStudent({
                    name: name.trim(),
                    birthDate,
                    gender: gender || null,
                    parentName: parentName.trim(),
                    parentPhone: parentPhone.trim() || null,
                    parentEmail: parentEmail.trim() || null,
                });
            }
            resetForm();
            router.refresh();
        } catch (err: any) {
            alert(err.message || "저장 실패");
        } finally {
            setBusy(false);
        }
    }

    async function handleDelete(id: string) {
        setBusy(true);
        try {
            await deleteStudent(id);
            setDeleteConfirm(null);
            router.refresh();
        } catch (err: any) {
            alert(err.message || "삭제 실패");
        } finally {
            setBusy(false);
        }
    }

    async function handleEnroll(studentId: string, classId: string) {
        setBusy(true);
        try {
            await enrollStudent(studentId, classId);
            setEnrollModal(null);
            router.refresh();
        } catch (err: any) {
            alert(err.message || "수강 등록 실패");
        } finally {
            setBusy(false);
        }
    }

    // Filter
    const filtered = students.filter((s) => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (
            s.name.toLowerCase().includes(q) ||
            (s.parent.name && s.parent.name.toLowerCase().includes(q)) ||
            (s.parent.phone && s.parent.phone.includes(q))
        );
    });

    return (
        <div className="max-w-5xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-extrabold text-gray-900">원생 관리</h1>
                    <p className="text-gray-500 text-sm mt-1">
                        등록된 원생: {students.length}명
                    </p>
                </div>
                <button
                    onClick={() => { resetForm(); setShowForm(true); }}
                    className="bg-brand-orange-500 text-white px-4 py-2 rounded-lg font-bold hover:bg-orange-600 transition"
                >
                    + 원생 등록
                </button>
            </div>

            {/* Search */}
            <div className="mb-4">
                <input
                    type="text"
                    placeholder="이름, 학부모명, 전화번호로 검색..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full max-w-md border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-brand-orange-500"
                />
            </div>

            {/* Form */}
            {showForm && (
                <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-6 mb-6 shadow-sm space-y-4">
                    <h3 className="font-bold text-lg text-gray-900">{editingId ? "원생 수정" : "새 원생 등록"}</h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">이름 *</label>
                            <input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                                placeholder="홍길동"
                                className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-brand-orange-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">생년월일 *</label>
                            <input
                                type="date"
                                value={birthDate}
                                onChange={(e) => setBirthDate(e.target.value)}
                                required
                                className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-brand-orange-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">성별</label>
                            <select
                                value={gender}
                                onChange={(e) => setGender(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-brand-orange-500"
                            >
                                <option value="">선택 안함</option>
                                <option value="남">남</option>
                                <option value="여">여</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">학부모 이름 *</label>
                            <input
                                value={parentName}
                                onChange={(e) => setParentName(e.target.value)}
                                required
                                placeholder="보호자 이름"
                                className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-brand-orange-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">학부모 연락처</label>
                            <input
                                value={parentPhone}
                                onChange={(e) => setParentPhone(e.target.value)}
                                placeholder="010-0000-0000"
                                className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-brand-orange-500"
                            />
                        </div>
                        {!editingId && (
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">학부모 이메일</label>
                                <input
                                    type="email"
                                    value={parentEmail}
                                    onChange={(e) => setParentEmail(e.target.value)}
                                    placeholder="parent@email.com"
                                    className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-brand-orange-500"
                                />
                            </div>
                        )}
                    </div>

                    <div className="flex gap-2 justify-end">
                        <button type="button" onClick={resetForm} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
                            취소
                        </button>
                        <button
                            type="submit"
                            disabled={busy}
                            className="bg-brand-orange-500 text-white px-6 py-2 rounded-lg font-bold hover:bg-orange-600 transition disabled:opacity-50"
                        >
                            {busy ? "저장 중..." : editingId ? "수정" : "등록"}
                        </button>
                    </div>
                </form>
            )}

            {/* Student list */}
            {filtered.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
                    {search ? "검색 결과가 없습니다." : "등록된 원생이 없습니다. \"원생 등록\" 버튼으로 새 원생을 등록하세요."}
                </div>
            ) : (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">이름</th>
                                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">나이/생년월일</th>
                                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">성별</th>
                                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">학부모</th>
                                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">연락처</th>
                                    <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase">관리</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filtered.map((s) => (
                                    <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-5 py-3.5">
                                            <Link href={`/admin/students/${s.id}`} className="font-bold text-gray-900 hover:text-brand-orange-500 transition-colors">
                                                {s.name}
                                            </Link>
                                        </td>
                                        <td className="px-5 py-3.5 text-sm text-gray-600">
                                            <span className="font-medium">{calcAge(s.birthDate)}세</span>
                                            <span className="text-gray-400 ml-1">({toDateStr(s.birthDate)})</span>
                                        </td>
                                        <td className="px-5 py-3.5 text-sm text-gray-600">
                                            {s.gender || "-"}
                                        </td>
                                        <td className="px-5 py-3.5 text-sm text-gray-600">
                                            {s.parent.name || "-"}
                                        </td>
                                        <td className="px-5 py-3.5 text-sm text-gray-600">
                                            {s.parent.phone || "-"}
                                        </td>
                                        <td className="px-5 py-3.5 text-right">
                                            <div className="flex items-center gap-2 justify-end">
                                                <button
                                                    onClick={() => setEnrollModal(s.id)}
                                                    className="text-xs text-green-600 hover:text-green-800 font-medium"
                                                >
                                                    수강등록
                                                </button>
                                                <button
                                                    onClick={() => startEdit(s)}
                                                    className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                                                >
                                                    수정
                                                </button>
                                                {deleteConfirm === s.id ? (
                                                    <div className="flex gap-1">
                                                        <button
                                                            onClick={() => handleDelete(s.id)}
                                                            disabled={busy}
                                                            className="text-xs bg-red-500 text-white px-2 py-1 rounded font-bold disabled:opacity-50"
                                                        >
                                                            확인
                                                        </button>
                                                        <button
                                                            onClick={() => setDeleteConfirm(null)}
                                                            className="text-xs text-gray-500 px-2 py-1"
                                                        >
                                                            취소
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => setDeleteConfirm(s.id)}
                                                        className="text-xs text-red-500 hover:text-red-700 font-medium"
                                                    >
                                                        삭제
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Enroll Modal */}
            {enrollModal && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
                        <h3 className="font-bold text-lg text-gray-900 mb-4">
                            수강 등록 — {students.find(s => s.id === enrollModal)?.name}
                        </h3>
                        {classes.length === 0 ? (
                            <p className="text-gray-500 text-sm">개설된 반이 없습니다. 먼저 반을 개설하세요.</p>
                        ) : (
                            <div className="space-y-2 max-h-60 overflow-y-auto">
                                {classes.map((c) => (
                                    <button
                                        key={c.id}
                                        onClick={() => handleEnroll(enrollModal!, c.id)}
                                        disabled={busy}
                                        className="w-full text-left p-3 rounded-lg border border-gray-200 hover:border-brand-orange-400 hover:bg-orange-50 transition disabled:opacity-50"
                                    >
                                        <div className="font-medium text-gray-900">{c.name}</div>
                                        <div className="text-xs text-gray-500">
                                            {c.program?.name} | {DAY_LABELS[c.dayOfWeek] || c.dayOfWeek}요일 {c.startTime}~{c.endTime}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                        <div className="mt-4 text-right">
                            <button
                                onClick={() => setEnrollModal(null)}
                                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
                            >
                                닫기
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
