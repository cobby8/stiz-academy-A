"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { createFaq, updateFaq, deleteFaq } from "@/app/actions/admin";
import AdminModal from "@/components/admin/AdminModal";

// FAQ 데이터 타입
type FaqData = {
    id: string;
    question: string;
    answer: string;
    order: number;
    isPublic: boolean;
    createdAt: Date | string;
};

type FaqPayload = {
    faqs: FaqData[];
};

function SymbolIcon({
    name,
    size = 18,
    className = "",
}: {
    name: string;
    size?: number;
    className?: string;
}) {
    return (
        <span
            className={`material-symbols-outlined leading-none ${className}`}
            style={{ fontSize: `${size}px` }}
            aria-hidden="true"
        >
            {name}
        </span>
    );
}

function FaqLoadingFallback() {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between gap-4">
                <div>
                    <div className="h-8 w-32 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                    <div className="mt-2 h-4 w-80 max-w-full animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
                </div>
                <div className="h-11 w-28 animate-pulse rounded-xl bg-gray-200 dark:bg-gray-700" />
            </div>
            <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, index) => (
                    <div
                        key={index}
                        className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800"
                    >
                        <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0 flex-1 space-y-3">
                                <div className="flex items-center gap-2">
                                    <div className="h-5 w-5 animate-pulse rounded bg-gray-100 dark:bg-gray-700" />
                                    <div className="h-5 w-2/3 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                                </div>
                                <div className="ml-7 h-4 w-full animate-pulse rounded bg-gray-100 dark:bg-gray-700" />
                                <div className="ml-7 h-4 w-3/4 animate-pulse rounded bg-gray-100 dark:bg-gray-700" />
                                <div className="ml-7 flex gap-2">
                                    <div className="h-5 w-16 animate-pulse rounded-full bg-gray-100 dark:bg-gray-700" />
                                    <div className="h-5 w-16 animate-pulse rounded-full bg-gray-100 dark:bg-gray-700" />
                                </div>
                            </div>
                            <div className="hidden gap-1 sm:flex">
                                <div className="h-8 w-8 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-700" />
                                <div className="h-8 w-8 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-700" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function FaqErrorState({ onRetry }: { onRetry: () => void }) {
    return (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-800 dark:bg-red-950/30">
            <p className="text-sm font-bold text-red-700 dark:text-red-200">FAQ를 불러오지 못했습니다.</p>
            <button
                type="button"
                onClick={onRetry}
                className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700"
            >
                다시 불러오기
            </button>
        </div>
    );
}

export default function FaqAdminClient({ faqs: initialFaqs }: { faqs?: FaqData[] }) {
    const [isPending, startTransition] = useTransition();
    const hasInitialData = initialFaqs !== undefined;
    const [faqs, setFaqs] = useState<FaqData[]>(initialFaqs ?? []);
    const [loading, setLoading] = useState(!hasInitialData);
    const [loadError, setLoadError] = useState(false);
    // 모달 표시 여부
    const [showForm, setShowForm] = useState(false);
    // 수정 중인 FAQ의 ID (null이면 새 FAQ 생성 모드)
    const [editId, setEditId] = useState<string | null>(null);
    // 폼 필드 상태
    const [question, setQuestion] = useState("");
    const [answer, setAnswer] = useState("");
    const [order, setOrder] = useState(0);
    const [isPublic, setIsPublic] = useState(true);

    const loadFaqs = useCallback(async () => {
        setLoading(true);
        setLoadError(false);
        try {
            const response = await fetch("/api/admin/faq", { cache: "no-store" });
            if (!response.ok) {
                throw new Error("Failed to load FAQs.");
            }
            const data = (await response.json()) as FaqPayload;
            setFaqs(data.faqs);
        } catch (error) {
            console.error("Failed to load FAQs:", error);
            setLoadError(true);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (hasInitialData) return;
        void loadFaqs();
    }, [hasInitialData, loadFaqs]);

    // 폼 초기화
    function resetForm() {
        setEditId(null);
        setQuestion("");
        setAnswer("");
        setOrder(0);
        setIsPublic(true);
        setShowForm(false);
    }

    // 수정 모드 진입 — 기존 FAQ 데이터를 폼에 채움
    function startEdit(faq: FaqData) {
        setEditId(faq.id);
        setQuestion(faq.question);
        setAnswer(faq.answer);
        setOrder(faq.order);
        setIsPublic(faq.isPublic);
        setShowForm(true);
    }

    // 저장 (생성 또는 수정)
    function handleSubmit() {
        if (!question.trim()) { alert("질문을 입력해주세요."); return; }
        if (!answer.trim()) { alert("답변을 입력해주세요."); return; }
        const payload = { question, answer, order, isPublic };
        startTransition(async () => {
            if (editId) {
                await updateFaq(editId, payload);
            } else {
                await createFaq(payload);
            }
            resetForm();
            await loadFaqs();
        });
    }

    // 삭제 확인 후 실행
    function handleDelete(id: string) {
        if (!confirm("이 FAQ를 삭제하시겠습니까?")) return;
        startTransition(async () => {
            await deleteFaq(id);
            await loadFaqs();
        });
    }

    if (loading && faqs.length === 0) {
        return <FaqLoadingFallback />;
    }

    if (loadError && faqs.length === 0) {
        return <FaqErrorState onRetry={loadFaqs} />;
    }

    return (
        <div className="space-y-6">
            {/* 페이지 헤더 */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">FAQ 관리</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">자주 묻는 질문을 관리합니다 (체험신청 페이지에 표시)</p>
                </div>
                <button onClick={() => { resetForm(); setShowForm(true); }}
                    className="flex items-center gap-2 bg-brand-orange-500 dark:bg-brand-neon-lime dark:text-brand-navy-900 text-white px-4 py-2.5 rounded-xl font-bold hover:bg-orange-600 transition">
                    <SymbolIcon name="add" size={18} /> 새 FAQ
                </button>
            </div>

            {/* 생성/수정 모달 */}
            {showForm && (
                <AdminModal onClose={resetForm} titleId="faq-form-modal-title" panelClassName="max-w-2xl">
                        <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                            <h2 id="faq-form-modal-title" className="text-lg font-bold">{editId ? "FAQ 수정" : "새 FAQ"}</h2>
                            <button onClick={resetForm} className="p-1 hover:bg-gray-100 dark:bg-gray-800 rounded-lg">
                                <SymbolIcon name="close" size={20} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            {/* 질문 입력 */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">질문</label>
                                <input value={question} onChange={e => setQuestion(e.target.value)}
                                    placeholder="자주 묻는 질문을 입력하세요"
                                    className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm" />
                            </div>
                            {/* 답변 입력 */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">답변</label>
                                <textarea value={answer} onChange={e => setAnswer(e.target.value)}
                                    rows={4} placeholder="답변을 입력하세요"
                                    className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm" />
                            </div>
                            {/* 순서와 공개여부 — 가로 배치 */}
                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">표시 순서</label>
                                    <input type="number" value={order} onChange={e => setOrder(Number(e.target.value))}
                                        className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm" />
                                    <p className="text-xs text-gray-400 mt-1">숫자가 작을수록 위에 표시됩니다</p>
                                </div>
                                <div className="flex items-center gap-2 pt-6">
                                    <input type="checkbox" id="isPublic" checked={isPublic} onChange={e => setIsPublic(e.target.checked)} className="rounded" />
                                    <label htmlFor="isPublic" className="text-sm text-gray-700 dark:text-gray-200">공개</label>
                                </div>
                            </div>
                        </div>
                        {/* 모달 하단 버튼 */}
                        <div className="p-6 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-3">
                            <button onClick={resetForm} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:bg-gray-800 rounded-xl transition">취소</button>
                            <button onClick={handleSubmit} disabled={isPending}
                                className="px-6 py-2 bg-brand-orange-500 dark:bg-brand-neon-lime dark:text-brand-navy-900 text-white font-bold rounded-xl hover:bg-orange-600 transition disabled:opacity-50">
                                {isPending ? "저장 중..." : editId ? "수정" : "등록"}
                            </button>
                        </div>
                </AdminModal>
            )}

            {/* FAQ 목록 */}
            {faqs.length === 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 transition-colors duration-300 p-12 text-center text-gray-400">
                    <SymbolIcon name="help" size={48} className="mx-auto mb-3 text-gray-300" />
                    <p className="font-medium">아직 FAQ가 없습니다</p>
                    <p className="text-sm mt-1">&quot;새 FAQ&quot; 버튼으로 질문을 추가하세요</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {faqs.map(faq => (
                        <div key={faq.id} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 transition-colors duration-300 shadow-sm p-5 hover:shadow-md transition">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                    {/* 질문 */}
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-brand-orange-500 dark:text-brand-neon-lime font-bold text-sm">Q.</span>
                                        <h3 className="font-bold text-gray-900 dark:text-white">{faq.question}</h3>
                                    </div>
                                    {/* 답변 미리보기 */}
                                    <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mb-2 pl-6">{faq.answer}</p>
                                    {/* 메타 정보 */}
                                    <div className="flex items-center gap-2 flex-wrap pl-6">
                                        <span className="text-xs text-gray-400">순서: {faq.order}</span>
                                        <span className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 ${
                                            faq.isPublic ? "bg-green-50 text-green-600" : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
                                        }`}>
                                            <SymbolIcon name={faq.isPublic ? "visibility" : "visibility_off"} size={10} />
                                            {faq.isPublic ? "공개" : "비공개"}
                                        </span>
                                        <span className="text-xs text-gray-400">
                                            {new Date(faq.createdAt).toLocaleDateString("ko-KR")}
                                        </span>
                                    </div>
                                </div>
                                {/* 수정/삭제 버튼 */}
                                <div className="flex gap-1 flex-shrink-0">
                                    <button onClick={() => startEdit(faq)}
                                        className="p-2 text-gray-400 hover:text-brand-orange-500 dark:text-brand-neon-lime hover:bg-orange-50 rounded-lg transition">
                                        <SymbolIcon name="edit" size={16} />
                                    </button>
                                    <button onClick={() => handleDelete(faq.id)}
                                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition">
                                        <SymbolIcon name="delete" size={16} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
