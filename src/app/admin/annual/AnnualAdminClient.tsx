"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createAnnualEvent, updateAnnualEvent, deleteAnnualEvent } from "@/app/actions/admin";

type AnnualEvent = {
    id: string;
    title: string;
    date: Date | string;
    endDate?: Date | string | null;
    description?: string | null;
    category?: string | null;
};

const CATEGORIES = ["일반", "대회", "방학", "특별행사", "정기행사"] as const;

const CATEGORY_COLORS: Record<string, string> = {
    "대회": "bg-red-100 text-red-700",
    "방학": "bg-blue-100 text-blue-700",
    "특별행사": "bg-purple-100 text-purple-700",
    "정기행사": "bg-green-100 text-green-700",
    "일반": "bg-gray-100 text-gray-700",
};

function toDateString(d: Date | string | null | undefined): string {
    if (!d) return "";
    const date = typeof d === "string" ? new Date(d) : d;
    return date.toISOString().split("T")[0];
}

export default function AnnualAdminClient({ events }: { events: AnnualEvent[] }) {
    const router = useRouter();
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

    // Form state
    const [title, setTitle] = useState("");
    const [date, setDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [description, setDescription] = useState("");
    const [category, setCategory] = useState("일반");

    function resetForm() {
        setTitle("");
        setDate("");
        setEndDate("");
        setDescription("");
        setCategory("일반");
        setShowForm(false);
        setEditingId(null);
    }

    function startEdit(event: AnnualEvent) {
        setTitle(event.title);
        setDate(toDateString(event.date));
        setEndDate(toDateString(event.endDate));
        setDescription(event.description || "");
        setCategory(event.category || "일반");
        setEditingId(event.id);
        setShowForm(true);
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!title.trim() || !date) return;
        setBusy(true);
        try {
            const payload = {
                title: title.trim(),
                date,
                endDate: endDate || null,
                description: description.trim() || null,
                category,
            };
            if (editingId) {
                await updateAnnualEvent(editingId, payload);
            } else {
                await createAnnualEvent(payload);
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
            await deleteAnnualEvent(id);
            setDeleteConfirm(null);
            router.refresh();
        } catch (err: any) {
            alert(err.message || "삭제 실패");
        } finally {
            setBusy(false);
        }
    }

    // Group events by year
    const eventsByYear = events.reduce<Record<number, AnnualEvent[]>>((acc, ev) => {
        const year = new Date(ev.date).getFullYear();
        (acc[year] ||= []).push(ev);
        return acc;
    }, {});
    const years = Object.keys(eventsByYear).map(Number).sort((a, b) => b - a);

    return (
        <div className="max-w-4xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-extrabold text-gray-900">연간일정 관리</h1>
                    <p className="text-gray-500 text-sm mt-1">학원 연간 일정을 관리합니다. 등록된 일정은 연간일정 페이지에 표시됩니다.</p>
                </div>
                <button
                    onClick={() => { resetForm(); setShowForm(true); }}
                    className="bg-brand-orange-500 text-white px-4 py-2 rounded-lg font-bold hover:bg-orange-600 transition"
                >
                    + 일정 추가
                </button>
            </div>

            {/* Form */}
            {showForm && (
                <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-6 mb-6 shadow-sm space-y-4">
                    <h3 className="font-bold text-lg text-gray-900">{editingId ? "일정 수정" : "새 일정 추가"}</h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="sm:col-span-2">
                            <label className="block text-sm font-bold text-gray-700 mb-1">제목 *</label>
                            <input
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                required
                                placeholder="예: 3월 개강"
                                className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-brand-orange-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">시작일 *</label>
                            <input
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                required
                                className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-brand-orange-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">종료일 (선택)</label>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-brand-orange-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">카테고리</label>
                            <select
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-brand-orange-500"
                            >
                                {CATEGORIES.map((c) => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                        </div>
                        <div className="sm:col-span-2">
                            <label className="block text-sm font-bold text-gray-700 mb-1">설명 (선택)</label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                rows={2}
                                placeholder="일정에 대한 추가 설명"
                                className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-brand-orange-500"
                            />
                        </div>
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
                            {busy ? "저장 중..." : editingId ? "수정" : "추가"}
                        </button>
                    </div>
                </form>
            )}

            {/* Event list */}
            {events.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
                    등록된 일정이 없습니다. &quot;일정 추가&quot; 버튼으로 새 일정을 등록하세요.
                </div>
            ) : (
                <div className="space-y-6">
                    {years.map((year) => (
                        <div key={year}>
                            <h2 className="text-lg font-bold text-gray-800 mb-3">{year}년</h2>
                            <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
                                {eventsByYear[year].map((ev) => (
                                    <div key={ev.id} className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
                                        <div className="flex items-center gap-4 min-w-0">
                                            <div className="text-sm font-mono text-gray-500 shrink-0 w-24">
                                                {toDateString(ev.date).slice(5)}
                                                {ev.endDate && ` ~ ${toDateString(ev.endDate).slice(5)}`}
                                            </div>
                                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${CATEGORY_COLORS[ev.category || "일반"] || CATEGORY_COLORS["일반"]}`}>
                                                {ev.category || "일반"}
                                            </span>
                                            <div className="min-w-0">
                                                <p className="font-bold text-gray-900 truncate">{ev.title}</p>
                                                {ev.description && (
                                                    <p className="text-xs text-gray-500 truncate">{ev.description}</p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0 ml-4">
                                            <button
                                                onClick={() => startEdit(ev)}
                                                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                                            >
                                                수정
                                            </button>
                                            {deleteConfirm === ev.id ? (
                                                <div className="flex gap-1">
                                                    <button
                                                        onClick={() => handleDelete(ev.id)}
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
                                                    onClick={() => setDeleteConfirm(ev.id)}
                                                    className="text-sm text-red-500 hover:text-red-700 font-medium"
                                                >
                                                    삭제
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
