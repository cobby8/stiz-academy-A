"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { createTrialLead, convertTrialToStudent, updateTrialLead } from "@/app/actions/admin";
import AdminModal from "@/components/admin/AdminModal";
import type { TrialLead } from "./TrialCrmClient";

interface TrialCrmModalsProps {
    addOpen: boolean;
    editLead: TrialLead | null;
    scheduleLead: TrialLead | null;
    cancelLead: TrialLead | null;
    convertLead: TrialLead | null;
    lostLead: TrialLead | null;
    memoLead: TrialLead | null;
    onCloseAdd: () => void;
    onCloseEdit: () => void;
    onCloseSchedule: () => void;
    onCloseCancel: () => void;
    onCloseConvert: () => void;
    onCloseLost: () => void;
    onCloseMemo: () => void;
    onSaved: () => Promise<void> | void;
    onFeedback: (type: "success" | "error", message: string) => void;
}

export default function TrialCrmModals({
    addOpen,
    editLead,
    scheduleLead,
    cancelLead,
    convertLead,
    lostLead,
    memoLead,
    onCloseAdd,
    onCloseEdit,
    onCloseSchedule,
    onCloseCancel,
    onCloseConvert,
    onCloseLost,
    onCloseMemo,
    onSaved,
    onFeedback,
}: TrialCrmModalsProps) {
    const [busy, setBusy] = useState(false);

    async function runAction(action: () => Promise<unknown>, onDone: () => void, successMessage: string) {
        setBusy(true);
        try {
            await action();
            onDone();
            await onSaved();
            onFeedback("success", successMessage);
        } catch {
            onFeedback("error", "처리 중 문제가 생겼습니다. 잠시 후 다시 시도해주세요.");
        } finally {
            setBusy(false);
        }
    }

    return (
        <>
            {addOpen && (
                <AddLeadModal
                    onClose={onCloseAdd}
                    onSubmit={(data) => runAction(() => createTrialLead(data), onCloseAdd, "체험 신청을 등록했습니다.")}
                    busy={busy}
                />
            )}

            {editLead && (
                <TrialEditModal
                    lead={editLead}
                    onClose={onCloseEdit}
                    onSubmit={(data) =>
                        runAction(
                            () => updateTrialLead(editLead.id, data, {
                                action: "UPDATED",
                                note: "체험 신청 내용을 수정했습니다.",
                            }),
                            onCloseEdit,
                            "체험 신청 내용을 수정했습니다.",
                        )
                    }
                    busy={busy}
                />
            )}

            {scheduleLead && (
                <TrialScheduleModal
                    lead={scheduleLead}
                    onClose={onCloseSchedule}
                    onSubmit={(data) =>
                        runAction(
                            () => updateTrialLead(scheduleLead.id, data, {
                                action: "SCHEDULED",
                                note: "체험 일정을 저장했습니다.",
                            }),
                            onCloseSchedule,
                            "체험 일정을 저장했습니다.",
                        )
                    }
                    busy={busy}
                />
            )}

            {cancelLead && (
                <TrialCancelModal
                    lead={cancelLead}
                    onClose={onCloseCancel}
                    onSubmit={(reason) =>
                        runAction(
                            () =>
                                updateTrialLead(cancelLead.id, {
                                    status: "CANCELLED",
                                    lostReason: reason,
                                }, {
                                    action: "CANCELLED",
                                    note: `취소: ${reason}`,
                                }),
                            onCloseCancel,
                            "체험 신청을 취소 처리했습니다.",
                        )
                    }
                    busy={busy}
                />
            )}

            {convertLead && (
                <ConvertModal
                    lead={convertLead}
                    onClose={onCloseConvert}
                    onSubmit={(studentData) =>
                        runAction(() => convertTrialToStudent(convertLead.id, studentData), onCloseConvert, "정규 원생으로 등록했습니다.")
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
                            onCloseLost,
                            "이탈 처리했습니다."
                        )
                    }
                    busy={busy}
                />
            )}

            {memoLead && (
                <MemoModal
                    lead={memoLead}
                    onClose={onCloseMemo}
                    onSubmit={(memo) => runAction(() => updateTrialLead(memoLead.id, { memo }), onCloseMemo, "메모를 저장했습니다.")}
                    busy={busy}
                />
            )}
        </>
    );
}

function formatPhoneInput(value: string) {
    const nums = value.replace(/\D/g, "").slice(0, 11);
    if (nums.length > 7) return `${nums.slice(0, 3)}-${nums.slice(3, 7)}-${nums.slice(7)}`;
    if (nums.length > 3) return `${nums.slice(0, 3)}-${nums.slice(3)}`;
    return nums;
}

