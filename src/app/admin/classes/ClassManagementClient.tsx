"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link"; // 클래스 상세 페이지 링크용
import { createClass, updateClass, deleteClass } from "@/app/actions/admin";

type Program = { id: string; name: string };
type ClassItem = {
    id: string;
    programId: string;
    name: string;
    dayOfWeek: string;
    startTime: string;
    endTime: string;
    location: string | null;
    capacity: number;
    program: { id: string; name: string } | null;
};

const DAYS = [
    { value: "Mon", label: "월요일" },
    { value: "Tue", label: "화요일" },
    { value: "Wed", label: "수요일" },
    { value: "Thu", label: "목요일" },
    { value: "Fri", label: "금요일" },
    { value: "Sat", label: "토요일" },
    { value: "Sun", label: "일요일" },
] as const;

export default function ClassManagementClient({
    programs,
    classes,
}: {
    programs: Program[];
    classes: ClassItem[];
}) {
    const router = useRouter();
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

    // Form state
    const [programId, setProgramId] = useState("");
    const [name, setName] = useState("");
    const [dayOfWeek, setDayOfWeek] = useState("");
    const [startTime, setStartTime] = useState("");
    const [endTime, setEndTime] = useState("");
    const [location, setLocation] = useState("");
    const [capacity, setCapacity] = useState(10);

    function resetForm() {
        setProgramId("");
        setName("");
        setDayOfWeek("");
        setStartTime("");
        setEndTime("");
        setLocation("");
        setCapacity(10);
        setShowForm(false);
        setEditingId(null);
    }

    function startEdit(c: ClassItem) {
        setProgramId(c.programId);
        setName(c.name);
        setDayOfWeek(c.dayOfWeek);
        setStartTime(c.startTime || "");
        setEndTime(c.endTime || "");
        setLocation(c.location || "");
        setCapacity(c.capacity);
        setEditingId(c.id);
        setShowForm(true);
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!programId || !name.trim() || !dayOfWeek) return;
        setBusy(true);
        try {
            const payload = {
                programId,
                name: name.trim(),
                dayOfWeek,
                startTime,
                endTime,
                location: location.trim() || undefined,
                capacity,
            };
            if (editingId) {
                await updateClass(editingId, payload);
            } else {
                await createClass(payload);
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
            await deleteClass(id);
            setDeleteConfirm(null);
            router.refresh();
        } catch (err: any) {
            alert(err.message || "삭제 실패");
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">클래스(반) 관리</h1>
                    <p className="text-gray-500 dark:text-gray-400">각 프로그램별 요일과 시간에 맞는 실제 반을 개설합니다.</p>
                </div>
                <button
                    onClick={() => { resetForm(); setShowForm(true); }}
                    className="bg-brand-orange-500 dark:bg-brand-neon-lime dark:text-brand-navy-900 text-white px-4 py-2 rounded-lg font-bold hover:bg-orange-600 transition"
                >
                    + 반 개설
                </button>
            </div>

            {programs.length === 0 && (
                <div className="text-amber-600 bg-amber-50 p-4 rounded-md">
                    먼저 [프로그램 관리] 메뉴에서 프로그램을 하나 이상 등록해야 반을 개설할 수 있습니다.
                </div>
            )}

            {/* Form */}
            {showForm && (
                <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-sm space-y-4">
                    <h3 className="font-bold text-lg text-gray-900 dark:text-white">{editingId ? "반 수정" : "새 반 개설"}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">소속 프로그램 *</label>
                            <select
                                value={programId}
                                onChange={(e) => setProgramId(e.target.value)}
                                required
                                className="w-full border border-gray-300 rounded-md p-2 focus:ring-brand-orange-500 dark:focus:ring-brand-neon-lime focus:border-brand-orange-500 dark:border-brand-neon-lime bg-white dark:bg-gray-800"
                            >
                                <option value="">선택하세요</option>
                                {programs.map((p) => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">반 이름 *</label>
                            <input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                                placeholder="예: 초등 저학년 A반"
                                className="w-full border border-gray-300 rounded-md p-2 focus:ring-brand-orange-500 dark:focus:ring-brand-neon-lime focus:border-brand-orange-500 dark:border-brand-neon-lime"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">요일 *</label>
                            <select
                                value={dayOfWeek}
                                onChange={(e) => setDayOfWeek(e.target.value)}
                                required
                                className="w-full border border-gray-300 rounded-md p-2 focus:ring-brand-orange-500 dark:focus:ring-brand-neon-lime focus:border-brand-orange-500 dark:border-brand-neon-lime bg-white dark:bg-gray-800"
                            >
                                <option value="">선택하세요</option>
                                {DAYS.map((d) => (
                                    <option key={d.value} value={d.value}>{d.label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">시작 시간</label>
                            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)}
                                className="w-full border border-gray-300 rounded-md p-2 focus:ring-brand-orange-500 dark:focus:ring-brand-neon-lime focus:border-brand-orange-500 dark:border-brand-neon-lime" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">종료 시간</label>
                            <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)}
                                className="w-full border border-gray-300 rounded-md p-2 focus:ring-brand-orange-500 dark:focus:ring-brand-neon-lime focus:border-brand-orange-500 dark:border-brand-neon-lime" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">정원 (명) *</label>
                            <input type="number" value={capacity} onChange={(e) => setCapacity(parseInt(e.target.value) || 0)}
                                required
                                className="w-full border border-gray-300 rounded-md p-2 focus:ring-brand-orange-500 dark:focus:ring-brand-neon-lime focus:border-brand-orange-500 dark:border-brand-neon-lime" />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">장소(코트)</label>
                            <input value={location} onChange={(e) => setLocation(e.target.value)}
                                placeholder="예: A코트, 메인구장"
                                className="w-full border border-gray-300 rounded-md p-2 focus:ring-brand-orange-500 dark:focus:ring-brand-neon-lime focus:border-brand-orange-500 dark:border-brand-neon-lime" />
                        </div>
                        <div className="flex items-end justify-end">
                            <div className="flex gap-2">
                                <button type="button" onClick={resetForm} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 dark:text-white">
                                    취소
                                </button>
                                <button
                                    type="submit"
                                    disabled={busy}
                                    className="bg-brand-navy-900 text-white px-4 py-2 rounded-md font-bold hover:bg-gray-800 transition shadow-sm disabled:opacity-50"
                                >
                                    {busy ? "저장 중..." : editingId ? "수정" : "개설하기"}
                                </button>
                            </div>
                        </div>
                    </div>
                </form>
            )}

            {/* Class List */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white p-6 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
                    개설된 전체 시간표 ({classes.length}개)
                </h2>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50 dark:bg-gray-900">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">요일/시간</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">반 이름</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">참조 프로그램</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">장소/정원</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">관리</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200">
                            {classes.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">개설된 반이 없습니다.</td>
                                </tr>
                            )}
                            {classes.map((cls) => (
                                <tr key={cls.id} className="hover:bg-gray-50 dark:bg-gray-900 transition">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm font-bold text-brand-orange-500 dark:text-brand-neon-lime">
                                            {DAYS.find(d => d.value === cls.dayOfWeek)?.label || cls.dayOfWeek}
                                        </div>
                                        <div className="text-sm text-gray-500 dark:text-gray-400">{cls.startTime || "-"} ~ {cls.endTime || "-"}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {/* 반 이름 클릭 시 클래스 상세 페이지로 이동 */}
                                        <Link
                                            href={`/admin/classes/${cls.id}`}
                                            className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                                        >
                                            {cls.name}
                                        </Link>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm text-gray-500 dark:text-gray-400">{cls.program?.name || "-"}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                        <div>{cls.location || "미지정"}</div>
                                        <div>정원: {cls.capacity}명</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                                        <div className="flex items-center gap-2 justify-end">
                                            <button
                                                onClick={() => startEdit(cls)}
                                                className="text-blue-600 hover:text-blue-800 font-medium"
                                            >
                                                수정
                                            </button>
                                            {deleteConfirm === cls.id ? (
                                                <div className="flex gap-1">
                                                    <button
                                                        onClick={() => handleDelete(cls.id)}
                                                        disabled={busy}
                                                        className="text-xs bg-red-500 text-white px-2 py-1 rounded font-bold disabled:opacity-50"
                                                    >
                                                        확인
                                                    </button>
                                                    <button
                                                        onClick={() => setDeleteConfirm(null)}
                                                        className="text-xs text-gray-500 dark:text-gray-400 px-2 py-1"
                                                    >
                                                        취소
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => setDeleteConfirm(cls.id)}
                                                    className="text-red-500 hover:text-red-700 font-medium bg-red-50 hover:bg-red-100 px-2.5 py-1 rounded transition"
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
        </div>
    );
}
