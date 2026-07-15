"use client";

import { useState, type FormEvent } from "react";
import { approveEnrollApplication, rejectEnrollApplication } from "@/app/actions/admin";

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
    classes: ClassInfo[];
    onCloseApprove: () => void;
    onCloseReject: () => void;
    onCloseDetail: () => void;
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

function formatDetailDate(dateStr: string | null) {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
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

export default function ApplyAdminModals({
    approveApp,
    rejectApp,
    detailApp,
    classes,
    onCloseApprove,
    onCloseReject,
    onCloseDetail,
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

            {detailApp && (
                <DetailModal
                    app={detailApp}
                    classes={classes}
                    onClose={onCloseDetail}
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
}: {
    app: EnrollApplication;
    classes: ClassInfo[];
    onClose: () => void;
}) {
    const cfg = STATUS_CONFIG[app.status] || STATUS_CONFIG.PENDING;
    const preferredSlotLabel = formatPreferredSlots(app.preferredSlotKeys, classes);

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
