"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import {
    approveEnrollApplication,
    cancelEnrollApplication,
    rejectEnrollApplication,
    updateEnrollApplication,
} from "@/app/actions/admin";

interface EnrollApplication {
    id: string;
    trialLeadId: string | null;
    childName: string;
    childBirthDate: string;
    childGender: string | null;
    childGrade: string | null;
    childSchool: string | null;
    childPhone: string | null;
    parentName: string;
    parentPhone: string;
    parentRelation: string | null;
    address: string | null;
    enrollmentMonths: string | null;
    preferredSlotKeys: string | null;
    assignedClassId: string | null;
    basketballExp: string | null;
    uniformSize: string | null;
    shuttleNeeded: boolean;
    shuttlePickup: string | null;
    shuttleTime: string | null;
    shuttleDropoff: string | null;
    paymentMethod: string | null;
    referralSource: string | null;
    memo: string | null;
    applicationNoticeConfirmed: boolean;
    shuttleNoticeConfirmed: boolean;
    status: string;
    processedAt: string | null;
    processedNote: string | null;
    convertedStudentId: string | null;
    createdAt: string;
    updatedAt: string;
}

interface ClassInfo {
    id: string;
    name: string;
    dayOfWeek: string;
    startTime: string;
    endTime: string;
    capacity: number;
    slotKey: string | null;
    program: { id: string; name: string } | null;
}

interface ApplyAdminModalsProps {
    approveApp: EnrollApplication | null;
    rejectApp: EnrollApplication | null;
    detailApp: EnrollApplication | null;
    editApp: EnrollApplication | null;
    cancelApp: EnrollApplication | null;
    classes: ClassInfo[];
    onCloseApprove: () => void;
    onCloseReject: () => void;
    onCloseDetail: () => void;
    onCloseEdit: () => void;
    onCloseCancel: () => void;
    onSaved: () => Promise<void> | void;
    onFeedback: (type: "success" | "error", message: string) => void;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
    PENDING: { label: "대기중", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950/50 dark:text-yellow-200", icon: "hourglass_top" },
    APPROVED: { label: "승인완료", color: "bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-200", icon: "check_circle" },
    REJECTED: { label: "반려", color: "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-200", icon: "cancel" },
    CANCELLED: { label: "취소", color: "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400", icon: "block" },
};

const SOURCE_LABELS: Record<string, string> = {
    REFERRAL: "지인소개",
    PASSBY: "지나가다 발견",
    NAVER_SEARCH: "네이버 키워드 검색",
    NAVER_BLOG: "네이버 블로그",
    PORTAL_OTHER: "기타 포털검색",
    INSTAGRAM: "인스타그램",
    SOOMGO: "숨고",
    EXISTING_STUDENT: "기존 수강생",
    OTHER: "기타",
    WEBSITE: "홈페이지",
    NAVER: "네이버",
    FLYER: "전단지",
};

const DAY_LABELS: Record<string, string> = {
    Mon: "월",
    Tue: "화",
    Wed: "수",
    Thu: "목",
    Fri: "금",
    Sat: "토",
    Sun: "일",
};

const REJECT_REASON_OPTIONS = ["정원 마감", "희망 시간대 불일치", "연락 불가", "셔틀 동선 확인 필요"];
const CANCEL_REASON_OPTIONS = ["학부모 요청", "일정 변경", "중복 신청", "연락 불가", "기타"];
const MODAL_INPUT_CLASS = "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-orange-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:focus:ring-brand-neon-lime";

function phoneHref(phone: string) {
    const digits = phone.replace(/\D/g, "");
    return digits ? `tel:${digits}` : undefined;
}

function joinSummaryLines(lines: Array<string | null | undefined | false>) {
    return lines.filter(Boolean).join("\n");
}

async function copyTextToClipboard(text: string) {
    if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return;
    }

    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
}

function formatDetailDate(dateStr: string | null) {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
}

function dateInputValue(dateStr: string | null) {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return "";
    return date.toISOString().slice(0, 10);
}

function formatPhoneInput(value: string) {
    const nums = value.replace(/\D/g, "").slice(0, 11);
    if (nums.length > 7) return `${nums.slice(0, 3)}-${nums.slice(3, 7)}-${nums.slice(7)}`;
    if (nums.length > 3) return `${nums.slice(0, 3)}-${nums.slice(3)}`;
    return nums;
}

function FormField({ label, children }: { label: string; children: ReactNode }) {
    return (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
            <span className="mb-1 block">{label}</span>
            {children}
        </label>
    );
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined | boolean }) {
    if (value === null || value === undefined || value === "") return null;
    const displayValue = typeof value === "boolean" ? (value ? "네" : "아니오") : value;
    return (
        <div className="flex items-start gap-2 text-sm">
            <span className="text-gray-500 dark:text-gray-400 min-w-[80px] flex-shrink-0">{label}</span>
            <span className="text-gray-900 dark:text-white font-medium">{displayValue}</span>
        </div>
    );
}

