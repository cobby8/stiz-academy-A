"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link"; // 클래스 상세 페이지 링크용
import { deleteClass } from "@/app/actions/admin";

const ClassFormPanel = dynamic(() => import("./ClassFormPanel"), {
    loading: () => null,
});

export type Program = { id: string; name: string };
export type ClassItem = {
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

type ClassesPayload = {
    programs: Program[];
    classes: ClassItem[];
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

function ClassesLoadingFallback() {
    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div className="space-y-2">
                    <div className="h-8 w-40 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                    <div className="h-4 w-80 rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
                </div>
                <div className="h-10 w-24 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
            </div>
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
                <div className="h-16 border-b border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-900/50 animate-pulse" />
                {Array.from({ length: 7 }).map((_, index) => (
                    <div
                        key={index}
                        className="h-16 border-b border-gray-100 bg-white last:border-b-0 dark:border-gray-700 dark:bg-gray-800 animate-pulse"
                    />
                ))}
            </div>
        </div>
    );
}

function ClassesErrorState({ onRetry }: { onRetry: () => void }) {
    return (
        <div className="rounded-2xl border border-red-100 bg-white p-8 text-center shadow-sm dark:border-red-900/40 dark:bg-gray-800">
            <span className="material-symbols-outlined mb-3 text-4xl text-red-500">error</span>
            <p className="font-bold text-gray-900 dark:text-white">반 목록을 불러오지 못했습니다.</p>
            <button
                type="button"
                onClick={onRetry}
                className="mt-4 rounded-xl bg-brand-orange-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-orange-600 dark:bg-brand-neon-lime dark:text-brand-navy-900"
            >
                다시 시도
            </button>
        </div>
    );
}

export default function ClassManagementClient({
    programs: initialPrograms,
    classes: initialClasses,
}: {
    programs?: Program[];
    classes?: ClassItem[];
}) {
    const hasInitialData = Boolean(initialPrograms || initialClasses);
    const [programs, setPrograms] = useState<Program[]>(initialPrograms ?? []);
    const [classes, setClasses] = useState<ClassItem[]>(initialClasses ?? []);
    const [loading, setLoading] = useState(!hasInitialData);
    const [loadError, setLoadError] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [editingClass, setEditingClass] = useState<ClassItem | null>(null);
    const [busy, setBusy] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

    const loadClasses = useCallback(async () => {
        setLoading(true);
        setLoadError(false);

        try {
            const response = await fetch("/api/admin/classes", { cache: "no-store" });
            if (!response.ok) {
                throw new Error("Failed to load classes.");
            }

            const data = (await response.json()) as ClassesPayload;
            setPrograms(data.programs);
            setClasses(data.classes);
        } catch (error) {
            console.error("Failed to load classes:", error);
            setLoadError(true);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (hasInitialData) return;
        void loadClasses();
    }, [hasInitialData, loadClasses]);

    function resetForm() {
        setShowForm(false);
        setEditingClass(null);
    }

    function startEdit(c: ClassItem) {
        setEditingClass(c);
        setShowForm(true);
    }

    async function handleDelete(id: string) {
        setBusy(true);
        try {
            await deleteClass(id);
            setDeleteConfirm(null);
            await loadClasses();
        } catch (err: any) {
            alert(err.message || "삭제 실패");
        } finally {
            setBusy(false);
        }
    }

    if (loading && classes.length === 0 && programs.length === 0) {
        return <ClassesLoadingFallback />;
    }

    if (loadError && classes.length === 0 && programs.length === 0) {
        return <ClassesErrorState onRetry={loadClasses} />;
    }

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">클래스(반) 관리</h1>
                    <p className="text-gray-500 dark:text-gray-400">각 프로그램별 요일과 시간에 맞는 실제 반을 개설합니다.</p>
                </div>
                <button
                    onClick={() => { setEditingClass(null); setShowForm(true); }}
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
                <ClassFormPanel
                    programs={programs}
                    classItem={editingClass}
                    onClose={resetForm}
                    onSaved={async () => {
                        resetForm();
                        await loadClasses();
                    }}
                />
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
                                            prefetch={false}
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
