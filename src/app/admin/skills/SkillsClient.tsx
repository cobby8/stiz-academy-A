"use client";

import { useState, useMemo, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import SkillRadarChart from "@/components/SkillRadarChart";
import {
    createSkillCategory,
    updateSkillCategory,
    deleteSkillCategory,
    recordSkillAssessment,
} from "@/app/actions/admin";


// ── 타입 정의 ──────────────────────────────────────────────
interface Category {
    id: string;
    name: string;
    icon: string | null;
    order: number;
    maxLevel: number;
    description: string | null;
}

interface Student {
    id: string;
    name: string;
    parent: { name: string | null };
}

interface SkillRecord {
    categoryId: string;
    level: number;
    assessedBy: string;
    assessedAt: string;
    note: string | null;
    categoryName: string;
}

interface Props {
    categories: Category[];
    students: Student[];
}

export default function SkillsClient({ categories, students }: Props) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    // 탭 전환: "categories" (카테고리 관리) / "assessment" (스킬 평가)
    const [tab, setTab] = useState<"categories" | "assessment">("categories");

    return (
        <div>
            {/* 페이지 헤더 */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">스킬 트래킹</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        원생별 기술 수준을 평가하고 성장 기록을 관리합니다.
                    </p>
                </div>
            </div>

            {/* 탭 전환 */}
            <div className="flex gap-1 mb-6 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 w-fit">
                <button
                    onClick={() => setTab("categories")}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                        tab === "categories"
                            ? "bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm"
                            : "text-gray-500 hover:text-gray-700 dark:text-gray-200"
                    }`}
                >
                    <span className="material-symbols-outlined text-[18px] align-middle mr-1">
                        category
                    </span>
                    카테고리 관리
                </button>
                <button
                    onClick={() => setTab("assessment")}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                        tab === "assessment"
                            ? "bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm"
                            : "text-gray-500 hover:text-gray-700 dark:text-gray-200"
                    }`}
                >
                    <span className="material-symbols-outlined text-[18px] align-middle mr-1">
                        trending_up
                    </span>
                    스킬 평가
                </button>
            </div>

            {/* 탭 콘텐츠 */}
            {tab === "categories" ? (
                <CategoryTab
                    categories={categories}
                    isPending={isPending}
                    startTransition={startTransition}
                    router={router}
                />
            ) : (
                <AssessmentTab
                    categories={categories}
                    students={students}
                    isPending={isPending}
                    startTransition={startTransition}
                    router={router}
                />
            )}
        </div>
    );
}

