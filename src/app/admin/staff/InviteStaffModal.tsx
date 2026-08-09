"use client";

import { useState, useTransition, type FormEvent } from "react";
import { inviteStaff } from "@/app/actions/admin";
import AdminModal from "@/components/admin/AdminModal";

function formatPhone(raw: string): string {
    const digits = raw.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

type InvitationResult = {
    inviteUrl: string;
    smsSent: boolean;
    smsError?: string;
};

function absoluteInviteUrl(inviteUrl: string): string {
    if (typeof window === "undefined") return inviteUrl;
    return new URL(inviteUrl, window.location.origin).toString();
}

export default function InviteStaffModal({
    onClose,
    onSuccess,
    onError,
}: {
    onClose: () => void;
    onSuccess: () => void;
    onError: (message: string) => void;
}) {
    const [form, setForm] = useState<{ name: string; phone: string; role: "INSTRUCTOR" | "DRIVER" }>({
        name: "",
        phone: "",
        role: "INSTRUCTOR",
    });
    const [result, setResult] = useState<InvitationResult | null>(null);
    const [copyMessage, setCopyMessage] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();
    const phoneComplete = form.phone.replace(/-/g, "").length >= 10;

    function handleSubmit(event: FormEvent) {
        event.preventDefault();
        if (!form.name.trim() || !phoneComplete) return;

        startTransition(async () => {
            try {
                const invitation = await inviteStaff({
                    name: form.name.trim(),
                    phone: form.phone.trim(),
                    role: form.role,
                });
                setResult(invitation);
                onSuccess();
            } catch (error) {
                onError(error instanceof Error ? error.message : "스태프 초대를 만들지 못했습니다.");
            }
        });
    }

    async function copyInviteUrl() {
        if (!result) return;
        try {
            await navigator.clipboard.writeText(absoluteInviteUrl(result.inviteUrl));
            setCopyMessage("개인 가입 링크를 복사했습니다.");
        } catch {
            window.prompt("아래 개인 가입 링크를 길게 눌러 복사해 주세요.", absoluteInviteUrl(result.inviteUrl));
            setCopyMessage("복사창에 개인 가입 링크를 표시했습니다.");
        }
    }

    async function shareInviteUrl() {
        if (!result || !navigator.share) return;
        try {
            await navigator.share({
                title: "STIZ 스태프 가입 초대",
                text: `${form.name.trim()}님, 아래 링크에서 가입을 완료해 주세요.`,
                url: absoluteInviteUrl(result.inviteUrl),
            });
        } catch (error) {
            if (error instanceof DOMException && error.name === "AbortError") return;
            setCopyMessage("공유하지 못했습니다. 링크 복사를 이용해 주세요.");
        }
    }

    return (
        <AdminModal onClose={onClose} titleId="invite-staff-modal-title" panelClassName="max-w-md" closeOnBackdrop={!result}>
                <div className="flex items-center justify-between border-b border-[var(--doc-rule)] px-6 py-4">
                    <h2 id="invite-staff-modal-title" className="flex items-center gap-2 text-lg font-bold text-[var(--doc-ink)]">
                        <span className="material-symbols-outlined text-[20px]">person_add</span>
                        새 스태프 초대·가입
                    </h2>
                    <button type="button" onClick={onClose} className="rounded-[3px] p-1 text-[var(--doc-ink-3)] hover:bg-[var(--doc-grid-head)] hover:text-[var(--doc-ink-2)]" aria-label="닫기">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                {result ? (
                    <div className="space-y-4 p-6">
                        <div className={`rounded-[3px] border p-4 ${result.smsSent ? "border-[var(--doc-accent)] bg-[var(--doc-accent-soft)] text-[var(--doc-accent)]" : "border-[var(--doc-warn)] bg-[var(--doc-grid-head)] text-[var(--doc-warn)]"}`}>
                            <p className="font-bold">초대 링크가 만들어졌습니다.</p>
                            <p className="mt-1 text-sm">
                                {result.smsSent
                                    ? "가입 안내 문자를 발송했습니다. 아래 링크를 카카오톡으로도 전달할 수 있습니다."
                                    : "문자는 발송되지 않았습니다. 초대는 정상적으로 만들어졌으니 아래 링크를 복사해 전달해 주세요."}
                            </p>
                            {!result.smsSent && result.smsError && <p className="mt-2 text-xs opacity-80">발송 사유: {result.smsError}</p>}
                        </div>

                        <div>
                            <label className="mb-1 block text-sm font-medium text-[var(--doc-ink-2)]">{form.name.trim()}님 개인 가입 링크</label>
                            <div className="break-all rounded-[3px] border border-[var(--doc-rule)] bg-[var(--doc-grid-head)] p-3 text-sm text-[var(--doc-ink-2)]">
                                {absoluteInviteUrl(result.inviteUrl)}
                            </div>
                            <p className="mt-2 text-xs text-[var(--doc-ink-2)]">이 링크는 해당 선생님만 사용해야 하며 7일 동안 유효합니다.</p>
                        </div>

                        {copyMessage && <p role="status" aria-live="polite" className="text-sm font-medium text-[var(--doc-ink-2)]">{copyMessage}</p>}

                        <div className="flex flex-wrap justify-end gap-2">
                            <button type="button" onClick={() => void copyInviteUrl()} className="flex items-center gap-1 rounded-[3px] border border-brand-navy-200 px-4 py-2.5 text-sm font-bold text-[var(--doc-ink)]">
                                <span className="material-symbols-outlined text-[18px]">content_copy</span>
                                가입 링크 복사
                            </button>
                            {typeof navigator !== "undefined" && "share" in navigator && (
                                <button type="button" onClick={() => void shareInviteUrl()} className="flex items-center gap-1 rounded-[3px] bg-[var(--doc-ink)] px-4 py-2.5 text-sm font-bold text-white">
                                    <span className="material-symbols-outlined text-[18px]">share</span>
                                    공유하기
                                </button>
                            )}
                            <button type="button" onClick={onClose} className="rounded-[3px] bg-[var(--doc-grid-head)] px-4 py-2.5 text-sm font-medium text-[var(--doc-ink-2)]">완료</button>
                        </div>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4 p-6">
                        <div className="rounded-[3px] border border-[var(--doc-rule)] bg-[var(--doc-grid-head)] px-4 py-3 text-xs text-[var(--doc-ink-2)]">
                            선생님 또는 기사 전용 개인 가입 링크를 만들고 입력한 전화번호로 안내 문자를 보냅니다.
                        </div>
                        <div>
                            <label className="mb-1 block text-sm font-medium text-[var(--doc-ink-2)]">이름 *</label>
                            <input data-admin-modal-initial-focus type="text" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required placeholder="홍길동" className="w-full rounded-[3px] border border-[var(--doc-rule)] px-4 py-2.5 text-sm focus:border-brand-navy-500 focus: focus:ring-brand-navy-500" />
                        </div>
                        <div>
                            <label className="mb-1 block text-sm font-medium text-[var(--doc-ink-2)]">전화번호 *</label>
                            <input type="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: formatPhone(event.target.value) })} required inputMode="numeric" autoComplete="tel" pattern="010-[0-9]{4}-[0-9]{4}" title="010-0000-0000 형식으로 입력해 주세요." placeholder="010-1234-5678" className="w-full rounded-[3px] border border-[var(--doc-rule)] px-4 py-2.5 text-sm focus:border-brand-navy-500 focus: focus:ring-brand-navy-500" />
                            {/* 안내문구 제거: placeholder + input title 속성과 삼중 중복 */}
                        </div>
                        <div>
                            <label className="mb-1 block text-sm font-medium text-[var(--doc-ink-2)]">초대 역할 *</label>
                            <select
                                value={form.role}
                                onChange={(event) => setForm({ ...form, role: event.target.value as "INSTRUCTOR" | "DRIVER" })}
                                className="w-full rounded-[3px] border border-[var(--doc-rule)] px-4 py-2.5 text-sm font-bold focus:border-brand-navy-500 focus: focus:ring-brand-navy-500"
                            >
                                <option value="INSTRUCTOR">코치/강사</option>
                                <option value="DRIVER">셔틀 기사</option>
                            </select>
                            <p className="mt-1 text-xs text-[var(--doc-ink-2)]">
                                선생님은 수업 앱으로, 기사는 셔틀 운행 화면으로 이동합니다.
                            </p>
                        </div>
                        <div className="flex justify-end gap-3 pt-2">
                            <button type="button" onClick={onClose} className="rounded-[3px] bg-[var(--doc-grid-head)] px-4 py-2.5 text-sm font-medium text-[var(--doc-ink-2)]">취소</button>
                            <button type="submit" disabled={isPending || !form.name.trim() || !phoneComplete} className="rounded-[3px] bg-[var(--doc-ink)] px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50">
                                {isPending ? "가입 링크 만드는 중…" : "개인 가입 링크 만들기"}
                            </button>
                        </div>
                    </form>
                )}
        </AdminModal>
    );
}
