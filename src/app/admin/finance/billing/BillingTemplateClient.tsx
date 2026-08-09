"use client";

import { useCallback, useEffect, useState } from "react";
import {
    createBillingTemplate,
    updateBillingTemplate,
    deleteBillingTemplate,
} from "@/app/actions/admin";
import AdminQuickActionMenu from "@/components/admin/AdminQuickActionMenu";

// 청구 유형 라벨 매핑
const TYPE_LABELS: Record<string, string> = {
    MONTHLY: "월 수강료",
    SHUTTLE: "셔틀",
    UNIFORM: "유니폼",
    OTHER: "기타",
};

type Template = {
    id: string;
    name: string;
    amount: number;
    type: string;
    description: string | null;
    isActive: boolean;
    dueDay: number;
    programId: string | null;
    createdAt: Date | string;
    updatedAt: Date | string;
};

type Program = {
    id: string;
    name: string;
};

type BillingTemplatePayload = {
    templates: Template[];
    programs: Program[];
};

function formatAmount(n: number): string {
    return n.toLocaleString("ko-KR") + "원";
}

function getErrorMessage(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : fallback;
}

function BillingTemplateLoadingFallback() {
    return (
        <div className="mx-auto max-w-4xl">
            <div className="mb-6 flex items-center justify-between gap-4">
                <div>
                    <div className="h-8 w-52 rounded bg-[var(--doc-grid-head)]" />
                    <div className="mt-2 h-4 w-96 max-w-full rounded bg-[var(--doc-grid-head)]" />
                </div>
                <div className="h-10 w-32 rounded-[3px] bg-[var(--doc-grid-head)]" />
            </div>
            <div className="overflow-hidden rounded-[3px] border border-[var(--doc-rule)] bg-[var(--doc-surface)]">
                <div className="overflow-x-auto">
                    <div className="min-w-[760px]">
                        <div className="grid grid-cols-[1.6fr_0.8fr_0.8fr_0.8fr_0.7fr_0.8fr] gap-4 bg-[var(--doc-grid-head)] px-5 py-3">
                            {Array.from({ length: 6 }).map((_, index) => (
                                <div key={index} className="h-4 rounded bg-[var(--doc-grid-head)]" />
                            ))}
                        </div>
                        <div className="divide-y divide-[var(--doc-rule)] dark:divide-[var(--doc-rule)]">
                            {Array.from({ length: 6 }).map((_, rowIndex) => (
                                <div
                                    key={rowIndex}
                                    className="grid grid-cols-[1.6fr_0.8fr_0.8fr_0.8fr_0.7fr_0.8fr] gap-4 px-5 py-4"
                                >
                                    <div className="space-y-2">
                                        <div className="h-5 w-36 rounded bg-[var(--doc-grid-head)]" />
                                        <div className="h-3 w-48 rounded bg-[var(--doc-grid-head)]" />
                                    </div>
                                    <div className="h-5 w-20 rounded bg-[var(--doc-grid-head)]" />
                                    <div className="h-5 w-24 rounded bg-[var(--doc-grid-head)]" />
                                    <div className="h-5 w-20 rounded bg-[var(--doc-grid-head)]" />
                                    <div className="h-6 w-12 rounded-[3px] bg-[var(--doc-grid-head)]" />
                                    <div className="ml-auto h-5 w-20 rounded bg-[var(--doc-grid-head)]" />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function BillingTemplateErrorState({ onRetry }: { onRetry: () => void }) {
    return (
        <div className="mx-auto max-w-4xl rounded-[6px] border border-[var(--doc-crit)] bg-[var(--doc-surface)] p-8 text-center">
            <span className="material-symbols-outlined mb-3 text-4xl text-[var(--doc-crit)]">error</span>
            <p className="font-bold text-[var(--doc-ink)]">청구 템플릿을 불러오지 못했습니다.</p>
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

export default function BillingTemplateClient({
    initialTemplates,
    programs: initialPrograms,
}: {
    initialTemplates?: Template[];
    programs?: Program[];
}) {
    const hasInitialData = Boolean(initialTemplates || initialPrograms);
    const [templates, setTemplates] = useState(initialTemplates ?? []);
    const [programs, setPrograms] = useState(initialPrograms ?? []);
    const [loading, setLoading] = useState(!hasInitialData);
    const [loadError, setLoadError] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    // 폼 상태
    const [name, setName] = useState("");
    const [amount, setAmount] = useState(0);
    const [type, setType] = useState("MONTHLY");
    const [description, setDescription] = useState("");
    const [dueDay, setDueDay] = useState(10);
    const [programId, setProgramId] = useState<string>("");

    const loadBillingTemplates = useCallback(async () => {
        setLoading(true);
        setLoadError(false);

        try {
            const response = await fetch("/api/admin/finance/billing", { cache: "no-store" });
            if (!response.ok) {
                throw new Error("Failed to load billing templates.");
            }

            const data = (await response.json()) as BillingTemplatePayload;
            setTemplates(data.templates);
            setPrograms(data.programs);
        } catch (error) {
            console.error("Failed to load billing templates:", error);
            setLoadError(true);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (hasInitialData) return;
        void loadBillingTemplates();
    }, [hasInitialData, loadBillingTemplates]);

    // 폼 초기화
    function resetForm() {
        setName("");
        setAmount(0);
        setType("MONTHLY");
        setDescription("");
        setDueDay(10);
        setProgramId("");
        setEditId(null);
        setShowForm(false);
    }

    // 수정 모드 진입: 기존 데이터를 폼에 채움
    function startEdit(tpl: Template) {
        setEditId(tpl.id);
        setName(tpl.name);
        setAmount(tpl.amount);
        setType(tpl.type);
        setDescription(tpl.description || "");
        setDueDay(tpl.dueDay);
        setProgramId(tpl.programId || "");
        setShowForm(true);
    }

    // 생성 또는 수정 저장
    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!name || !amount) return;
        setBusy(true);
        try {
            const payload = {
                name,
                amount,
                type,
                description: description || undefined,
                dueDay,
                programId: programId || null,
            };
            if (editId) {
                await updateBillingTemplate(editId, payload);
            } else {
                await createBillingTemplate(payload);
            }
            resetForm();
            await loadBillingTemplates();
        } catch (err: unknown) {
            alert(getErrorMessage(err, "저장 실패"));
        } finally {
            setBusy(false);
        }
    }

    // 활성/비활성 토글
    async function toggleActive(tpl: Template) {
        setBusy(true);
        try {
            await updateBillingTemplate(tpl.id, { isActive: !tpl.isActive });
            await loadBillingTemplates();
        } catch (err: unknown) {
            alert(getErrorMessage(err, "상태 변경 실패"));
        } finally {
            setBusy(false);
        }
    }

    // 삭제
    async function handleDelete(id: string) {
        setBusy(true);
        try {
            await deleteBillingTemplate(id);
            await loadBillingTemplates();
        } catch (err: unknown) {
            alert(getErrorMessage(err, "삭제 실패"));
        } finally {
            setBusy(false);
        }
    }

    if (loading && templates.length === 0 && programs.length === 0) {
        return <BillingTemplateLoadingFallback />;
    }

    if (loadError && templates.length === 0 && programs.length === 0) {
        return <BillingTemplateErrorState onRetry={loadBillingTemplates} />;
    }

    return (
        <div className="max-w-4xl mx-auto">
            {/* 헤더 */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-[var(--doc-ink)]">청구 템플릿 설정</h1>
                </div>
                <button
                    onClick={() => { resetForm(); setShowForm(!showForm); }}
                    className="bg-[var(--doc-accent)] dark:text-[var(--doc-ink)] text-white px-4 py-2 rounded-[3px] font-bold hover:bg-[var(--doc-grid-head)] transition"
                >
                    + 템플릿 추가
                </button>
            </div>

            {/* 생성/수정 폼 */}
            {showForm && (
                <form onSubmit={handleSubmit} className="bg-[var(--doc-surface)] border border-[var(--doc-rule)] rounded-[3px] p-6 mb-6 space-y-4">
                    <h3 className="font-bold text-lg text-[var(--doc-ink)]">
                        {editId ? "템플릿 수정" : "새 청구 템플릿"}
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {/* 템플릿 이름 */}
                        <div>
                            <label className="block text-sm font-bold text-[var(--doc-ink-2)] mb-1">이름 *</label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                                placeholder="예: 초등 주3회 수강료"
                                className="w-full border border-[var(--doc-rule)] rounded-[3px] p-2.5 text-sm focus: focus:ring-brand-orange-500 dark:focus:ring-brand-neon-lime"
                            />
                        </div>
                        {/* 금액 */}
                        <div>
                            <label className="block text-sm font-bold text-[var(--doc-ink-2)] mb-1">금액 (원) *</label>
                            <input
                                type="number"
                                value={amount || ""}
                                onChange={(e) => setAmount(parseInt(e.target.value) || 0)}
                                required
                                placeholder="150000"
                                className="w-full border border-[var(--doc-rule)] rounded-[3px] p-2.5 text-sm focus: focus:ring-brand-orange-500 dark:focus:ring-brand-neon-lime"
                            />
                        </div>
                        {/* 유형 */}
                        <div>
                            <label className="block text-sm font-bold text-[var(--doc-ink-2)] mb-1">유형</label>
                            <select
                                value={type}
                                onChange={(e) => setType(e.target.value)}
                                className="w-full border border-[var(--doc-rule)] rounded-[3px] p-2.5 text-sm focus: focus:ring-brand-orange-500 dark:focus:ring-brand-neon-lime bg-[var(--doc-surface)]"
                            >
                                <option value="MONTHLY">월 수강료</option>
                                <option value="SHUTTLE">셔틀</option>
                                <option value="UNIFORM">유니폼</option>
                                <option value="OTHER">기타</option>
                            </select>
                        </div>
                        {/* 납부기한일 */}
                        <div>
                            <label className="block text-sm font-bold text-[var(--doc-ink-2)] mb-1">납부기한</label>
                            {/*
                              납부기한은 이용약관("수강일 전까지")에 따라 자동 계산되므로
                              더 이상 템플릿마다 다르게 지정하지 않는다. 값은 옛 데이터 호환용으로만 남긴다.
                            */}
                            <input
                                type="text"
                                readOnly
                                disabled
                                value="약관 기준 자동 (수강 개시일 전날 = 전월 말일)"
                                className="w-full border border-[var(--doc-rule)] rounded-[3px] p-2.5 text-sm bg-[var(--doc-grid-head)] text-[var(--doc-ink-2)]"
                            />
                            <p className="text-xs text-[var(--doc-ink-3)] mt-1">예: 8월 수강료 → 7월 31일까지</p>
                        </div>
                        {/* 연결 프로그램 */}
                        <div>
                            <label className="block text-sm font-bold text-[var(--doc-ink-2)] mb-1">연결 프로그램 (선택)</label>
                            <select
                                value={programId}
                                onChange={(e) => setProgramId(e.target.value)}
                                className="w-full border border-[var(--doc-rule)] rounded-[3px] p-2.5 text-sm focus: focus:ring-brand-orange-500 dark:focus:ring-brand-neon-lime bg-[var(--doc-surface)]"
                            >
                                <option value="">전체 수강생</option>
                                {programs.map((p) => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                        </div>
                        {/* 설명 */}
                        <div>
                            <label className="block text-sm font-bold text-[var(--doc-ink-2)] mb-1">설명 (선택)</label>
                            <input
                                type="text"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="청구서에 표시될 설명"
                                className="w-full border border-[var(--doc-rule)] rounded-[3px] p-2.5 text-sm focus: focus:ring-brand-orange-500 dark:focus:ring-brand-neon-lime"
                            />
                        </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                        <button type="button" onClick={resetForm} className="px-4 py-2 text-sm text-[var(--doc-ink-2)]">
                            취소
                        </button>
                        <button
                            type="submit"
                            disabled={busy}
                            className="bg-[var(--doc-accent)] dark:text-[var(--doc-ink)] text-white px-6 py-2 rounded-[3px] font-bold hover:bg-[var(--doc-grid-head)] transition disabled:opacity-50"
                        >
                            {busy ? "저장 중..." : editId ? "수정" : "추가"}
                        </button>
                    </div>
                </form>
            )}

            {/* 템플릿 목록 */}
            {templates.length === 0 ? (
                <div className="bg-[var(--doc-surface)] rounded-[3px] border border-[var(--doc-rule)] p-12 text-center text-[var(--doc-ink-3)]">
                    등록된 청구 템플릿이 없습니다.
                </div>
            ) : (
                <div className="bg-[var(--doc-surface)] rounded-[3px] border border-[var(--doc-rule)] overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-[var(--doc-rule)]">
                            <thead className="bg-[var(--doc-grid-head)]">
                                <tr>
                                    <th className="px-5 py-3 text-left text-xs font-medium text-[var(--doc-ink-2)] uppercase">이름</th>
                                    <th className="px-5 py-3 text-left text-xs font-medium text-[var(--doc-ink-2)] uppercase">유형</th>
                                    <th className="px-5 py-3 text-left text-xs font-medium text-[var(--doc-ink-2)] uppercase">금액</th>
                                    <th className="px-5 py-3 text-left text-xs font-medium text-[var(--doc-ink-2)] uppercase">납부기한일</th>
                                    <th className="px-5 py-3 text-left text-xs font-medium text-[var(--doc-ink-2)] uppercase">상태</th>
                                    <th className="px-5 py-3 text-right text-xs font-medium text-[var(--doc-ink-2)] uppercase">관리</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--doc-rule)]">
                                {templates.map((tpl) => (
                                    <tr key={tpl.id} className="hover:bg-[var(--doc-grid-head)] transition-colors">
                                        <td className="px-5 py-3.5">
                                            <div>
                                                <span className="font-medium text-[var(--doc-ink)]">{tpl.name}</span>
                                                {tpl.description && (
                                                    <p className="text-xs text-[var(--doc-ink-3)] mt-0.5">{tpl.description}</p>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-5 py-3.5 text-sm text-[var(--doc-ink-2)]">
                                            {TYPE_LABELS[tpl.type] || tpl.type}
                                        </td>
                                        <td className="px-5 py-3.5 text-sm text-[var(--doc-ink-2)] font-mono">
                                            {formatAmount(tpl.amount)}
                                        </td>
                                        <td className="px-5 py-3.5 text-sm text-[var(--doc-ink-2)]">
                                            약관 기준 (전월 말일)
                                        </td>
                                        <td className="px-5 py-3.5">
                                            <button
                                                onClick={() => toggleActive(tpl)}
                                                disabled={busy}
                                                className={`text-xs font-bold px-2 py-1 rounded-[3px] ${
 tpl.isActive
 ? "bg-[var(--doc-accent-soft)] text-[var(--doc-accent)]"
 : "bg-[var(--doc-grid-head)] text-[var(--doc-ink-2)] "
 }`}
                                            >
                                                {tpl.isActive ? "활성" : "비활성"}
                                            </button>
                                        </td>
                                        <td className="px-5 py-3.5 text-right">
                                            <AdminQuickActionMenu
                                                label={`${tpl.name} 빠른 작업`}
                                                actions={[
                                                    {
                                                        key: "edit",
                                                        label: "수정",
                                                        icon: "edit",
                                                        onSelect: () => startEdit(tpl),
                                                    },
                                                    {
                                                        key: "delete",
                                                        label: "삭제",
                                                        icon: "delete",
                                                        tone: "danger",
                                                        disabled: busy,
                                                        onSelect: () => {
                                                            if (window.confirm(`"${tpl.name}" 템플릿을 삭제할까요?`)) {
                                                                void handleDelete(tpl.id);
                                                            }
                                                        },
                                                    },
                                                ]}
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
