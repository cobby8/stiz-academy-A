"use client";

import { useState, useTransition, type FormEvent } from "react";
import { inviteStaff } from "@/app/actions/admin";

function formatPhone(raw: string): string {
    const digits = raw.replace(/\D/g, "");
    const trimmed = digits.slice(0, 11);
    if (trimmed.length <= 3) return trimmed;
    if (trimmed.length <= 7) return `${trimmed.slice(0, 3)}-${trimmed.slice(3)}`;
    return `${trimmed.slice(0, 3)}-${trimmed.slice(3, 7)}-${trimmed.slice(7)}`;
}

export default function InviteStaffModal({
    onClose,
    onSuccess,
    onError,
}: {
    onClose: () => void;
    onSuccess: () => void;
    onError: (msg: string) => void;
}) {
    const [form, setForm] = useState({
        name: "",
        phone: "",
        role: "INSTRUCTOR" as "ADMIN" | "VICE_ADMIN" | "INSTRUCTOR",
    });
    const [isPending, startTransition] = useTransition();

    function handlePhoneChange(raw: string) {
        setForm({ ...form, phone: formatPhone(raw) });
    }

    function handleSubmit(e: FormEvent) {
        e.preventDefault();
        if (!form.name || !form.phone) return;

        startTransition(async () => {
            try {
                await inviteStaff({
                    name: form.name.trim(),
                    phone: form.phone.trim(),
                    role: form.role,
                });
                onSuccess();
            } catch (error) {
                onError(error instanceof Error ? error.message : "초대 발송 실패");
            }
        });
    }

    const phoneComplete = form.phone.replace(/-/g, "").length >= 10;

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <span className="material-symbols-outlined text-[20px]">send</span>
                        스태프 초대
                    </h2>
                    <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:bg-gray-800">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="px-4 py-3 bg-blue-50 rounded-lg text-xs text-blue-700 border border-blue-100">
                        입력한 전화번호로 초대 링크가 SMS 발송됩니다.
                        초대받은 분이 링크를 통해 직접 가입합니다. (7일간 유효)
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">이름 *</label>
                        <input
                            type="text"
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            required
                            placeholder="홍길동"
                            className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 dark:text-white dark:bg-gray-800 rounded-lg text-sm focus:ring-2 focus:ring-brand-navy-500 focus:border-brand-navy-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">전화번호 *</label>
                        <input
                            type="tel"
                            value={form.phone}
                            onChange={(e) => handlePhoneChange(e.target.value)}
                            placeholder="숫자만 입력 (자동 변환: 010-1234-5678)"
                            required
                            className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 dark:text-white dark:bg-gray-800 rounded-lg text-sm focus:ring-2 focus:ring-brand-navy-500 focus:border-brand-navy-500"
                        />
                        <p className="text-xs text-gray-400 mt-1">숫자만 입력하면 자동으로 000-0000-0000 형식으로 변환됩니다</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">부여할 역할 *</label>
                        <select
                            value={form.role}
                            onChange={(e) => setForm({ ...form, role: e.target.value as "ADMIN" | "VICE_ADMIN" | "INSTRUCTOR" })}
                            className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 dark:text-white dark:bg-gray-800 rounded-lg text-sm focus:ring-2 focus:ring-brand-navy-500 focus:border-brand-navy-500"
                        >
                            <option value="INSTRUCTOR">코치/강사</option>
                            <option value="VICE_ADMIN">부원장</option>
                            <option value="ADMIN">원장</option>
                        </select>
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 transition-colors"
                        >
                            취소
                        </button>
                        <button
                            type="submit"
                            disabled={isPending || !form.name || !phoneComplete}
                            className="px-4 py-2.5 text-sm font-medium text-white bg-brand-navy-900 rounded-lg hover:bg-brand-navy-800 transition-colors disabled:opacity-50"
                        >
                            {isPending ? "발송 중..." : "초대 링크 발송"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