// ══════════════════════════════════════════════════════════
// 탭 1: 카테고리 관리 — CRUD
// ══════════════════════════════════════════════════════════
function CategoryTab({
    categories,
    isPending,
    startTransition,
    router,
}: {
    categories: Category[];
    isPending: boolean;
    startTransition: (fn: () => void) => void;
    router: ReturnType<typeof useRouter>;
}) {
    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [form, setForm] = useState({
        name: "",
        icon: "",
        order: 0,
        maxLevel: 5,
        description: "",
    });

    // 카테고리 등록/수정 폼 열기
    const openCreate = () => {
        setEditId(null);
        setForm({ name: "", icon: "", order: categories.length, maxLevel: 5, description: "" });
        setShowForm(true);
    };

    const openEdit = (cat: Category) => {
        setEditId(cat.id);
        setForm({
            name: cat.name,
            icon: cat.icon || "",
            order: cat.order,
            maxLevel: cat.maxLevel,
            description: cat.description || "",
        });
        setShowForm(true);
    };

    // 저장 (등록 또는 수정)
    const handleSave = async () => {
        if (!form.name.trim()) return;
        startTransition(async () => {
            if (editId) {
                await updateSkillCategory(editId, {
                    name: form.name.trim(),
                    icon: form.icon.trim() || undefined,
                    order: form.order,
                    maxLevel: form.maxLevel,
                    description: form.description.trim() || undefined,
                });
            } else {
                await createSkillCategory({
                    name: form.name.trim(),
                    icon: form.icon.trim() || undefined,
                    order: form.order,
                    maxLevel: form.maxLevel,
                    description: form.description.trim() || undefined,
                });
            }
            setShowForm(false);
            router.refresh();
        });
    };

    // 삭제
    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`"${name}" 카테고리를 삭제하시겠습니까?\n해당 카테고리의 모든 평가 기록도 함께 삭제됩니다.`)) return;
        startTransition(async () => {
            await deleteSkillCategory(id);
            router.refresh();
        });
    };

    return (
        <div>
            {/* 카테고리 목록 */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                        평가 카테고리 ({categories.length}개)
                    </h3>
                    <button
                        onClick={openCreate}
                        className="flex items-center gap-1 px-4 py-2 bg-brand-orange-500 dark:bg-brand-neon-lime dark:text-brand-navy-900 text-white text-sm font-medium rounded-lg hover:bg-orange-600 transition-colors"
                    >
                        <span className="material-symbols-outlined text-[18px]">add</span>
                        카테고리 추가
                    </button>
                </div>

                {categories.length === 0 ? (
                    <div className="py-16 text-center text-gray-400">
                        <span className="material-symbols-outlined text-5xl mb-3 block">
                            sports_basketball
                        </span>
                        <p className="text-sm">등록된 카테고리가 없습니다.</p>
                        <p className="text-xs mt-1">
                            드리블, 슈팅, 패스 등 평가 항목을 추가해보세요.
                        </p>
                    </div>
                ) : (
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400 text-xs">
                            <tr>
                                <th className="text-left px-6 py-3">순서</th>
                                <th className="text-left px-6 py-3">아이콘</th>
                                <th className="text-left px-6 py-3">이름</th>
                                <th className="text-left px-6 py-3">최대 레벨</th>
                                <th className="text-left px-6 py-3">설명</th>
                                <th className="text-right px-6 py-3">관리</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {categories.map((cat) => (
                                <tr key={cat.id} className="hover:bg-gray-50 dark:bg-gray-900">
                                    <td className="px-6 py-3 text-gray-500 dark:text-gray-400">{cat.order}</td>
                                    <td className="px-6 py-3">
                                        {cat.icon ? (
                                            <span className="material-symbols-outlined text-[20px] text-gray-600 dark:text-gray-300">
                                                {cat.icon}
                                            </span>
                                        ) : (
                                            <span className="text-gray-300">-</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-3 font-medium text-gray-900 dark:text-white">
                                        {cat.name}
                                    </td>
                                    <td className="px-6 py-3 text-gray-600 dark:text-gray-300">{cat.maxLevel}</td>
                                    <td className="px-6 py-3 text-gray-500 dark:text-gray-400 truncate max-w-[200px]">
                                        {cat.description || "-"}
                                    </td>
                                    <td className="px-6 py-3 text-right">
                                        <button
                                            onClick={() => openEdit(cat)}
                                            className="text-blue-600 hover:text-blue-800 mr-3"
                                        >
                                            수정
                                        </button>
                                        <button
                                            onClick={() => handleDelete(cat.id, cat.name)}
                                            className="text-red-500 hover:text-red-700"
                                            disabled={isPending}
                                        >
                                            삭제
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* 등록/수정 모달 */}
            {showForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                            {editId ? "카테고리 수정" : "카테고리 추가"}
                        </h3>
                        <div className="space-y-4">
                            {/* 이름 */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                                    이름 *
                                </label>
                                <input
                                    type="text"
                                    value={form.name}
                                    onChange={(e) =>
                                        setForm((f) => ({ ...f, name: e.target.value }))
                                    }
                                    placeholder="예: 드리블"
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                                />
                            </div>
                            {/* 아이콘 (Material Symbols 이름) */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                                    아이콘 (Material Symbols)
                                </label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        value={form.icon}
                                        onChange={(e) =>
                                            setForm((f) => ({ ...f, icon: e.target.value }))
                                        }
                                        placeholder="예: sports_basketball"
                                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                                    />
                                    {form.icon && (
                                        <span className="material-symbols-outlined text-[24px] text-gray-600 dark:text-gray-300">
                                            {form.icon}
                                        </span>
                                    )}
                                </div>
                            </div>
                            {/* 순서 + 최대 레벨 */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                                        순서
                                    </label>
                                    <input
                                        type="number"
                                        value={form.order}
                                        onChange={(e) =>
                                            setForm((f) => ({
                                                ...f,
                                                order: parseInt(e.target.value) || 0,
                                            }))
                                        }
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                                        최대 레벨
                                    </label>
                                    <input
                                        type="number"
                                        min={1}
                                        max={10}
                                        value={form.maxLevel}
                                        onChange={(e) =>
                                            setForm((f) => ({
                                                ...f,
                                                maxLevel: parseInt(e.target.value) || 5,
                                            }))
                                        }
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                                    />
                                </div>
                            </div>
                            {/* 설명 */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                                    설명
                                </label>
                                <textarea
                                    value={form.description}
                                    onChange={(e) =>
                                        setForm((f) => ({ ...f, description: e.target.value }))
                                    }
                                    placeholder="이 카테고리에 대한 간단한 설명"
                                    rows={2}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                                />
                            </div>
                        </div>
                        {/* 버튼 */}
                        <div className="flex justify-end gap-3 mt-6">
                            <button
                                onClick={() => setShowForm(false)}
                                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 dark:text-gray-100"
                            >
                                취소
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={isPending || !form.name.trim()}
                                className="px-4 py-2 bg-brand-orange-500 dark:bg-brand-neon-lime dark:text-brand-navy-900 text-white text-sm font-medium rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50"
                            >
                                {isPending ? "저장 중..." : editId ? "수정" : "추가"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ══════════════════════════════════════════════════════════
// 탭 2: 스킬 평가 — 원생 선택 → 레이더 차트 + 레벨 슬라이더 + 이력
// ══════════════════════════════════════════════════════════
function AssessmentTab({
    categories,
    students,
    isPending,
    startTransition,
    router,
}: {
    categories: Category[];
    students: Student[];
    isPending: boolean;
    startTransition: (fn: () => void) => void;
    router: ReturnType<typeof useRouter>;
}) {
    const [selectedStudentId, setSelectedStudentId] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    // 현재 스킬 데이터 (서버에서 가져온 최신 값)
    const [currentSkills, setCurrentSkills] = useState<SkillRecord[]>([]);
    // 평가 입력값 (카테고리ID → {level, note})
    const [assessments, setAssessments] = useState<
        Record<string, { level: number; note: string }>
    >({});
    // 성장 이력
    const [history, setHistory] = useState<SkillRecord[]>([]);
    const [loadingSkills, setLoadingSkills] = useState(false);
    const [assessedBy, setAssessedBy] = useState("관리자");

    // 원생 검색 필터
    const filteredStudents = useMemo(() => {
        if (!searchQuery.trim()) return students;
        const q = searchQuery.toLowerCase();
        return students.filter(
            (s) =>
                s.name.toLowerCase().includes(q) ||
                (s.parent?.name || "").toLowerCase().includes(q),
        );
    }, [students, searchQuery]);

    // 원생 선택 시 스킬 데이터 로드
    const handleSelectStudent = useCallback(
        async (studentId: string) => {
            setSelectedStudentId(studentId);
            if (!studentId) {
                setCurrentSkills([]);
                setHistory([]);
                setAssessments({});
                return;
            }
            setLoadingSkills(true);
            try {
                // Server Action 대신 queries 함수를 서버에서 가져오는 방식은
                // 클라이언트에서 직접 호출 불가 → fetch API를 통해 page에서 처리하거나
                // 여기서는 Server Action 래퍼를 사용
                const res = await fetch(
                    `/api/admin/skills?studentId=${studentId}`,
                );
                if (res.ok) {
                    const data = await res.json();
                    setCurrentSkills(data.skills || []);
                    setHistory(data.history || []);
                    // 기존 스킬 레벨을 기본값으로 설정
                    const initial: Record<string, { level: number; note: string }> = {};
                    for (const cat of categories) {
                        const existing = (data.skills || []).find(
                            (s: SkillRecord) => s.categoryId === cat.id,
                        );
                        initial[cat.id] = {
                            level: existing ? existing.level : 0,
                            note: "",
                        };
                    }
                    setAssessments(initial);
                }
            } catch (e) {
                console.error("Failed to load student skills:", e);
            }
            setLoadingSkills(false);
        },
        [categories],
    );

    // 레벨 변경 핸들러
    const handleLevelChange = (categoryId: string, level: number) => {
        setAssessments((prev) => ({
            ...prev,
            [categoryId]: { ...prev[categoryId], level, note: prev[categoryId]?.note || "" },
        }));
    };

    // 노트 변경 핸들러
    const handleNoteChange = (categoryId: string, note: string) => {
        setAssessments((prev) => ({
            ...prev,
            [categoryId]: { ...prev[categoryId], note, level: prev[categoryId]?.level ?? 0 },
        }));
    };

    // 평가 저장
    const handleSaveAssessment = async () => {
        if (!selectedStudentId || categories.length === 0) return;
        // 레벨이 0보다 큰 항목만 저장
        const items = Object.entries(assessments)
            .filter(([, v]) => v.level > 0)
            .map(([categoryId, v]) => ({
                categoryId,
                level: v.level,
                note: v.note.trim() || undefined,
            }));
        if (items.length === 0) {
            alert("평가할 항목이 없습니다. 레벨을 1 이상으로 설정해주세요.");
            return;
        }
        startTransition(async () => {
            await recordSkillAssessment(selectedStudentId, items, assessedBy);
            // 저장 후 데이터 리로드
            await handleSelectStudent(selectedStudentId);
            router.refresh();
        });
    };

    // 레이더 차트용 데이터
    const chartCategories = categories.map((c) => ({
        name: c.name,
        maxLevel: c.maxLevel,
    }));
    const chartValues = categories.map(
        (c) => assessments[c.id]?.level ?? 0,
    );

    if (categories.length === 0) {
        return (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 py-16 text-center text-gray-400">
                <span className="material-symbols-outlined text-5xl mb-3 block">
                    warning
                </span>
                <p className="text-sm">먼저 카테고리를 추가해주세요.</p>
                <p className="text-xs mt-1">
                    &quot;카테고리 관리&quot; 탭에서 평가 항목을 등록한 후 스킬 평가를 진행할 수 있습니다.
                </p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 좌측: 원생 선택 + 레벨 슬라이더 */}
            <div className="lg:col-span-2 space-y-6">
                {/* 원생 선택 */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-4">원생 선택</h3>
                    <div className="flex gap-3">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="원생 이름으로 검색..."
                            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                        />
                        <select
                            value={selectedStudentId}
                            onChange={(e) => handleSelectStudent(e.target.value)}
                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 min-w-[200px]"
                        >
                            <option value="">-- 원생 선택 --</option>
                            {filteredStudents.map((s) => (
                                <option key={s.id} value={s.id}>
                                    {s.name}
                                    {s.parent?.name ? ` (${s.parent.name})` : ""}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* 평가 입력 */}
                {selectedStudentId && (
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-semibold text-gray-900 dark:text-white">
                                스킬 평가
                            </h3>
                            <div className="flex items-center gap-2">
                                <label className="text-xs text-gray-500 dark:text-gray-400">평가자:</label>
                                <input
                                    type="text"
                                    value={assessedBy}
                                    onChange={(e) => setAssessedBy(e.target.value)}
                                    className="border border-gray-300 rounded px-2 py-1 text-sm w-24"
                                />
                            </div>
                        </div>

                        {loadingSkills ? (
                            <div className="py-8 text-center text-gray-400">
                                <span className="material-symbols-outlined animate-spin text-3xl">
                                    progress_activity
                                </span>
                                <p className="text-sm mt-2">로딩 중...</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {categories.map((cat) => {
                                    const val = assessments[cat.id]?.level ?? 0;
                                    return (
                                        <div
                                            key={cat.id}
                                            className="border border-gray-100 dark:border-gray-800 rounded-lg p-4"
                                        >
                                            <div className="flex items-center gap-2 mb-2">
                                                {cat.icon && (
                                                    <span className="material-symbols-outlined text-[20px] text-gray-500 dark:text-gray-400">
                                                        {cat.icon}
                                                    </span>
                                                )}
                                                <span className="font-medium text-gray-800 dark:text-gray-100">
                                                    {cat.name}
                                                </span>
                                                <span className="ml-auto text-sm font-bold text-orange-600">
                                                    {val} / {cat.maxLevel}
                                                </span>
                                            </div>
                                            {/* 레벨 슬라이더 */}
                                            <input
                                                type="range"
                                                min={0}
                                                max={cat.maxLevel}
                                                value={val}
                                                onChange={(e) =>
                                                    handleLevelChange(
                                                        cat.id,
                                                        parseInt(e.target.value),
                                                    )
                                                }
                                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-orange-500"
                                            />
                                            {/* 레벨 버튼 — 빠른 선택용 */}
                                            <div className="flex gap-1 mt-2">
                                                {Array.from(
                                                    { length: cat.maxLevel + 1 },
                                                    (_, i) => (
                                                        <button
                                                            key={i}
                                                            onClick={() =>
                                                                handleLevelChange(cat.id, i)
                                                            }
                                                            className={`w-8 h-8 rounded-full text-xs font-bold transition-colors ${
                                                                val === i
                                                                    ? "bg-orange-500 text-white"
                                                                    : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200"
                                                            }`}
                                                        >
                                                            {i}
                                                        </button>
                                                    ),
                                                )}
                                            </div>
                                            {/* 노트 입력 */}
                                            <input
                                                type="text"
                                                value={assessments[cat.id]?.note || ""}
                                                onChange={(e) =>
                                                    handleNoteChange(cat.id, e.target.value)
                                                }
                                                placeholder="코멘트 (선택)"
                                                className="w-full mt-2 border border-gray-200 dark:border-gray-700 rounded px-2 py-1 text-sm text-gray-600 dark:text-gray-300 placeholder:text-gray-300"
                                            />
                                        </div>
                                    );
                                })}

                                {/* 저장 버튼 */}
                                <button
                                    onClick={handleSaveAssessment}
                                    disabled={isPending}
                                    className="w-full py-3 bg-brand-orange-500 dark:bg-brand-neon-lime dark:text-brand-navy-900 text-white font-medium rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50"
                                >
                                    {isPending ? "저장 중..." : "평가 저장"}
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* 우측: 레이더 차트 + 성장 이력 */}
            <div className="space-y-6">
                {/* 레이더 차트 */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-4 text-center">
                        스킬 레이더
                    </h3>
                    {selectedStudentId ? (
                        <SkillRadarChart
                            categories={chartCategories}
                            values={chartValues}
                        />
                    ) : (
                        <div className="py-8 text-center text-gray-300 text-sm">
                            원생을 선택하면 레이더 차트가 표시됩니다.
                        </div>
                    )}
                </div>

                {/* 성장 이력 타임라인 */}
                {selectedStudentId && history.length > 0 && (
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">성장 이력</h3>
                        <div className="space-y-3 max-h-[400px] overflow-y-auto">
                            {history.map((h) => (
                                <div
                                    key={h.assessedAt + h.categoryId}
                                    className="flex items-start gap-3 border-l-2 border-orange-300 pl-3"
                                >
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium text-gray-800 dark:text-gray-100">
                                                {h.categoryName}
                                            </span>
                                            <span className="text-xs font-bold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded">
                                                Lv.{h.level}
                                            </span>
                                        </div>
                                        {h.note && (
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                                                {h.note}
                                            </p>
                                        )}
                                        <p className="text-xs text-gray-400 mt-0.5">
                                            {new Date(h.assessedAt).toLocaleDateString("ko-KR")} /{" "}
                                            {h.assessedBy}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
