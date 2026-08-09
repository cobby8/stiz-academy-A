"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { createTrialLead, convertTrialToStudent, updateTrialLead } from "@/app/actions/admin";
import AdminModal from "@/components/admin/AdminModal";
import {
    resolveTrialScheduleStartTime,
    seoulDateInputValue,
    seoulTimeInputValue,
    toSeoulScheduledDateTime,
} from "@/lib/trial-schedule-time";
import type { ClassInfo, TrialLead } from "./TrialCrmClient";

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
    classes: ClassInfo[];
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
    classes,
    onSaved,
    onFeedback,
}: TrialCrmModalsProps) {
    const [busy, setBusy] = useState(false);

    async function runAction(
        action: () => Promise<unknown>,
        onDone: () => void,
        successMessage: string,
        resultMessage?: (result: unknown) => { type: "success" | "error"; message: string } | null,
    ) {
        setBusy(true);
        try {
            const result = await action();
            onDone();
            await onSaved();
            const feedback = resultMessage?.(result);
            onFeedback(feedback?.type ?? "success", feedback?.message ?? successMessage);
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
                    classes={classes}
                    onClose={onCloseSchedule}
                    onSubmit={(data) =>
                        runAction(
                            () => updateTrialLead(scheduleLead.id, data, {
                                action: "SCHEDULED",
                                note: "체험 일정을 저장했습니다.",
                            }),
                            onCloseSchedule,
                            "체험 일정을 저장했습니다.",
                            (result) => {
                                const scheduledSms = (
                                    result as Awaited<ReturnType<typeof updateTrialLead>>
                                )?.scheduledSms;
                                if (!scheduledSms?.attempted || scheduledSms.errors.length === 0) return null;
                                return {
                                    type: "error",
                                    message: `일정은 저장됐지만 일부 문자가 발송되지 않았습니다. ${scheduledSms.errors[0]}`,
                                };
                            },
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
    return seoulDateInputValue(dateStr);
}

function timeInputValue(dateStr: string | null) {
    return seoulTimeInputValue(dateStr);
}

function isLikelyDefaultScheduleTime(dateStr: string | null) {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return false;
    return date.getHours() === 9 && date.getMinutes() === 0;
}

const MODAL_INPUT_CLASS = "w-full rounded-[3px] border border-[var(--doc-rule)] bg-[var(--doc-surface)] px-3 py-2 text-sm text-[var(--doc-ink)] focus:outline-none focus: focus:ring-brand-orange-500    dark:focus:ring-brand-neon-lime";

const DAY_LABELS: Record<string, string> = {
    Mon: "월",
    Tue: "화",
    Wed: "수",
    Thu: "목",
    Fri: "금",
    Sat: "토",
    Sun: "일",
};

const DAY_CODE_BY_LABEL: Record<string, string> = {
    월: "Mon",
    월요일: "Mon",
    화: "Tue",
    화요일: "Tue",
    수: "Wed",
    수요일: "Wed",
    목: "Thu",
    목요일: "Thu",
    금: "Fri",
    금요일: "Fri",
    토: "Sat",
    토요일: "Sat",
    일: "Sun",
    일요일: "Sun",
};

function normalizePreferredDayCode(day: string | null) {
    if (!day) return null;
    const trimmed = day.trim();
    return DAY_LABELS[trimmed] ? trimmed : DAY_CODE_BY_LABEL[trimmed] ?? null;
}

function normalizePreferredPeriod(period: string | null) {
    if (!period) return null;
    const matched = period.match(/\d+/);
    return matched?.[0] ?? null;
}

function normalizeSlotKey(slotKey: string | null) {
    if (!slotKey) return null;
    const [dayPart, periodPart] = slotKey.trim().split("-");
    const dayCode = normalizePreferredDayCode(dayPart);
    const period = normalizePreferredPeriod(periodPart ?? "");
    return dayCode && period ? `${dayCode}-${period}` : slotKey.trim();
}

function getPreferredSlotKeyCandidates(lead: TrialLead) {
    const candidates: string[] = [];
    const directSlotKey = normalizeSlotKey(lead.preferredSlotKey);
    const dayCode = normalizePreferredDayCode(lead.preferredDay);
    const period = normalizePreferredPeriod(lead.preferredPeriod);
    const derivedSlotKey = dayCode && period ? `${dayCode}-${period}` : null;

    [directSlotKey, derivedSlotKey].forEach((slotKey) => {
        if (slotKey && !candidates.includes(slotKey)) candidates.push(slotKey);
    });

    return candidates;
}

function getPreferredClass(lead: TrialLead, classes: ClassInfo[]) {
    for (const slotKey of getPreferredSlotKeyCandidates(lead)) {
        const classInfo = classes.find((item) => item.slotKey === slotKey);
        if (classInfo) return classInfo;
    }
    return null;
}

function formatClassLabel(classInfo: ClassInfo) {
    const dayLabel = DAY_LABELS[classInfo.dayOfWeek] || classInfo.dayOfWeek;
    const timeLabel = [classInfo.startTime, classInfo.endTime].filter(Boolean).join("~");
    const programName = classInfo.program?.name ? ` · ${classInfo.program.name}` : "";
    return [dayLabel, timeLabel].filter(Boolean).join(" ") + ` · ${classInfo.name}${programName}`;
}

function formatPreferredSchedule(lead: TrialLead, classes: ClassInfo[]) {
    const preferredClass = getPreferredClass(lead, classes);
    if (preferredClass) return formatClassLabel(preferredClass);

    const rawDay = lead.preferredDay?.replace(/요일$/, "");
    const day = rawDay ? `${DAY_LABELS[rawDay] || rawDay}요일` : "";
    const period = lead.preferredPeriod
        ? lead.preferredPeriod.includes("교시")
            ? lead.preferredPeriod
            : `${lead.preferredPeriod}교시`
        : "";
    return [day, period].filter(Boolean).join(" ") || "미입력";
}

function FormField({ label, children }: { label: string; children: ReactNode }) {
    return (
        <label className="block text-sm font-medium text-[var(--doc-ink-2)]">
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
        ? "bg-[var(--doc-grid-head)] text-white hover:bg-[var(--doc-grid-head)]   dark:hover:bg-[var(--doc-surface)]"
        : accent === "sky"
            ? "bg-[var(--doc-grid-head)] text-white hover:bg-[var(--doc-grid-head)]"
            : "bg-[var(--doc-accent)] text-white hover:bg-[var(--doc-accent)]  dark:text-[var(--doc-ink)] dark:hover:bg-lime-400";

    return (
        <div className="flex gap-3 pt-2">
            <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-[3px] border border-[var(--doc-rule)] px-4 py-2.5 text-sm font-medium text-[var(--doc-ink-2)] transition hover:bg-[var(--doc-grid-head)]"
            >
                닫기
            </button>
            <button
                type="submit"
                disabled={busy}
                className={`flex-1 rounded-[3px] px-4 py-2.5 text-sm font-bold transition disabled:opacity-50 ${submitClass}`}
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
                <h2 id="trial-edit-title" className="mb-1 flex items-center gap-2 text-lg font-bold text-[var(--doc-ink)]">
                    <span className="material-symbols-outlined text-[var(--doc-accent)]">edit</span>
                    체험 신청 수정
                </h2>
                <p className="mb-4 text-sm text-[var(--doc-ink-2)]">상담 중 확인한 신청 내용을 바로 정리합니다.</p>
                <form onSubmit={handleSubmit} className="space-y-4">
                    {formError && (
                        <p className="rounded-[3px] bg-[var(--doc-crit-soft)] px-3 py-2 text-sm font-semibold text-[var(--doc-crit)]">
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
                    <label className="flex items-center gap-2 rounded-[3px] border border-[var(--doc-rule)] px-3 py-2 text-sm font-semibold text-[var(--doc-ink-2)]">
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
    classes,
    onClose,
    onSubmit,
    busy,
}: {
    lead: TrialLead;
    classes: ClassInfo[];
    onClose: () => void;
    onSubmit: (data: Record<string, unknown>) => void;
    busy: boolean;
}) {
    const initialClass =
        (lead.scheduledClassId ? classes.find((classInfo) => classInfo.id === lead.scheduledClassId) : null) ||
        getPreferredClass(lead, classes) ||
        null;
    const [scheduledClassId, setScheduledClassId] = useState(initialClass?.id ?? "");
    const initialScheduledDate = dateInputValue(lead.scheduledDate || lead.trialDate);
    const [scheduledDate, setScheduledDate] = useState(initialScheduledDate);
    const [scheduledTime, setScheduledTime] = useState(
        lead.scheduledDate && (
            Boolean(lead.scheduledClassId) ||
            !isLikelyDefaultScheduleTime(lead.scheduledDate)
        )
            ? timeInputValue(lead.scheduledDate)
            : resolveTrialScheduleStartTime(initialClass, initialScheduledDate) ||
                (isLikelyDefaultScheduleTime(lead.scheduledDate) && getPreferredSlotKeyCandidates(lead).length > 0
                    ? ""
                    : timeInputValue(lead.scheduledDate)),
    );
    const [memo, setMemo] = useState(lead.memo ?? "");
    const [formError, setFormError] = useState("");
    const preferredSchedule = formatPreferredSchedule(lead, classes);

    function handleClassChange(classId: string) {
        setScheduledClassId(classId);
        const selectedClass = classes.find((classInfo) => classInfo.id === classId);
        setScheduledTime(resolveTrialScheduleStartTime(selectedClass, scheduledDate));
    }

    function handleDateChange(date: string) {
        setScheduledDate(date);
        const selectedClass = classes.find((classInfo) => classInfo.id === scheduledClassId);
        if (selectedClass) setScheduledTime(resolveTrialScheduleStartTime(selectedClass, date));
    }

    function handleSubmit(event: FormEvent) {
        event.preventDefault();
        if (!scheduledDate || !scheduledTime) {
            setFormError("확정할 날짜와 시간을 모두 입력해주세요.");
            return;
        }
        const scheduledAt = toSeoulScheduledDateTime(scheduledDate, scheduledTime);
        if (!scheduledAt) {
            setFormError("날짜와 시간을 다시 확인해주세요.");
            return;
        }
        setFormError("");
        onSubmit({
            status: "SCHEDULED",
            scheduledDate: scheduledAt,
            scheduledClassId: scheduledClassId || null,
            memo: memo.trim() || null,
        });
    }

    return (
        <AdminModal onClose={onClose} titleId="trial-schedule-title" panelClassName="max-w-2xl p-6">
                <h2 id="trial-schedule-title" className="mb-1 flex items-center gap-2 text-lg font-bold text-[var(--doc-ink)]">
                    <span className="material-symbols-outlined text-[var(--doc-ink-2)]">event_available</span>
                    체험 일정 확정/변경
                </h2>
                <p className="mb-4 text-sm text-[var(--doc-ink-2)]">
                    <span className="font-medium text-[var(--doc-ink)]">{lead.childName}</span> 체험 일정을 저장합니다.
                </p>
                <form onSubmit={handleSubmit} className="space-y-4">
                    {formError && (
                        <p className="rounded-[3px] bg-[var(--doc-crit-soft)] px-3 py-2 text-sm font-semibold text-[var(--doc-crit)]">
                            {formError}
                        </p>
                    )}
                    <div className="grid gap-3 rounded-[3px] border border-[var(--doc-rule)] bg-[var(--doc-grid-head)] p-3 text-sm text-[var(--doc-ink-2)] sm:grid-cols-3">
                        <div>
                            <p className="text-xs font-bold uppercase opacity-70">신청일</p>
                            <p className="mt-1 font-bold">{dateInputValue(lead.createdAt) || "-"}</p>
                        </div>
                        <div>
                            <p className="text-xs font-bold uppercase opacity-70">희망일자</p>
                            <p className="mt-1 font-bold">{dateInputValue(lead.trialDate) || "미입력"}</p>
                        </div>
                        <div>
                            <p className="text-xs font-bold uppercase opacity-70">수업교시</p>
                            <p className="mt-1 font-bold">{preferredSchedule}</p>
                        </div>
                    </div>
                    <FormField label="확정 수업">
                        <select
                            value={scheduledClassId}
                            onChange={(event) => handleClassChange(event.target.value)}
                            className={MODAL_INPUT_CLASS}
                        >
                            <option value="">반 선택 안 함</option>
                            {classes.map((classInfo) => (
                                <option key={classInfo.id} value={classInfo.id}>
                                    {formatClassLabel(classInfo)}
                                </option>
                            ))}
                        </select>
                    </FormField>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <FormField label="확정 날짜 *">
                            <input type="date" value={scheduledDate} onChange={(e) => handleDateChange(e.target.value)} className={MODAL_INPUT_CLASS} />
                        </FormField>
                        <FormField label="확정 시간 *">
                            <input type="time" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} className={MODAL_INPUT_CLASS} />
                        </FormField>
                    </div>
                    <p className="rounded-[3px] bg-[var(--doc-grid-head)] px-3 py-2 text-xs font-semibold text-[var(--doc-ink-2)]">
                        확정 수업을 선택하면 해당 반의 시작 시간이 자동으로 들어갑니다. 실제 체험 시간이 다르면 시간만 직접 바꿔주세요.
                    </p>
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
                <h2 id="trial-cancel-title" className="mb-1 flex items-center gap-2 text-lg font-bold text-[var(--doc-ink)]">
                    <span className="material-symbols-outlined text-[var(--doc-ink-2)]">block</span>
                    체험 신청 취소
                </h2>
                <p className="mb-4 text-sm text-[var(--doc-ink-2)]">
                    <span className="font-medium text-[var(--doc-ink)]">{lead.childName}</span> 신청을 삭제하지 않고 취소 상태로 남깁니다.
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
                                className={`rounded-[3px] border px-3 py-1 text-xs font-semibold transition ${
 reason === option
 ? "border-[var(--doc-rule)] bg-[var(--doc-grid-head)] text-[var(--doc-ink)] "
 : "border-[var(--doc-rule)] text-[var(--doc-ink-2)] hover:border-[var(--doc-rule)] hover:text-[var(--doc-ink)] dark:hover:border-[var(--doc-rule)] "
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
                <h2 id="trial-add-title" className="text-lg font-bold text-[var(--doc-ink)] flex items-center gap-2 mb-4">
                    <span className="material-symbols-outlined text-[var(--doc-accent)]">person_add</span>
                    체험 신청 등록
                </h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    {formError && (
                        <p className="rounded-[3px] bg-[var(--doc-crit-soft)] px-3 py-2 text-sm font-semibold text-[var(--doc-crit)]">
                            {formError}
                        </p>
                    )}
                    <div>
                        <label className="block text-sm font-medium text-[var(--doc-ink-2)] mb-1">아이 이름 *</label>
                        <input
                            type="text"
                            value={form.childName}
                            onChange={(e) => setForm({ ...form, childName: e.target.value })}
                            className="w-full border border-[var(--doc-rule)] rounded-[3px] px-3 py-2 text-sm focus:outline-none focus: focus:ring-brand-orange-500 dark:focus:ring-brand-neon-lime"
                            placeholder="홍길동"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[var(--doc-ink-2)] mb-1">나이/학년</label>
                        <input
                            type="text"
                            value={form.childAge}
                            onChange={(e) => setForm({ ...form, childAge: e.target.value })}
                            className="w-full border border-[var(--doc-rule)] rounded-[3px] px-3 py-2 text-sm focus:outline-none focus: focus:ring-brand-orange-500 dark:focus:ring-brand-neon-lime"
                            placeholder="초등 3학년"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[var(--doc-ink-2)] mb-1">학부모 이름 *</label>
                        <input
                            type="text"
                            value={form.parentName}
                            onChange={(e) => setForm({ ...form, parentName: e.target.value })}
                            className="w-full border border-[var(--doc-rule)] rounded-[3px] px-3 py-2 text-sm focus:outline-none focus: focus:ring-brand-orange-500 dark:focus:ring-brand-neon-lime"
                            placeholder="홍부모"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[var(--doc-ink-2)] mb-1">연락처 *</label>
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
                            className="w-full border border-[var(--doc-rule)] rounded-[3px] px-3 py-2 text-sm focus:outline-none focus: focus:ring-brand-orange-500 dark:focus:ring-brand-neon-lime"
                            placeholder="숫자만 입력 (자동 변환: 010-1234-5678)"
                        />
                        <p className="text-xs text-[var(--doc-ink-3)] mt-1">숫자만 입력하면 자동으로 000-0000-0000 형식으로 변환됩니다</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[var(--doc-ink-2)] mb-1">유입 경로</label>
                        <select
                            value={form.source}
                            onChange={(e) => setForm({ ...form, source: e.target.value })}
                            className="w-full border border-[var(--doc-rule)] rounded-[3px] px-3 py-2 text-sm focus:outline-none focus: focus:ring-brand-orange-500 dark:focus:ring-brand-neon-lime"
                        >
                            <option value="WEBSITE">홈페이지</option>
                            <option value="NAVER">네이버</option>
                            <option value="REFERRAL">지인소개</option>
                            <option value="OTHER">기타</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[var(--doc-ink-2)] mb-1">메모</label>
                        <textarea
                            value={form.memo}
                            onChange={(e) => setForm({ ...form, memo: e.target.value })}
                            rows={3}
                            className="w-full border border-[var(--doc-rule)] rounded-[3px] px-3 py-2 text-sm focus:outline-none focus: focus:ring-brand-orange-500 dark:focus:ring-brand-neon-lime resize-none"
                            placeholder="추가 메모 사항"
                        />
                    </div>
                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2.5 border border-[var(--doc-rule)] rounded-[3px] text-[var(--doc-ink-2)] hover:bg-[var(--doc-grid-head)] transition-colors text-sm font-medium"
                        >
                            취소
                        </button>
                        <button
                            type="submit"
                            disabled={busy}
                            className="flex-1 px-4 py-2.5 bg-[var(--doc-accent)] dark:text-[var(--doc-ink)] text-white rounded-[3px] hover:bg-[var(--doc-accent)] dark:hover:bg-lime-400 transition-colors text-sm font-medium disabled:opacity-50"
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
                <h2 id="trial-convert-title" className="text-lg font-bold text-[var(--doc-ink)] flex items-center gap-2 mb-4">
                    <span className="material-symbols-outlined text-[var(--doc-accent)]">how_to_reg</span>
                    정규 등록 전환
                </h2>
                <p className="text-sm text-[var(--doc-ink-2)] mb-4">
                    체험 학생 &quot;{lead.childName}&quot;을 정규 원생으로 등록합니다.
                </p>
                <form onSubmit={handleSubmit} className="space-y-4">
                    {formError && (
                        <p className="rounded-[3px] bg-[var(--doc-crit-soft)] px-3 py-2 text-sm font-semibold text-[var(--doc-crit)]">
                            {formError}
                        </p>
                    )}
                    <div>
                        <label className="block text-sm font-medium text-[var(--doc-ink-2)] mb-1">아이 이름 *</label>
                        <input
                            type="text"
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            className="w-full border border-[var(--doc-rule)] rounded-[3px] px-3 py-2 text-sm focus:outline-none focus: focus:ring-brand-orange-500 dark:focus:ring-brand-neon-lime"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[var(--doc-ink-2)] mb-1">생년월일 *</label>
                        <input
                            type="date"
                            min="1950-01-01"
                            max="2025-12-31"
                            value={form.birthDate}
                            onChange={(e) => setForm({ ...form, birthDate: e.target.value })}
                            className="w-full border border-[var(--doc-rule)] rounded-[3px] px-3 py-2 text-sm focus:outline-none focus: focus:ring-brand-orange-500 dark:focus:ring-brand-neon-lime"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[var(--doc-ink-2)] mb-1">성별</label>
                        <select
                            value={form.gender}
                            onChange={(e) => setForm({ ...form, gender: e.target.value })}
                            className="w-full border border-[var(--doc-rule)] rounded-[3px] px-3 py-2 text-sm focus:outline-none focus: focus:ring-brand-orange-500 dark:focus:ring-brand-neon-lime"
                        >
                            <option value="">선택 안함</option>
                            <option value="남">남</option>
                            <option value="여">여</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[var(--doc-ink-2)] mb-1">학부모 이름 *</label>
                        <input
                            type="text"
                            value={form.parentName}
                            onChange={(e) => setForm({ ...form, parentName: e.target.value })}
                            className="w-full border border-[var(--doc-rule)] rounded-[3px] px-3 py-2 text-sm focus:outline-none focus: focus:ring-brand-orange-500 dark:focus:ring-brand-neon-lime"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[var(--doc-ink-2)] mb-1">학부모 연락처</label>
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
                            className="w-full border border-[var(--doc-rule)] rounded-[3px] px-3 py-2 text-sm focus:outline-none focus: focus:ring-brand-orange-500 dark:focus:ring-brand-neon-lime"
                            placeholder="숫자만 입력 (자동 변환: 010-1234-5678)"
                        />
                        <p className="text-xs text-[var(--doc-ink-3)] mt-1">숫자만 입력하면 자동으로 000-0000-0000 형식으로 변환됩니다</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[var(--doc-ink-2)] mb-1">학부모 이메일</label>
                        <input
                            type="email"
                            value={form.parentEmail}
                            onChange={(e) => setForm({ ...form, parentEmail: e.target.value })}
                            className="w-full border border-[var(--doc-rule)] rounded-[3px] px-3 py-2 text-sm focus:outline-none focus: focus:ring-brand-orange-500 dark:focus:ring-brand-neon-lime"
                            placeholder="로그인에 사용됩니다 (선택)"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[var(--doc-ink-2)] mb-1">메모</label>
                        <textarea
                            value={form.memo}
                            onChange={(e) => setForm({ ...form, memo: e.target.value })}
                            rows={2}
                            className="w-full border border-[var(--doc-rule)] rounded-[3px] px-3 py-2 text-sm focus:outline-none focus: focus:ring-brand-orange-500 dark:focus:ring-brand-neon-lime resize-none"
                        />
                    </div>
                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2.5 border border-[var(--doc-rule)] rounded-[3px] text-[var(--doc-ink-2)] hover:bg-[var(--doc-grid-head)] transition-colors text-sm font-medium"
                        >
                            취소
                        </button>
                        <button
                            type="submit"
                            disabled={busy}
                            className="flex-1 px-4 py-2.5 bg-[var(--doc-accent)] text-white rounded-[3px] hover:bg-[var(--doc-accent)] transition-colors text-sm font-medium disabled:opacity-50"
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
                <h2 id="trial-lost-title" className="text-lg font-bold text-[var(--doc-ink)] flex items-center gap-2 mb-4">
                    <span className="material-symbols-outlined text-[var(--doc-crit)]">person_off</span>
                    이탈 처리
                </h2>
                <p className="text-sm text-[var(--doc-ink-2)] mb-4">
                    &quot;{lead.childName}&quot; 체험 건을 이탈로 처리합니다.
                </p>
                <div className="mb-4">
                    <label className="block text-sm font-medium text-[var(--doc-ink-2)] mb-1">이탈 사유</label>
                    <textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        rows={3}
                        className="w-full border border-[var(--doc-rule)] rounded-[3px] px-3 py-2 text-sm focus:outline-none focus: focus:ring-brand-orange-500 dark:focus:ring-brand-neon-lime resize-none"
                        placeholder="사유를 입력하세요 (선택)"
                    />
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-2.5 border border-[var(--doc-rule)] rounded-[3px] text-[var(--doc-ink-2)] hover:bg-[var(--doc-grid-head)] transition-colors text-sm font-medium"
                    >
                        취소
                    </button>
                    <button
                        onClick={() => onSubmit(reason)}
                        disabled={busy}
                        className="flex-1 px-4 py-2.5 bg-[var(--doc-crit)] text-white rounded-[3px] hover:bg-[var(--doc-crit)] transition-colors text-sm font-medium disabled:opacity-50"
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
                <h2 id="trial-memo-title" className="text-lg font-bold text-[var(--doc-ink)] flex items-center gap-2 mb-4">
                    <span className="material-symbols-outlined text-[var(--doc-accent)]">edit_note</span>
                    메모 편집
                </h2>
                <div className="mb-4">
                    <textarea
                        value={memo}
                        onChange={(e) => setMemo(e.target.value)}
                        rows={4}
                        className="w-full border border-[var(--doc-rule)] rounded-[3px] px-3 py-2 text-sm focus:outline-none focus: focus:ring-brand-orange-500 dark:focus:ring-brand-neon-lime resize-none"
                        placeholder="메모를 입력하세요"
                        autoFocus
                    />
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-2.5 border border-[var(--doc-rule)] rounded-[3px] text-[var(--doc-ink-2)] hover:bg-[var(--doc-grid-head)] transition-colors text-sm font-medium"
                    >
                        취소
                    </button>
                    <button
                        onClick={() => onSubmit(memo)}
                        disabled={busy}
                        className="flex-1 px-4 py-2.5 bg-[var(--doc-accent)] dark:text-[var(--doc-ink)] text-white rounded-[3px] hover:bg-[var(--doc-accent)] dark:hover:bg-lime-400 transition-colors text-sm font-medium disabled:opacity-50"
                    >
                        {busy ? "저장 중..." : "저장"}
                    </button>
                </div>
        </AdminModal>
    );
}