function dateInputValue(dateStr: string | null) {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return "";
    return date.toISOString().slice(0, 10);
}

function datetimeLocalValue(dateStr: string | null) {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return "";
    const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return offsetDate.toISOString().slice(0, 16);
}

const MODAL_INPUT_CLASS = "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-orange-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:focus:ring-brand-neon-lime";

function FormField({ label, children }: { label: string; children: ReactNode }) {
    return (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
            <span className="mb-1 block">{label}</span>
            {children}
        </label>
    );
}

function ModalActions({
    onClose,
    busy,
    submitLabel,
    busyLabel,
    accent,
    muted,
}: {
    onClose: () => void;
    busy: boolean;
    submitLabel: string;
    busyLabel: string;
    accent?: "sky";
    muted?: boolean;
}) {
    const submitClass = muted
        ? "bg-gray-700 text-white hover:bg-gray-800 dark:bg-gray-200 dark:text-gray-900 dark:hover:bg-white"
        : accent === "sky"
            ? "bg-sky-500 text-white hover:bg-sky-600"
            : "bg-brand-orange-500 text-white hover:bg-brand-orange-600 dark:bg-brand-neon-lime dark:text-brand-navy-900 dark:hover:bg-lime-400";

    return (
        <div className="flex gap-3 pt-2">
            <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
            >
                닫기
            </button>
            <button
                type="submit"
                disabled={busy}
                className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-bold transition disabled:opacity-50 ${submitClass}`}
            >
                {busy ? busyLabel : submitLabel}
            </button>
        </div>
    );
}

function TrialEditModal({
    lead,
    onClose,
    onSubmit,
    busy,
}: {
    lead: TrialLead;
    onClose: () => void;
    onSubmit: (data: Record<string, unknown>) => void;
    busy: boolean;
}) {
    const [form, setForm] = useState({
        childName: lead.childName ?? "",
        childAge: lead.childAge ?? "",
        childGrade: lead.childGrade ?? "",
        childSchool: lead.childSchool ?? "",
        childGender: lead.childGender ?? "",
        parentName: lead.parentName ?? "",
        parentPhone: lead.parentPhone ?? "",
        source: lead.source ?? "WEBSITE",
        basketballExp: lead.basketballExp ?? "",
        trialDate: dateInputValue(lead.trialDate),
        preferredDay: lead.preferredDay ?? "",
        preferredPeriod: lead.preferredPeriod ?? "",
        trialFeeConfirmed: Boolean(lead.trialFeeConfirmed),
        hopeNote: lead.hopeNote ?? "",
        memo: lead.memo ?? "",
    });
    const [formError, setFormError] = useState("");

    function handleSubmit(event: FormEvent) {
        event.preventDefault();
        if (!form.childName.trim() || !form.parentName.trim() || !form.parentPhone.trim()) {
            setFormError("아이 이름, 보호자 이름, 연락처를 입력해주세요.");
            return;
        }
        setFormError("");
        onSubmit({
            childName: form.childName.trim(),
            childAge: form.childAge.trim() || null,
            childGrade: form.childGrade.trim() || null,
            childSchool: form.childSchool.trim() || null,
            childGender: form.childGender || null,
            parentName: form.parentName.trim(),
            parentPhone: form.parentPhone.trim(),
            source: form.source || "WEBSITE",
            basketballExp: form.basketballExp.trim() || null,
            trialDate: form.trialDate || null,
            preferredDay: form.preferredDay.trim() || null,
            preferredPeriod: form.preferredPeriod.trim() || null,
            trialFeeConfirmed: form.trialFeeConfirmed,
            hopeNote: form.hopeNote.trim() || null,
            memo: form.memo.trim() || null,
        });
    }

    return (
        <AdminModal onClose={onClose} titleId="trial-edit-title" panelClassName="max-w-2xl p-6">
                <h2 id="trial-edit-title" className="mb-1 flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-white">
                    <span className="material-symbols-outlined text-brand-orange-500 dark:text-brand-neon-lime">edit</span>
                    체험 신청 수정
                </h2>
                <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">상담 중 확인한 신청 내용을 바로 정리합니다.</p>
                <form onSubmit={handleSubmit} className="space-y-4">
                    {formError && (
                        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-200">
                            {formError}
                        </p>
                    )}
                    <div className="grid gap-3 sm:grid-cols-2">
                        <FormField label="아이 이름 *">
                            <input value={form.childName} onChange={(e) => setForm({ ...form, childName: e.target.value })} className={MODAL_INPUT_CLASS} />
                        </FormField>
                        <FormField label="나이/학년">
                            <input value={form.childAge} onChange={(e) => setForm({ ...form, childAge: e.target.value })} className={MODAL_INPUT_CLASS} placeholder="초등 3학년" />
                        </FormField>
                        <FormField label="학년">
                            <input value={form.childGrade} onChange={(e) => setForm({ ...form, childGrade: e.target.value })} className={MODAL_INPUT_CLASS} />
                        </FormField>
                        <FormField label="학교">
                            <input value={form.childSchool} onChange={(e) => setForm({ ...form, childSchool: e.target.value })} className={MODAL_INPUT_CLASS} />
                        </FormField>
                        <FormField label="성별">
                            <select value={form.childGender} onChange={(e) => setForm({ ...form, childGender: e.target.value })} className={MODAL_INPUT_CLASS}>
                                <option value="">선택 안 함</option>
                                <option value="남">남</option>
                                <option value="여">여</option>
                            </select>
                        </FormField>
                        <FormField label="농구 경험">
                            <input value={form.basketballExp} onChange={(e) => setForm({ ...form, basketballExp: e.target.value })} className={MODAL_INPUT_CLASS} placeholder="없음 / 1년 미만" />
                        </FormField>
                        <FormField label="보호자 이름 *">
                            <input value={form.parentName} onChange={(e) => setForm({ ...form, parentName: e.target.value })} className={MODAL_INPUT_CLASS} />
                        </FormField>
                        <FormField label="보호자 연락처 *">
                            <input type="tel" value={form.parentPhone} onChange={(e) => setForm({ ...form, parentPhone: formatPhoneInput(e.target.value) })} className={MODAL_INPUT_CLASS} />
                        </FormField>
                        <FormField label="유입 경로">
                            <select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} className={MODAL_INPUT_CLASS}>
                                <option value="WEBSITE">홈페이지</option>
                                <option value="NAVER">네이버</option>
                                <option value="REFERRAL">지인소개</option>
                                <option value="FLYER">전단지</option>
                                <option value="PASSBY">지나가다</option>
                                <option value="OTHER">기타</option>
                            </select>
                        </FormField>
                        <FormField label="희망 체험일">
                            <input type="date" value={form.trialDate} onChange={(e) => setForm({ ...form, trialDate: e.target.value })} className={MODAL_INPUT_CLASS} />
                        </FormField>
                        <FormField label="희망 요일">
                            <input value={form.preferredDay} onChange={(e) => setForm({ ...form, preferredDay: e.target.value })} className={MODAL_INPUT_CLASS} placeholder="월" />
                        </FormField>
                        <FormField label="희망 교시">
                            <input value={form.preferredPeriod} onChange={(e) => setForm({ ...form, preferredPeriod: e.target.value })} className={MODAL_INPUT_CLASS} placeholder="4" />
                        </FormField>
                    </div>
                    <label className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 dark:border-gray-700 dark:text-gray-200">
                        <input
                            type="checkbox"
                            checked={form.trialFeeConfirmed}
                            onChange={(e) => setForm({ ...form, trialFeeConfirmed: e.target.checked })}
                        />
                        체험비 확인
                    </label>
                    <FormField label="바라는 점">
                        <textarea value={form.hopeNote} onChange={(e) => setForm({ ...form, hopeNote: e.target.value })} rows={2} className={`${MODAL_INPUT_CLASS} resize-none`} />
                    </FormField>
                    <FormField label="관리 메모">
                        <textarea value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} rows={3} className={`${MODAL_INPUT_CLASS} resize-none`} />
                    </FormField>
                    <ModalActions onClose={onClose} busy={busy} submitLabel="수정 저장" busyLabel="저장 중..." />
                </form>
        </AdminModal>
    );
}

function TrialScheduleModal({
    lead,
    onClose,
    onSubmit,
    busy,
}: {
    lead: TrialLead;
    onClose: () => void;
    onSubmit: (data: Record<string, unknown>) => void;
    busy: boolean;
}) {
    const [scheduledDate, setScheduledDate] = useState(datetimeLocalValue(lead.scheduledDate || lead.trialDate));
    const [memo, setMemo] = useState(lead.memo ?? "");
    const [formError, setFormError] = useState("");

    function handleSubmit(event: FormEvent) {
        event.preventDefault();
        if (!scheduledDate) {
            setFormError("확정할 날짜와 시간을 입력해주세요.");
            return;
        }
        setFormError("");
        onSubmit({
            status: "SCHEDULED",
            scheduledDate: new Date(scheduledDate).toISOString(),
            memo: memo.trim() || null,
        });
    }

    return (
        <AdminModal onClose={onClose} titleId="trial-schedule-title" panelClassName="max-w-md p-6">
                <h2 id="trial-schedule-title" className="mb-1 flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-white">
                    <span className="material-symbols-outlined text-sky-500">event_available</span>
                    체험 일정 확정/변경
                </h2>
                <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
                    <span className="font-medium text-gray-900 dark:text-white">{lead.childName}</span> 체험 일정을 저장합니다.
                </p>
                <form onSubmit={handleSubmit} className="space-y-4">
                    {formError && (
                        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-200">
                            {formError}
                        </p>
                    )}
                    <FormField label="확정 날짜와 시간 *">
                        <input type="datetime-local" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} className={MODAL_INPUT_CLASS} />
                    </FormField>
                    <FormField label="관리 메모">
                        <textarea value={memo} onChange={(e) => setMemo(e.target.value)} rows={3} className={`${MODAL_INPUT_CLASS} resize-none`} />
                    </FormField>
                    <ModalActions onClose={onClose} busy={busy} submitLabel="일정 저장" busyLabel="저장 중..." accent="sky" />
                </form>
        </AdminModal>
    );
}

function TrialCancelModal({
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
    const [reason, setReason] = useState("학부모 요청");
    const options = ["학부모 요청", "일정 불일치", "연락 불가", "중복 신청", "기타"];

    return (
        <AdminModal onClose={onClose} titleId="trial-cancel-title" panelClassName="max-w-md p-6">
                <h2 id="trial-cancel-title" className="mb-1 flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-white">
                    <span className="material-symbols-outlined text-gray-500">block</span>
                    체험 신청 취소
                </h2>
                <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
                    <span className="font-medium text-gray-900 dark:text-white">{lead.childName}</span> 신청을 삭제하지 않고 취소 상태로 남깁니다.
                </p>
                <form
                    onSubmit={(event) => {
                        event.preventDefault();
                        onSubmit(reason.trim() || "관리자 취소");
                    }}
                    className="space-y-4"
                >
                    <div className="flex flex-wrap gap-2">
                        {options.map((option) => (
                            <button
                                key={option}
                                type="button"
                                onClick={() => setReason(option)}
                                className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                                    reason === option
                                        ? "border-gray-500 bg-gray-100 text-gray-900 dark:border-gray-500 dark:bg-gray-700 dark:text-white"
                                        : "border-gray-200 text-gray-600 hover:border-gray-300 hover:text-gray-900 dark:border-gray-700 dark:text-gray-300 dark:hover:border-gray-500 dark:hover:text-white"
                                }`}
                            >
                                {option}
                            </button>
                        ))}
                    </div>
                    <FormField label="취소 사유">
                        <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className={`${MODAL_INPUT_CLASS} resize-none`} />
                    </FormField>
                    <ModalActions onClose={onClose} busy={busy} submitLabel="취소 처리" busyLabel="처리 중..." muted />
                </form>
        </AdminModal>
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
    const [formError, setFormError] = useState("");

    function handleSubmit(e: FormEvent) {
        e.preventDefault();
        if (!form.childName.trim() || !form.parentName.trim() || !form.parentPhone.trim()) {
            setFormError("아이 이름, 학부모 이름, 연락처를 입력해주세요.");
            return;
        }
        setFormError("");
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
        <AdminModal onClose={onClose} titleId="trial-add-title" panelClassName="max-w-md p-6">
                <h2 id="trial-add-title" className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                    <span className="material-symbols-outlined text-brand-orange-500 dark:text-brand-neon-lime">person_add</span>
                    체험 신청 등록
                </h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    {formError && (
                        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-200">
                            {formError}
                        </p>
                    )}
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
        </AdminModal>
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
    const [formError, setFormError] = useState("");

    function handleSubmit(e: FormEvent) {
        e.preventDefault();
        if (!form.name.trim() || !form.birthDate || !form.parentName.trim()) {
            setFormError("아이 이름, 생년월일, 학부모 이름을 입력해주세요.");
            return;
        }
        setFormError("");
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
        <AdminModal onClose={onClose} titleId="trial-convert-title" panelClassName="max-w-md p-6">
                <h2 id="trial-convert-title" className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                    <span className="material-symbols-outlined text-emerald-500">how_to_reg</span>
                    정규 등록 전환
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    체험 학생 &quot;{lead.childName}&quot;을 정규 원생으로 등록합니다.
                </p>
                <form onSubmit={handleSubmit} className="space-y-4">
                    {formError && (
                        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-200">
                            {formError}
                        </p>
                    )}
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
        </AdminModal>
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
        <AdminModal onClose={onClose} titleId="trial-lost-title" panelClassName="max-w-md p-6">
                <h2 id="trial-lost-title" className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
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
        </AdminModal>
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
        <AdminModal onClose={onClose} titleId="trial-memo-title" panelClassName="max-w-md p-6">
                <h2 id="trial-memo-title" className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
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
        </AdminModal>
    );
}
