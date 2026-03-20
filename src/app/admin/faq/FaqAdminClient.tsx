"use client";

import { useState, useTransition } from "react";
import { createFaq, updateFaq, deleteFaq } from "@/app/actions/admin";
import { Plus, Trash2, Edit2, X, HelpCircle, Eye, EyeOff } from "lucide-react";

// FAQ 데이터 타입
type FaqData = {
    id: string;
    question: string;
    answer: string;
    order: number;
    isPublic: boolean;
    createdAt: Date | string;
};

export default function FaqAdminClient({ faqs }: { faqs: FaqData[] }) {
    const [isPending, startTransition] = useTransition();
    // 모달 표시 여부
    const [showForm, setShowForm] = useState(false);
    // 수정 중인 FAQ의 ID (null이면 새 FAQ 생성 모드)
    const [editId, setEditId] = useState<string | null>(null);
    // 폼 필드 상태
    const [question, setQuestion] = useState("");
    const [answer, setAnswer] = useState("");
    const [order, setOrder] = useState(0);
    const [isPublic, setIsPublic] = useState(true);

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
        });
    }

    // 삭제 확인 후 실행
    function handleDelete(id: string) {
        if (!confirm("이 FAQ를 삭제하시겠습니까?")) return;
        startTransition(async () => { await deleteFaq(id); });
    }

    return (
        <div className="space-y-6">
            {/* 페이지 헤더 */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">FAQ 관리</h1>
                    <p className="text-sm text-gray-500 mt-1">자주 묻는 질문을 관리합니다 (체험신청 페이지에 표시)</p>
                </div>
                <button onClick={() => { resetForm(); setShowForm(true); }}
                    className="flex items-center gap-2 bg-brand-orange-500 text-white px-4 py-2.5 rounded-xl font-bold hover:bg-orange-600 transition">
                    <Plus size={18} /> 새 FAQ
                </button>
            </div>

            {/* 생성/수정 모달 */}
            {showForm && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={resetForm}>
                    <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                            <h2 className="text-lg font-bold">{editId ? "FAQ 수정" : "새 FAQ"}</h2>
                            <button onClick={resetForm} className="p-1 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            {/* 질문 입력 */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">질문</label>
                                <input value={question} onChange={e => setQuestion(e.target.value)}
                                    placeholder="자주 묻는 질문을 입력하세요"
                                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm" />
                            </div>
                            {/* 답변 입력 */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">답변</label>
                                <textarea value={answer} onChange={e => setAnswer(e.target.value)}
                                    rows={4} placeholder="답변을 입력하세요"
                                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm" />
                            </div>
                            {/* 순서와 공개여부 — 가로 배치 */}
                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">표시 순서</label>
                                    <input type="number" value={order} onChange={e => setOrder(Number(e.target.value))}
                                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm" />
                                    <p className="text-xs text-gray-400 mt-1">숫자가 작을수록 위에 표시됩니다</p>
                                </div>
                                <div className="flex items-center gap-2 pt-6">
                                    <input type="checkbox" id="isPublic" checked={isPublic} onChange={e => setIsPublic(e.target.checked)} className="rounded" />
                                    <label htmlFor="isPublic" className="text-sm text-gray-700">공개</label>
                                </div>
                            </div>
                        </div>
                        {/* 모달 하단 버튼 */}
                        <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
                            <button onClick={resetForm} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl transition">취소</button>
                            <button onClick={handleSubmit} disabled={isPending}
                                className="px-6 py-2 bg-brand-orange-500 text-white font-bold rounded-xl hover:bg-orange-600 transition disabled:opacity-50">
                                {isPending ? "저장 중..." : editId ? "수정" : "등록"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* FAQ 목록 */}
            {faqs.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-gray-400">
                    <HelpCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p className="font-medium">아직 FAQ가 없습니다</p>
                    <p className="text-sm mt-1">&quot;새 FAQ&quot; 버튼으로 질문을 추가하세요</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {faqs.map(faq => (
                        <div key={faq.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                    {/* 질문 */}
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-brand-orange-500 font-bold text-sm">Q.</span>
                                        <h3 className="font-bold text-gray-900">{faq.question}</h3>
                                    </div>
                                    {/* 답변 미리보기 */}
                                    <p className="text-sm text-gray-500 line-clamp-2 mb-2 pl-6">{faq.answer}</p>
                                    {/* 메타 정보 */}
                                    <div className="flex items-center gap-2 flex-wrap pl-6">
                                        <span className="text-xs text-gray-400">순서: {faq.order}</span>
                                        <span className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 ${
                                            faq.isPublic ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-500"
                                        }`}>
                                            {faq.isPublic ? <><Eye size={10} /> 공개</> : <><EyeOff size={10} /> 비공개</>}
                                        </span>
                                        <span className="text-xs text-gray-400">
                                            {new Date(faq.createdAt).toLocaleDateString("ko-KR")}
                                        </span>
                                    </div>
                                </div>
                                {/* 수정/삭제 버튼 */}
                                <div className="flex gap-1 flex-shrink-0">
                                    <button onClick={() => startEdit(faq)}
                                        className="p-2 text-gray-400 hover:text-brand-orange-500 hover:bg-orange-50 rounded-lg transition">
                                        <Edit2 size={16} />
                                    </button>
                                    <button onClick={() => handleDelete(faq.id)}
                                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition">
                                        <Trash2 size={16} />
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
