"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createTrialLead, convertTrialToStudent, updateTrialLead } from "@/app/actions/admin";
import type { TrialLead } from "./TrialCrmClient";

interface TrialCrmModalsProps {
    addOpen: boolean;
    convertLead: TrialLead | null;
    lostLead: TrialLead | null;
    memoLead: TrialLead | null;
    onCloseAdd: () => void;
    onCloseConvert: () => void;
    onCloseLost: () => void;
    onCloseMemo: () => void;
}

export default function TrialCrmModals({
    addOpen,
    convertLead,
    lostLead,
    memoLead,
    onCloseAdd,
    onCloseConvert,
    onCloseLost,
    onCloseMemo,
}: TrialCrmModalsProps) {
    const router = useRouter();
    const [busy, setBusy] = useState(false);

    async function runAction(action: () => Promise<unknown>, onDone: () => void) {
        setBusy(true);
        try {
            await action();
            onDone();
            router.refresh();
        } catch (error) {
            alert((error as Error).message);
        } finally {
            setBusy(false);
        }
    }

    return (
        <>
            {addOpen && (
                <AddLeadModal
                    onClose={onCloseAdd}
                    onSubmit={(data) => runAction(() => createTrialLead(data), onCloseAdd)}
                    busy={busy}
                />
            )}

            {convertLead && (
                <ConvertModal
                    lead={convertLead}
                    onClose={onCloseConvert}
                    onSubmit={(studentData) =>
                        runAction(() => convertTrialToStudent(convertLead.id, studentData), onCloseConvert)
                    }
                    busy={busy}
                />
            )}

            {lostLead && (
                <LostModal
                    lead={lostLead}
                    onClose={onCloseLost}
                    onSubmit={(reason) =>
                        runAction(
                            () =>
                                updateTrialLead(lostLead.id, {
                                    status: "LOST",
                                    lostReason: reason,
                                }),
                            onCloseLost
                        )
                    }
                    busy={busy}
                />
            )}

            {memoLead && (
                <MemoModal
                    lead={memoLead}
                    onClose={onCloseMemo}
                    onSubmit={(memo) => runAction(() => updateTrialLead(memoLead.id, { memo }), onCloseMemo)}
                    busy={busy}
                />
            )}
        </>
    );
}