function formatClassLabel(classInfo: ClassInfo) {
    const dayLabel = DAY_LABELS[classInfo.dayOfWeek] || classInfo.dayOfWeek;
    const programName = classInfo.program?.name ? ` · ${classInfo.program.name}` : "";
    return `${dayLabel} ${classInfo.startTime}~${classInfo.endTime} · ${classInfo.name}${programName}`;
}

function formatPreferredSlots(slotKeys: string | null, classes: ClassInfo[]) {
    if (!slotKeys) return null;
    const keys = slotKeys.split(",").map((key) => key.trim()).filter(Boolean);
    if (keys.length === 0) return null;

    const classesBySlotKey = new Map<string, ClassInfo>();
    classes.forEach((classInfo) => {
        if (classInfo.slotKey) classesBySlotKey.set(classInfo.slotKey, classInfo);
    });

    const labels: string[] = [];
    let unknownCount = 0;

    keys.forEach((key) => {
        const classInfo = classesBySlotKey.get(key);
        if (classInfo) {
            labels.push(formatClassLabel(classInfo));
        } else {
            unknownCount += 1;
        }
    });

    if (labels.length === 0) return "희망 시간 확인 필요";
    if (unknownCount > 0) return `${labels.join(" / ")} 외 ${unknownCount}개 시간 확인 필요`;
    return labels.join(" / ");
}

function formatApplicationCopySummary(app: EnrollApplication, preferredSlotLabel: string | null) {
    const childInfo = [app.childGrade, app.childSchool, app.childGender].filter(Boolean).join(" / ");
    const parentInfo = `${app.parentName}${app.parentRelation ? ` (${app.parentRelation})` : ""}`;
    const shuttleInfo = app.shuttleNeeded
        ? [app.shuttlePickup, app.shuttleDropoff, app.shuttleTime].filter(Boolean).join(" / ") || "필요"
        : null;

    return joinSummaryLines([
        `[수강신청] ${app.childName}`,
        childInfo ? `학생: ${childInfo}` : null,
        `보호자: ${parentInfo}`,
        `연락처: ${app.parentPhone}`,
        app.enrollmentMonths ? `수강 월: ${app.enrollmentMonths}` : null,
        preferredSlotLabel ? `희망 시간: ${preferredSlotLabel}` : null,
        app.basketballExp ? `농구 경험: ${app.basketballExp}` : null,
        shuttleInfo ? `셔틀: ${shuttleInfo}` : null,
        app.memo ? `메모: ${app.memo}` : null,
    ]);
}

export default function ApplyAdminModals({
    approveApp,
    rejectApp,
    detailApp,
    editApp,
    cancelApp,
    classes,
    onCloseApprove,
    onCloseReject,
    onCloseDetail,
    onCloseEdit,
    onCloseCancel,
    onSaved,
    onFeedback,
}: ApplyAdminModalsProps) {
    const [busy, setBusy] = useState(false);

    async function handleApprove(classIds: string[], note: string) {
        if (!approveApp) return;
        setBusy(true);
        try {
            await approveEnrollApplication(approveApp.id, {
                classIds,
                processedNote: note,
            });
            onCloseApprove();
            await onSaved();
            onFeedback("success", `${approveApp.childName} 수강신청을 승인했습니다.`);
        } catch {
            onFeedback("error", "승인 처리 중 문제가 생겼습니다. 잠시 후 다시 시도해주세요.");
        } finally {
            setBusy(false);
        }
    }

    async function handleReject(reason: string) {
        if (!rejectApp) return;
        setBusy(true);
        try {
            await rejectEnrollApplication(rejectApp.id, reason);
            onCloseReject();
            await onSaved();
            onFeedback("success", `${rejectApp.childName} 수강신청을 반려 처리했습니다.`);
        } catch {
            onFeedback("error", "반려 처리 중 문제가 생겼습니다. 잠시 후 다시 시도해주세요.");
        } finally {
            setBusy(false);
        }
    }

    async function handleEdit(data: Record<string, any>) {
        if (!editApp) return;
        setBusy(true);
        try {
            await updateEnrollApplication(editApp.id, data);
            onCloseEdit();
            await onSaved();
            onFeedback("success", `${editApp.childName} 수강신청 내용을 수정했습니다.`);
        } catch {
            onFeedback("error", "수정 저장 중 문제가 생겼습니다. 승인된 신청은 원생/수강 등록 메뉴에서 수정해주세요.");
        } finally {
            setBusy(false);
        }
    }

    async function handleCancel(reason: string) {
        if (!cancelApp) return;
        setBusy(true);
        try {
            await cancelEnrollApplication(cancelApp.id, reason);
            onCloseCancel();
            await onSaved();
            onFeedback("success", `${cancelApp.childName} 수강신청을 취소 처리했습니다.`);
        } catch {
            onFeedback("error", "취소 처리 중 문제가 생겼습니다. 승인된 신청은 원생/수강 등록 메뉴에서 정리해주세요.");
        } finally {
            setBusy(false);
        }
    }

    return (
        <>
            {approveApp && (
                <ApproveModal
                    app={approveApp}
                    classes={classes}
                    onClose={onCloseApprove}
                    onSubmit={handleApprove}
                    busy={busy}
                />
            )}

            {rejectApp && (
                <RejectModal
                    app={rejectApp}
                    onClose={onCloseReject}
                    onSubmit={handleReject}
                    busy={busy}
                />
            )}

            {editApp && (
                <EditApplicationModal
                    app={editApp}
                    classes={classes}
                    onClose={onCloseEdit}
                    onSubmit={handleEdit}
                    busy={busy}
                />
            )}

            {cancelApp && (
                <CancelApplicationModal
                    app={cancelApp}
                    onClose={onCloseCancel}
                    onSubmit={handleCancel}
                    busy={busy}
                />
            )}

            {detailApp && (
                <DetailModal
                    app={detailApp}
                    classes={classes}
                    onClose={onCloseDetail}
                    onFeedback={onFeedback}
                />
            )}
        </>
    );
}

