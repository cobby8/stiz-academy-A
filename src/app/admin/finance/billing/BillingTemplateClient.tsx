"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
    createBillingTemplate,
    updateBillingTemplate,
    deleteBillingTemplate,
} from "@/app/actions/admin";

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

function formatAmount(n: number): string {
    return n.toLocaleString("ko-KR") + "원";
}

export default function BillingTemplateClient({
    initialTemplates,
    programs,
}: {
    initialTemplates: Template[];
    programs: Program[];
}) {
    const router = useRouter();
    const [templates, setTemplates] = useState(initialTemplates);
    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

    // 폼 상태
    const [name, setName] = useState("");
    const [amount, setAmount] = useState(0);
    const [type, setType] = useState("MONTHLY");
    const [description, setDescription] = useState("");
    const [dueDay, setDueDay] = useState(10);
    const [programId, setProgramId] = useState<string>("");

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
            router.refresh();
        } catch (err: any) {
            alert(err.message || "저장 실패");
        } finally {
            setBusy(false);
        }
    }

    // 활성/비활성 토글
    async function toggleActive(tpl: Template) {
        setBusy(true);
        try {
            await updateBillingTemplate(tpl.id, { isActive: !tpl.isActive });
            router.refresh();
        } catch (err: any) {
            alert(err.message || "상태 변경 실패");
        } finally {
            setBusy(false);
        }
    }

    // 삭제
    async function handleDelete(id: string) {
        setBusy(true);
        try {
            await deleteBillingTemplate(id);
            setDeleteConfirm(null);
            router.refresh();
        } catch (err: any) {
            alert(err.message || "삭제 실패");
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="max-w-4xl mx-auto">
            {/* 헤더 */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">청구 템플릿 설정</h1>
                    <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                        매월 자동 청구서 생성에 사용되는 템플릿을 관리합니다.
                    </p>
                </div>
                <button
                    onClick={() => { resetForm(); setShowForm(!showForm); }}
                    className="bg-brand-orange-500 dark:bg-brand-neon-lime dark:text-brand-navy-900 text-white px-4 py-2 rounded-lg font-bold hover:bg-orange-600 transition"
                >
                    + 템플릿 추가
                </button>
            </div>

            {/* 생성/수정 폼 */}
            {showForm && (
                <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 mb-6 shadow-sm space-y-4">
                    <h3 className="font-bold text-lg text-gray-900 dark:text-white">
                        {editId ? "템플릿 수정" : "새 청구 템플릿"}
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {/* 템플릿 이름 */}
                        <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-200 mb-1">이름 *</label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                                placeholder="예: 초등 주3회 수강료"
                                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg p-2.5 text-sm dark:bg-gray-800 dark:text-white focus:ring-2 focus:ring-brand-orange-500 dark:focus:ring-brand-neon-lime"
                            />
                        </div>
                        {/* 금액 */}
                        <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-200 mb-1">금액 (원) *</label>
                            <input
                                type="number"
                                value={amount || ""}
                                onChange={(e) => setAmount(parseInt(e.target.value) || 0)}
                                required
                                placeholder="150000"
                                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg p-2.5 text-sm dark:bg-gray-800 dark:text-white focus:ring-2 focus:ring-brand-orange-500 dark:focus:ring-brand-neon-lime"
                            />
                        </div>
                        {/* 유형 */}
                        <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-200 mb-1">유형</label>
                            <select
                                value={type}
                                onChange={(e) => setType(e.target.value)}
                                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg p-2.5 text-sm dark:text-white focus:ring-2 focus:ring-brand-orange-500 dark:focus:ring-brand-neon-lime bg-white dark:bg-gray-800"
                            >
                                <option value="MONTHLY">월 수강료</option>
                                <option value="SHUTTLE">셔틀</option>
                                <option value="UNIFORM">유니폼</option>
                                <option value="OTHER">기타</option>
                            </select>
                        </div>
                        {/* 납부기한일 */}
                        <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-200 mb-1">매월 납부기한일</label>
                            <input
                                type="number"
                                min={1}
                                max={28}
                                value={dueDay}
                                onChange={(e) => setDueDay(parseInt(e.target.value) || 10)}
                                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg p-2.5 text-sm dark:bg-gray-800 dark:text-white focus:ring-2 focus:ring-brand-orange-500 dark:focus:ring-brand-neon-lime"
                            />
                            <p className="text-xs text-gray-400 mt-1">1~28일 (29~31일은 월에 따라 불안정)</p>
                        </div>
                        {/* 연결 프로그램 */}
                        <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-200 mb-1">연결 프로그램 (선택)</label>
                            <select
                                value={programId}
                                onChange={(e) => setProgramId(e.target.value)}
                                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg p-2.5 text-sm dark:text-white focus:ring-2 focus:ring-brand-orange-500 dark:focus:ring-brand-neon-lime bg-white dark:bg-gray-800"
                            >
                                <option value="">전체 수강생</option>
                                {programs.map((p) => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                        </div>
                        {/* 설명 */}
                        <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-200 mb-1">설명 (선택)</label>
                            <input
                                type="text"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="청구서에 표시될 설명"
                                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg p-2.5 text-sm dark:bg-gray-800 dark:text-white focus:ring-2 focus:ring-brand-orange-500 dark:focus:ring-brand-neon-lime"
                            />
                        </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                        <button type="button" onClick={resetForm} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300">
                            취소
                        </button>
                        <button
                            type="submit"
                            disabled={busy}
                            className="bg-brand-orange-500 dark:bg-brand-neon-lime dark:text-brand-navy-900 text-white px-6 py-2 rounded-lg font-bold hover:bg-orange-600 transition disabled:opacity-50"
                        >
                            {busy ? "저장 중..." : editId ? "수정" : "추가"}
                        </button>
                    </div>
                </form>
            )}

            {/* 템플릿 목록 */}
            {templates.length === 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center text-gray-400">
                    등록된 청구 템플릿이 없습니다. 위 버튼으로 추가하세요.
                </div>
            ) : (
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50 dark:bg-gray-900">
                                <tr>
                                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">이름</th>
                                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">유형</th>
                                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">금액</th>
                                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">납부기한일</th>
                                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">상태</th>
                                    <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">관리</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {templates.map((tpl) => (
                                    <tr key={tpl.id} className="hover:bg-gray-50 dark:bg-gray-900 transition-colors">
                                        <td className="px-5 py-3.5">
                                            <div>
                                                <span className="font-medium text-gray-900 dark:text-white">{tpl.name}</span>
                                                {tpl.description && (
                                                    <p className="text-xs text-gray-400 mt-0.5">{tpl.description}</p>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-5 py-3.5 text-sm text-gray-600 dark:text-gray-300">
                                            {TYPE_LABELS[tpl.type] || tpl.type}
                                        </td>
                                        <td className="px-5 py-3.5 text-sm text-gray-700 dark:text-gray-200 font-mono">
                                            {formatAmount(tpl.amount)}
                                        </td>
                                        <td className="px-5 py-3.5 text-sm text-gray-600 dark:text-gray-300">
                                            매월 {tpl.dueDay}일
                                        </td>
                                        <td className="px-5 py-3.5">
                                            <button
                                                onClick={() => toggleActive(tpl)}
                                                disabled={busy}
                                                className={`text-xs font-bold px-2 py-1 rounded-full ${
                                                    tpl.isActive
                                                        ? "bg-green-100 text-green-700"
                                                        : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
                                                }`}
                                            >
                                                {tpl.isActive ? "활성" : "비활성"}
                                            </button>
                                        </td>
                                        <td className="px-5 py-3.5 text-right">
                                            <div className="flex items-center gap-2 justify-end">
                                                <button
                                                    onClick={() => startEdit(tpl)}
                                                    className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                                                >
                                                    수정
                                                </button>
                                                {deleteConfirm === tpl.id ? (
                                                    <div className="flex gap-1">
                                                        <button
                                                            onClick={() => handleDelete(tpl.id)}
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
                                                        onClick={() => setDeleteConfirm(tpl.id)}
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
        </div>
    );
}