function AddLeadModal({
    onClose,
    onSubmit,
    busy,
}: {
    onClose: () => void;
    onSubmit: (data: { childName: string; childAge?: string; parentName: string; parentPhone: string; source?: string; memo?: string }) => void;
    busy: boolean;
}) {
    const [form, setForm] = useState({
        childName: "",
        childAge: "",
        parentName: "",
        parentPhone: "",
        source: "WEBSITE",
        memo: "",
    });

    function handleSubmit(e: FormEvent) {
        e.preventDefault();
        if (!form.childName.trim() || !form.parentName.trim() || !form.parentPhone.trim()) {
            alert("아이 이름, 학부모 이름, 연락처는 필수입니다.");
            return;
        }
        onSubmit({
            childName: form.childName,
            childAge: form.childAge || undefined,
            parentName: form.parentName,
            parentPhone: form.parentPhone,
            source: form.source,
            memo: form.memo || undefined,
        });
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md mx-4 p-6" onClick={(e) => e.stopPropagation()}>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                    <span className="material-symbols-outlined text-brand-orange-500 dark:text-brand-neon-lime">person_add</span>
                    체험 신청 등록
                </h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">아이 이름 *</label>
                        <input
                            type="text"
                            value={form.childName}
                            onChange={(e) => setForm({ ...form, childName: e.target.value })}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange-500 dark:focus:ring-brand-neon-lime"
                            placeholder="홍길동"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">나이/학년</label>
                        <input
                            type="text"
                            value={form.childAge}
                            onChange={(e) => setForm({ ...form, childAge: e.target.value })}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange-500 dark:focus:ring-brand-neon-lime"
                            placeholder="초등 3학년"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">학부모 이름 *</label>
                        <input
                            type="text"
                            value={form.parentName}
                            onChange={(e) => setForm({ ...form, parentName: e.target.value })}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange-500 dark:focus:ring-brand-neon-lime"
                            placeholder="홍부모"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">연락처 *</label>
                        <input
                            type="tel"
                            value={form.parentPhone}
                            onChange={(e) => {
                                const nums = e.target.value.replace(/\D/g, "").slice(0, 11);
                                let formatted = nums;
                                if (nums.length > 7) formatted = `${nums.slice(0, 3)}-${nums.slice(3, 7)}-${nums.slice(7)}`;
                                else if (nums.length > 3) formatted = `${nums.slice(0, 3)}-${nums.slice(3)}`;
                                setForm({ ...form, parentPhone: formatted });
                            }}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange-500 dark:focus:ring-brand-neon-lime"
                            placeholder="숫자만 입력 (자동 변환: 010-1234-5678)"
                        />
                        <p className="text-xs text-gray-400 mt-1">숫자만 입력하면 자동으로 000-0000-0000 형식으로 변환됩니다</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">유입 경로</label>
                        <select
                            value={form.source}
                            onChange={(e) => setForm({ ...form, source: e.target.value })}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange-500 dark:focus:ring-brand-neon-lime"
                        >
                            <option value="WEBSITE">홈페이지</option>
                            <option value="NAVER">네이버</option>
                            <option value="REFERRAL">지인소개</option>
                            <option value="OTHER">기타</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">메모</label>
                        <textarea
                            value={form.memo}
                            onChange={(e) => setForm({ ...form, memo: e.target.value })}
                            rows={3}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange-500 dark:focus:ring-brand-neon-lime resize-none"
                            placeholder="추가 메모 사항"
                        />
                    </div>
                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:bg-gray-900 transition-colors text-sm font-medium"
                        >
                            취소
                        </button>
                        <button
                            type="submit"
                            disabled={busy}
                            className="flex-1 px-4 py-2.5 bg-brand-orange-500 dark:bg-brand-neon-lime dark:text-brand-navy-900 text-white rounded-lg hover:bg-brand-orange-600 dark:hover:bg-lime-400 transition-colors text-sm font-medium disabled:opacity-50"
                        >
                            {busy ? "등록 중..." : "등록"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function ConvertModal({
    lead,
    onClose,
    onSubmit,
    busy,
}: {
    lead: TrialLead;
    onClose: () => void;
    onSubmit: (data: {
        name: string;
        birthDate: string;
        gender?: string | null;
        parentName: string;
        parentPhone?: string | null;
        parentEmail?: string | null;
        memo?: string | null;
    }) => void;
    busy: boolean;
}) {
    const [form, setForm] = useState({
        name: lead.childName,
        birthDate: "2015-01-01",
        gender: "",
        parentName: lead.parentName,
        parentPhone: lead.parentPhone,
        parentEmail: "",
        memo: lead.memo || "",
    });

    function handleSubmit(e: FormEvent) {
        e.preventDefault();
        if (!form.name.trim() || !form.birthDate || !form.parentName.trim()) {
            alert("아이 이름, 생년월일, 학부모 이름은 필수입니다.");
            return;
        }
        onSubmit({
            name: form.name,
            birthDate: form.birthDate,
            gender: form.gender || null,
            parentName: form.parentName,
            parentPhone: form.parentPhone || null,
            parentEmail: form.parentEmail || null,
            memo: form.memo || null,
        });
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md mx-4 p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                    <span className="material-symbols-outlined text-emerald-500">how_to_reg</span>
                    정규 등록 전환
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    체험 학생 &quot;{lead.childName}&quot;을 정규 원생으로 등록합니다.
                </p>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">아이 이름 *</label>
                        <input
                            type="text"
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange-500 dark:focus:ring-brand-neon-lime"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">생년월일 *</label>
                        <input
                            type="date"
                            min="1950-01-01"
                            max="2025-12-31"
                            value={form.birthDate}
                            onChange={(e) => setForm({ ...form, birthDate: e.target.value })}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange-500 dark:focus:ring-brand-neon-lime"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">성별</label>
                        <select
                            value={form.gender}
                            onChange={(e) => setForm({ ...form, gender: e.target.value })}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange-500 dark:focus:ring-brand-neon-lime"
                        >
                            <option value="">선택 안함</option>
                            <option value="남">남</option>
                            <option value="여">여</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">학부모 이름 *</label>
                        <input
                            type="text"
                            value={form.parentName}
                            onChange={(e) => setForm({ ...form, parentName: e.target.value })}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange-500 dark:focus:ring-brand-neon-lime"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">학부모 연락처</label>
                        <input
                            type="tel"
                            value={form.parentPhone}
                            onChange={(e) => {
                                const nums = e.target.value.replace(/\D/g, "").slice(0, 11);
                                let formatted = nums;
                                if (nums.length > 7) formatted = `${nums.slice(0, 3)}-${nums.slice(3, 7)}-${nums.slice(7)}`;
                                else if (nums.length > 3) formatted = `${nums.slice(0, 3)}-${nums.slice(3)}`;
                                setForm({ ...form, parentPhone: formatted });
                            }}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange-500 dark:focus:ring-brand-neon-lime"
                            placeholder="숫자만 입력 (자동 변환: 010-1234-5678)"
                        />
                        <p className="text-xs text-gray-400 mt-1">숫자만 입력하면 자동으로 000-0000-0000 형식으로 변환됩니다</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">학부모 이메일</label>
                        <input
                            type="email"
                            value={form.parentEmail}
                            onChange={(e) => setForm({ ...form, parentEmail: e.target.value })}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange-500 dark:focus:ring-brand-neon-lime"
                            placeholder="로그인에 사용됩니다 (선택)"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">메모</label>
                        <textarea
                            value={form.memo}
                            onChange={(e) => setForm({ ...form, memo: e.target.value })}
                            rows={2}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange-500 dark:focus:ring-brand-neon-lime resize-none"
                        />
                    </div>
                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:bg-gray-900 transition-colors text-sm font-medium"
                        >
                            취소
                        </button>
                        <button
                            type="submit"
                            disabled={busy}
                            className="flex-1 px-4 py-2.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors text-sm font-medium disabled:opacity-50"
                        >
                            {busy ? "등록 중..." : "정규 등록"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function LostModal({
    lead,
    onClose,
    onSubmit,
    busy,
}: {
    lead: TrialLead;
    onClose: () => void;
    onSubmit: (reason: string) => void;
    busy: boolean;
}) {
    const [reason, setReason] = useState("");

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md mx-4 p-6" onClick={(e) => e.stopPropagation()}>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                    <span className="material-symbols-outlined text-red-500">person_off</span>
                    이탈 처리
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    &quot;{lead.childName}&quot; 체험 건을 이탈로 처리합니다.
                </p>
                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">이탈 사유</label>
                    <textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        rows={3}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange-500 dark:focus:ring-brand-neon-lime resize-none"
                        placeholder="사유를 입력하세요 (선택)"
                    />
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:bg-gray-900 transition-colors text-sm font-medium"
                    >
                        취소
                    </button>
                    <button
                        onClick={() => onSubmit(reason)}
                        disabled={busy}
                        className="flex-1 px-4 py-2.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm font-medium disabled:opacity-50"
                    >
                        {busy ? "처리 중..." : "이탈 처리"}
                    </button>
                </div>
            </div>
        </div>
    );
}

function MemoModal({
    lead,
    onClose,
    onSubmit,
    busy,
}: {
    lead: TrialLead;
    onClose: () => void;
    onSubmit: (memo: string) => void;
    busy: boolean;
}) {
    const [memo, setMemo] = useState(lead.memo || "");

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md mx-4 p-6" onClick={(e) => e.stopPropagation()}>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                    <span className="material-symbols-outlined text-brand-orange-500 dark:text-brand-neon-lime">edit_note</span>
                    메모 편집
                </h2>
                <div className="mb-4">
                    <textarea
                        value={memo}
                        onChange={(e) => setMemo(e.target.value)}
                        rows={4}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange-500 dark:focus:ring-brand-neon-lime resize-none"
                        placeholder="메모를 입력하세요"
                        autoFocus
                    />
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:bg-gray-900 transition-colors text-sm font-medium"
                    >
                        취소
                    </button>
                    <button
                        onClick={() => onSubmit(memo)}
                        disabled={busy}
                        className="flex-1 px-4 py-2.5 bg-brand-orange-500 dark:bg-brand-neon-lime dark:text-brand-navy-900 text-white rounded-lg hover:bg-brand-orange-600 dark:hover:bg-lime-400 transition-colors text-sm font-medium disabled:opacity-50"
                    >
                        {busy ? "저장 중..." : "저장"}
                    </button>
                </div>
            </div>
        </div>
    );
}