function ApproveModal({
    app,
    classes,
    onClose,
    onSubmit,
    busy,
}: {
    app: EnrollApplication;
    classes: ClassInfo[];
    onClose: () => void;
    onSubmit: (classIds: string[], note: string) => void;
    busy: boolean;
}) {
    const preferredKeys = app.preferredSlotKeys?.split(",").map((key) => key.trim()) ?? [];
    const preferredSlotLabel = formatPreferredSlots(app.preferredSlotKeys, classes);
    const [selectedClassIds, setSelectedClassIds] = useState<string[]>(() => {
        return classes
            .filter((classInfo) => classInfo.slotKey && preferredKeys.includes(classInfo.slotKey))
            .map((classInfo) => classInfo.id);
    });
    const [note, setNote] = useState("");
    const [formError, setFormError] = useState("");

    function toggleClass(classId: string) {
        setFormError("");
        setSelectedClassIds((prev) =>
            prev.includes(classId)
                ? prev.filter((id) => id !== classId)
                : [...prev, classId]
        );
    }

    function handleSubmit(event: FormEvent) {
        event.preventDefault();
        if (selectedClassIds.length === 0) {
            setFormError("배정할 반을 1개 이상 선택해주세요.");
            return;
        }
        setFormError("");
        onSubmit(selectedClassIds, note);
    }

    const classesByDay = classes.reduce<Record<string, ClassInfo[]>>((acc, classInfo) => {
        const day = classInfo.dayOfWeek || "기타";
        if (!acc[day]) acc[day] = [];
        acc[day].push(classInfo);
        return acc;
    }, {});

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
            <div
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6 max-h-[80vh] overflow-y-auto"
                onClick={(event) => event.stopPropagation()}
            >
                <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-1">
                    <span className="material-symbols-outlined text-green-500">check_circle</span>
                    수강 신청 승인
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    <span className="font-medium text-gray-900 dark:text-white">{app.childName}</span>을(를) 어떤 반에 배정하시겠습니까?
                </p>

                {preferredSlotLabel && (
                    <div className="bg-purple-50 text-purple-700 text-sm rounded-lg px-3 py-2 mb-4 flex items-center gap-2 dark:bg-purple-950/40 dark:text-purple-200">
                        <span className="material-symbols-outlined text-base">info</span>
                        <span>희망 시간대: <span className="font-medium">{preferredSlotLabel}</span></span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                            배정할 반 선택 (복수 선택 가능) *
                        </label>
                        <div className="space-y-3 max-h-60 overflow-y-auto">
                            {Object.entries(classesByDay).map(([day, dayClasses]) => (
                                <div key={day}>
                                    <p className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">
                                        {DAY_LABELS[day] || day}요일
                                    </p>
                                    <div className="space-y-1">
                                        {dayClasses.map((classInfo) => {
                                            const selected = selectedClassIds.includes(classInfo.id);
                                            return (
                                                <button
                                                    key={classInfo.id}
                                                    type="button"
                                                    onClick={() => toggleClass(classInfo.id)}
                                                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition border ${
                                                        selected
                                                            ? "border-green-500 bg-green-50 text-green-800 dark:bg-green-950/40 dark:text-green-200"
                                                            : "border-gray-200 dark:border-gray-700 hover:border-gray-300 text-gray-700 dark:text-gray-200"
                                                    }`}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <span>
                                                            {classInfo.name}
                                                            <span className="text-gray-400 ml-2">
                                                                {classInfo.startTime}~{classInfo.endTime}
                                                            </span>
                                                        </span>
                                                        {selected && (
                                                            <span className="material-symbols-outlined text-green-500 text-lg">check</span>
                                                        )}
                                                    </div>
                                                    {classInfo.program && (
                                                        <span className="text-xs text-gray-400">{classInfo.program.name}</span>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {formError && (
                        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-200">
                            {formError}
                        </p>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">관리자 메모</label>
                        <textarea
                            value={note}
                            onChange={(event) => setNote(event.target.value)}
                            rows={2}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                            placeholder="내부 참고용 메모 (선택사항)"
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 dark:text-gray-100 transition"
                        >
                            취소
                        </button>
                        <button
                            type="submit"
                            disabled={busy || selectedClassIds.length === 0}
                            className="flex items-center gap-1.5 px-5 py-2.5 bg-green-500 text-white rounded-xl hover:bg-green-600 transition font-medium text-sm disabled:opacity-40"
                        >
                            {busy ? (
                                <span className="material-symbols-outlined text-lg animate-spin">progress_activity</span>
                            ) : (
                                <span className="material-symbols-outlined text-lg">check_circle</span>
                            )}
                            {busy ? "처리 중..." : `승인 (${selectedClassIds.length}개 반)`}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function EditApplicationModal({
    app,
    classes,
    onClose,
    onSubmit,
    busy,
}: {
    app: EnrollApplication;
    classes: ClassInfo[];
    onClose: () => void;
    onSubmit: (data: Record<string, any>) => void;
    busy: boolean;
}) {
    const initialSlotKeys = app.preferredSlotKeys?.split(",").map((key) => key.trim()).filter(Boolean) ?? [];
    const [form, setForm] = useState({
        childName: app.childName ?? "",
        childBirthDate: dateInputValue(app.childBirthDate),
        childGender: app.childGender ?? "",
        childGrade: app.childGrade ?? "",
        childSchool: app.childSchool ?? "",
        childPhone: app.childPhone ?? "",
        parentName: app.parentName ?? "",
        parentPhone: app.parentPhone ?? "",
        parentRelation: app.parentRelation ?? "",
        address: app.address ?? "",
        enrollmentMonths: app.enrollmentMonths ?? "",
        basketballExp: app.basketballExp ?? "",
        uniformSize: app.uniformSize ?? "",
        shuttleNeeded: Boolean(app.shuttleNeeded),
        shuttlePickup: app.shuttlePickup ?? "",
        shuttleTime: app.shuttleTime ?? "",
        shuttleDropoff: app.shuttleDropoff ?? "",
        paymentMethod: app.paymentMethod ?? "",
        referralSource: app.referralSource ?? "",
        memo: app.memo ?? "",
        applicationNoticeConfirmed: Boolean(app.applicationNoticeConfirmed),
        shuttleNoticeConfirmed: Boolean(app.shuttleNoticeConfirmed),
        processedNote: app.processedNote ?? "",
    });
    const [selectedSlotKeys, setSelectedSlotKeys] = useState<string[]>(initialSlotKeys);
    const [formError, setFormError] = useState("");

    function toggleSlot(slotKey: string) {
        setSelectedSlotKeys((current) =>
            current.includes(slotKey)
                ? current.filter((key) => key !== slotKey)
                : [...current, slotKey],
        );
    }

    function handleSubmit(event: FormEvent) {
        event.preventDefault();
        if (!form.childName.trim() || !form.childBirthDate || !form.parentName.trim() || !form.parentPhone.trim()) {
            setFormError("아이 이름, 생년월일, 보호자 이름, 연락처를 입력해주세요.");
            return;
        }
        setFormError("");
        onSubmit({
            childName: form.childName.trim(),
            childBirthDate: form.childBirthDate,
            childGender: form.childGender || null,
            childGrade: form.childGrade.trim() || null,
            childSchool: form.childSchool.trim() || null,
            childPhone: form.childPhone.trim() || null,
            parentName: form.parentName.trim(),
            parentPhone: form.parentPhone.trim(),
            parentRelation: form.parentRelation.trim() || null,
            address: form.address.trim() || null,
            enrollmentMonths: form.enrollmentMonths.trim() || null,
            preferredSlotKeys: selectedSlotKeys.join(",") || null,
            basketballExp: form.basketballExp.trim() || null,
            uniformSize: form.uniformSize.trim() || null,
            shuttleNeeded: form.shuttleNeeded,
            shuttlePickup: form.shuttleNeeded ? form.shuttlePickup.trim() || null : null,
            shuttleTime: form.shuttleNeeded ? form.shuttleTime.trim() || null : null,
            shuttleDropoff: form.shuttleNeeded ? form.shuttleDropoff.trim() || null : null,
            paymentMethod: form.paymentMethod.trim() || null,
            referralSource: form.referralSource || null,
            memo: form.memo.trim() || null,
            applicationNoticeConfirmed: form.applicationNoticeConfirmed,
            shuttleNoticeConfirmed: form.shuttleNoticeConfirmed,
            processedNote: form.processedNote.trim() || null,
        });
    }

    const classesByDay = classes.reduce<Record<string, ClassInfo[]>>((acc, classInfo) => {
        const day = classInfo.dayOfWeek || "기타";
        if (!acc[day]) acc[day] = [];
        acc[day].push(classInfo);
        return acc;
    }, {});

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
            <div
                className="mx-4 max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-800"
                onClick={(event) => event.stopPropagation()}
            >
                <h2 className="mb-1 flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-white">
                    <span className="material-symbols-outlined text-brand-orange-500 dark:text-brand-neon-lime">edit</span>
                    수강신청 수정
                </h2>
                <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
                    승인 전 신청 내용을 상담 결과에 맞춰 정리합니다.
                </p>

                <form onSubmit={handleSubmit} className="space-y-5">
                    {formError && (
                        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-200">
                            {formError}
                        </p>
                    )}

                    <section>
                        <h3 className="mb-2 text-xs font-black uppercase text-gray-500 dark:text-gray-400">아이 정보</h3>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <FormField label="아이 이름 *">
                                <input value={form.childName} onChange={(e) => setForm({ ...form, childName: e.target.value })} className={MODAL_INPUT_CLASS} />
                            </FormField>
                            <FormField label="생년월일 *">
                                <input type="date" value={form.childBirthDate} onChange={(e) => setForm({ ...form, childBirthDate: e.target.value })} className={MODAL_INPUT_CLASS} />
                            </FormField>
                            <FormField label="성별">
                                <select value={form.childGender} onChange={(e) => setForm({ ...form, childGender: e.target.value })} className={MODAL_INPUT_CLASS}>
                                    <option value="">선택 안 함</option>
                                    <option value="남">남</option>
                                    <option value="여">여</option>
                                </select>
                            </FormField>
                            <FormField label="학년">
                                <input value={form.childGrade} onChange={(e) => setForm({ ...form, childGrade: e.target.value })} className={MODAL_INPUT_CLASS} />
                            </FormField>
                            <FormField label="학교">
                                <input value={form.childSchool} onChange={(e) => setForm({ ...form, childSchool: e.target.value })} className={MODAL_INPUT_CLASS} />
                            </FormField>
                            <FormField label="아이 연락처">
                                <input type="tel" value={form.childPhone} onChange={(e) => setForm({ ...form, childPhone: formatPhoneInput(e.target.value) })} className={MODAL_INPUT_CLASS} />
                            </FormField>
                        </div>
                    </section>

                    <section>
                        <h3 className="mb-2 text-xs font-black uppercase text-gray-500 dark:text-gray-400">보호자 정보</h3>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <FormField label="보호자 이름 *">
                                <input value={form.parentName} onChange={(e) => setForm({ ...form, parentName: e.target.value })} className={MODAL_INPUT_CLASS} />
                            </FormField>
                            <FormField label="보호자 연락처 *">
                                <input type="tel" value={form.parentPhone} onChange={(e) => setForm({ ...form, parentPhone: formatPhoneInput(e.target.value) })} className={MODAL_INPUT_CLASS} />
                            </FormField>
                            <FormField label="관계">
                                <input value={form.parentRelation} onChange={(e) => setForm({ ...form, parentRelation: e.target.value })} className={MODAL_INPUT_CLASS} placeholder="부 / 모 / 기타" />
                            </FormField>
                            <FormField label="주소">
                                <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className={MODAL_INPUT_CLASS} />
                            </FormField>
                        </div>
                    </section>

                    <section>
                        <h3 className="mb-2 text-xs font-black uppercase text-gray-500 dark:text-gray-400">수강 정보</h3>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <FormField label="수강 월">
                                <input value={form.enrollmentMonths} onChange={(e) => setForm({ ...form, enrollmentMonths: e.target.value })} className={MODAL_INPUT_CLASS} placeholder="8월, 9월" />
                            </FormField>
                            <FormField label="농구 경험">
                                <input value={form.basketballExp} onChange={(e) => setForm({ ...form, basketballExp: e.target.value })} className={MODAL_INPUT_CLASS} />
                            </FormField>
                            <FormField label="유니폼 사이즈">
                                <input value={form.uniformSize} onChange={(e) => setForm({ ...form, uniformSize: e.target.value })} className={MODAL_INPUT_CLASS} />
                            </FormField>
                            <FormField label="납부 방식">
                                <input value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })} className={MODAL_INPUT_CLASS} />
                            </FormField>
                            <FormField label="유입 경로">
                                <select value={form.referralSource} onChange={(e) => setForm({ ...form, referralSource: e.target.value })} className={MODAL_INPUT_CLASS}>
                                    <option value="">선택 안 함</option>
                                    {Object.entries(SOURCE_LABELS).map(([value, label]) => (
                                        <option key={value} value={value}>{label}</option>
                                    ))}
                                </select>
                            </FormField>
                        </div>
                    </section>

                    <section>
                        <h3 className="mb-2 text-xs font-black uppercase text-gray-500 dark:text-gray-400">희망 시간</h3>
                        <div className="max-h-56 space-y-3 overflow-y-auto rounded-xl border border-gray-200 p-3 dark:border-gray-700">
                            {Object.entries(classesByDay).map(([day, dayClasses]) => (
                                <div key={day}>
                                    <p className="mb-1 text-xs font-bold text-gray-500 dark:text-gray-400">{DAY_LABELS[day] || day}요일</p>
                                    <div className="grid gap-2 sm:grid-cols-2">
                                        {dayClasses.map((classInfo) => {
                                            const slotKey = classInfo.slotKey;
                                            if (!slotKey) return null;
                                            const selected = selectedSlotKeys.includes(slotKey);
                                            return (
                                                <button
                                                    key={classInfo.id}
                                                    type="button"
                                                    onClick={() => toggleSlot(slotKey)}
                                                    className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
                                                        selected
                                                            ? "border-lime-400 bg-lime-50 text-lime-800 dark:bg-lime-950/40 dark:text-lime-200"
                                                            : "border-gray-200 text-gray-700 hover:border-gray-300 dark:border-gray-700 dark:text-gray-200"
                                                    }`}
                                                >
                                                    <div className="flex items-center justify-between gap-2">
                                                        <span className="font-bold">{classInfo.name}</span>
                                                        {selected && <span className="material-symbols-outlined text-lg text-lime-500">check</span>}
                                                    </div>
                                                    <span className="text-xs text-gray-500 dark:text-gray-400">{classInfo.startTime}~{classInfo.endTime}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    <section>
                        <h3 className="mb-2 text-xs font-black uppercase text-gray-500 dark:text-gray-400">셔틀/메모</h3>
                        <label className="mb-3 flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 dark:border-gray-700 dark:text-gray-200">
                            <input
                                type="checkbox"
                                checked={form.shuttleNeeded}
                                onChange={(e) => setForm({ ...form, shuttleNeeded: e.target.checked })}
                            />
                            셔틀 필요
                        </label>
                        {form.shuttleNeeded && (
                            <div className="mb-3 grid gap-3 sm:grid-cols-3">
                                <FormField label="탑승지">
                                    <input value={form.shuttlePickup} onChange={(e) => setForm({ ...form, shuttlePickup: e.target.value })} className={MODAL_INPUT_CLASS} />
                                </FormField>
                                <FormField label="하차지">
                                    <input value={form.shuttleDropoff} onChange={(e) => setForm({ ...form, shuttleDropoff: e.target.value })} className={MODAL_INPUT_CLASS} />
                                </FormField>
                                <FormField label="셔틀 시간">
                                    <input value={form.shuttleTime} onChange={(e) => setForm({ ...form, shuttleTime: e.target.value })} className={MODAL_INPUT_CLASS} />
                                </FormField>
                            </div>
                        )}
                        <div className="grid gap-3 sm:grid-cols-2">
                            <FormField label="보호자 메모">
                                <textarea value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} rows={3} className={`${MODAL_INPUT_CLASS} resize-none`} />
                            </FormField>
                            <FormField label="관리 메모">
                                <textarea value={form.processedNote} onChange={(e) => setForm({ ...form, processedNote: e.target.value })} rows={3} className={`${MODAL_INPUT_CLASS} resize-none`} />
                            </FormField>
                        </div>
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                            <label className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 dark:border-gray-700 dark:text-gray-200">
                                <input
                                    type="checkbox"
                                    checked={form.applicationNoticeConfirmed}
                                    onChange={(e) => setForm({ ...form, applicationNoticeConfirmed: e.target.checked })}
                                />
                                신청 안내 확인
                            </label>
                            <label className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 dark:border-gray-700 dark:text-gray-200">
                                <input
                                    type="checkbox"
                                    checked={form.shuttleNoticeConfirmed}
                                    onChange={(e) => setForm({ ...form, shuttleNoticeConfirmed: e.target.checked })}
                                />
                                셔틀 안내 확인
                            </label>
                        </div>
                    </section>

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
                            className="flex-1 rounded-lg bg-brand-orange-500 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-orange-600 disabled:opacity-50 dark:bg-brand-neon-lime dark:text-brand-navy-900 dark:hover:bg-lime-400"
                        >
                            {busy ? "저장 중..." : "수정 저장"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function CancelApplicationModal({
    app,
    onClose,
    onSubmit,
    busy,
}: {
    app: EnrollApplication;
    onClose: () => void;
    onSubmit: (reason: string) => void;
    busy: boolean;
}) {
    const [reason, setReason] = useState("학부모 요청");

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
            <div className="mx-4 w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-800" onClick={(event) => event.stopPropagation()}>
                <h2 className="mb-1 flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-white">
                    <span className="material-symbols-outlined text-gray-500">block</span>
                    수강신청 취소
                </h2>
                <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
                    <span className="font-medium text-gray-900 dark:text-white">{app.childName}</span> 신청을 삭제하지 않고 취소 상태로 남깁니다.
                </p>
                <form
                    onSubmit={(event) => {
                        event.preventDefault();
                        onSubmit(reason.trim() || "관리자 취소");
                    }}
                    className="space-y-4"
                >
                    <div className="flex flex-wrap gap-2">
                        {CANCEL_REASON_OPTIONS.map((option) => (
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
                        <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} className={`${MODAL_INPUT_CLASS} resize-none`} />
                    </FormField>
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
                            className="flex-1 rounded-lg bg-gray-700 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-gray-800 disabled:opacity-50 dark:bg-gray-200 dark:text-gray-900 dark:hover:bg-white"
                        >
                            {busy ? "처리 중..." : "취소 처리"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function RejectModal({
    app,
    onClose,
    onSubmit,
    busy,
}: {
    app: EnrollApplication;
    onClose: () => void;
    onSubmit: (reason: string) => void;
    busy: boolean;
}) {
    const [reason, setReason] = useState("");

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md mx-4 p-6" onClick={(event) => event.stopPropagation()}>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-1">
                    <span className="material-symbols-outlined text-red-500">cancel</span>
                    수강 신청 반려
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    <span className="font-medium text-gray-900 dark:text-white">{app.childName}</span>의 신청을 반려합니다.
                </p>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">반려 사유</label>
                        <div className="mb-2 flex flex-wrap gap-2">
                            {REJECT_REASON_OPTIONS.map((option) => (
                                <button
                                    key={option}
                                    type="button"
                                    onClick={() => setReason(option)}
                                    className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                                        reason === option
                                            ? "border-red-400 bg-red-50 text-red-700 dark:border-red-500 dark:bg-red-950/40 dark:text-red-200"
                                            : "border-gray-200 text-gray-600 hover:border-red-200 hover:text-red-600 dark:border-gray-700 dark:text-gray-300 dark:hover:border-red-500 dark:hover:text-red-200"
                                    }`}
                                >
                                    {option}
                                </button>
                            ))}
                        </div>
                        <textarea
                            value={reason}
                            onChange={(event) => setReason(event.target.value)}
                            rows={3}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
                            placeholder="반려 사유를 입력하세요 (선택)"
                        />
                    </div>

                    <div className="flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 dark:text-gray-100 transition"
                        >
                            취소
                        </button>
                        <button
                            onClick={() => onSubmit(reason)}
                            disabled={busy}
                            className="flex items-center gap-1.5 px-5 py-2.5 bg-red-500 text-white rounded-xl hover:bg-red-600 transition font-medium text-sm disabled:opacity-40"
                        >
                            {busy ? (
                                <span className="material-symbols-outlined text-lg animate-spin">progress_activity</span>
                            ) : (
                                <span className="material-symbols-outlined text-lg">cancel</span>
                            )}
                            {busy ? "처리 중..." : "반려 처리"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function DetailModal({
    app,
    classes,
    onClose,
    onFeedback,
}: {
    app: EnrollApplication;
    classes: ClassInfo[];
    onClose: () => void;
    onFeedback: (type: "success" | "error", message: string) => void;
}) {
    const cfg = STATUS_CONFIG[app.status] || STATUS_CONFIG.PENDING;
    const preferredSlotLabel = formatPreferredSlots(app.preferredSlotKeys, classes);
    const parentPhoneHref = phoneHref(app.parentPhone);

    async function handleCopy(text: string, message: string) {
        try {
            await copyTextToClipboard(text);
            onFeedback("success", message);
        } catch {
            onFeedback("error", "복사 중 문제가 생겼습니다. 직접 선택해서 복사해주세요.");
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
            <div
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6 max-h-[80vh] overflow-y-auto"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <span className="material-symbols-outlined text-brand-orange-500 dark:text-brand-neon-lime">assignment</span>
                        수강 신청 상세
                    </h2>
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.color}`}>
                        <span className="material-symbols-outlined text-sm">{cfg.icon}</span>
                        {cfg.label}
                    </span>
                </div>

                <div className="mb-5 grid gap-2 sm:grid-cols-3">
                    <a
                        href={parentPhoneHref}
                        className="flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-sm font-bold text-gray-700 transition hover:border-brand-orange-300 hover:bg-brand-orange-50 hover:text-brand-orange-700 dark:border-gray-700 dark:text-gray-200 dark:hover:border-brand-neon-lime dark:hover:bg-brand-neon-lime/10 dark:hover:text-brand-neon-lime"
                    >
                        <span className="material-symbols-outlined text-lg">call</span>
                        전화
                    </a>
                    <button
                        type="button"
                        onClick={() => handleCopy(app.parentPhone, `${app.childName} 보호자 연락처를 복사했습니다.`)}
                        className="flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-sm font-bold text-gray-700 transition hover:border-brand-orange-300 hover:bg-brand-orange-50 hover:text-brand-orange-700 dark:border-gray-700 dark:text-gray-200 dark:hover:border-brand-neon-lime dark:hover:bg-brand-neon-lime/10 dark:hover:text-brand-neon-lime"
                    >
                        <span className="material-symbols-outlined text-lg">content_copy</span>
                        번호 복사
                    </button>
                    <button
                        type="button"
                        onClick={() =>
                            handleCopy(
                                formatApplicationCopySummary(app, preferredSlotLabel),
                                `${app.childName} 신청 요약을 복사했습니다.`,
                            )
                        }
                        className="flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-sm font-bold text-gray-700 transition hover:border-brand-orange-300 hover:bg-brand-orange-50 hover:text-brand-orange-700 dark:border-gray-700 dark:text-gray-200 dark:hover:border-brand-neon-lime dark:hover:bg-brand-neon-lime/10 dark:hover:text-brand-neon-lime"
                    >
                        <span className="material-symbols-outlined text-lg">assignment</span>
                        요약 복사
                    </button>
                </div>

                <div className="space-y-5">
                    <div>
                        <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2 flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm">child_care</span>
                            아이 정보
                        </h3>
                        <div className="space-y-1.5 bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
                            <InfoRow label="이름" value={app.childName} />
                            <InfoRow label="생년월일" value={formatDetailDate(app.childBirthDate)} />
                            <InfoRow label="성별" value={app.childGender} />
                            <InfoRow label="학년" value={app.childGrade} />
                            <InfoRow label="학교" value={app.childSchool} />
                            <InfoRow label="전화번호" value={app.childPhone} />
                        </div>
                    </div>

                    <div>
                        <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2 flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm">person</span>
                            보호자 정보
                        </h3>
                        <div className="space-y-1.5 bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
                            <InfoRow label="이름" value={app.parentName} />
                            <InfoRow label="연락처" value={app.parentPhone} />
                            <InfoRow label="관계" value={app.parentRelation} />
                            <InfoRow label="주소" value={app.address} />
                        </div>
                    </div>

                    <div>
                        <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2 flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm">sports_basketball</span>
                            수강 정보
                        </h3>
                        <div className="space-y-1.5 bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
                            <InfoRow label="수강 월" value={app.enrollmentMonths} />
                            <InfoRow label="희망 시간" value={preferredSlotLabel} />
                            <InfoRow label="농구 경험" value={app.basketballExp} />
                            <InfoRow label="유니폼" value={app.uniformSize} />
                            <InfoRow label="납부 방식" value={app.paymentMethod} />
                            <InfoRow label="셔틀" value={app.shuttleNeeded} />
                            <InfoRow label="탑승지" value={app.shuttlePickup} />
                            <InfoRow label="하차지" value={app.shuttleDropoff} />
                            <InfoRow label="셔틀 시간" value={app.shuttleTime} />
                            <InfoRow label="유입경로" value={app.referralSource ? (SOURCE_LABELS[app.referralSource] || app.referralSource) : null} />
                            <InfoRow label="확정 안내 확인" value={app.applicationNoticeConfirmed} />
                            <InfoRow label="셔틀 주의 확인" value={app.shuttleNoticeConfirmed} />
                        </div>
                    </div>

                    {app.memo && (
                        <div>
                            <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">보호자 메모</h3>
                            <p className="text-sm text-gray-700 dark:text-gray-200 bg-gray-50 dark:bg-gray-900 rounded-lg p-3">{app.memo}</p>
                        </div>
                    )}

                    {app.processedAt && (
                        <div>
                            <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">처리 정보</h3>
                            <div className="space-y-1.5 bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
                                <InfoRow label="처리일" value={formatDetailDate(app.processedAt)} />
                                <InfoRow label="처리메모" value={app.processedNote} />
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex justify-end mt-5">
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded-xl hover:bg-gray-200 transition font-medium text-sm"
                    >
                        닫기
                    </button>
                </div>
            </div>
        </div>
    );
}
