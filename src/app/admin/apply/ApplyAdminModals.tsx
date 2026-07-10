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
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
    PENDING: { label: "대기중", color: "bg-yellow-100 text-yellow-800", icon: "hourglass_top" },
    APPROVED: { label: "승인완료", color: "bg-green-100 text-green-800", icon: "check_circle" },
    REJECTED: { label: "반려", color: "bg-red-100 text-red-800", icon: "cancel" },
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

export default function ApplyAdminModals({
    approveApp,
    rejectApp,
    detailApp,
    classes,
    onCloseApprove,
    onCloseReject,
    onCloseDetail,
    onSaved,
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
        } catch (error) {
            alert((error as Error).message);
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
        } catch (error) {
            alert((error as Error).message);
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
    const [selectedClassIds, setSelectedClassIds] = useState<string[]>(() => {
        return classes
            .filter((classInfo) => classInfo.slotKey && preferredKeys.includes(classInfo.slotKey))
            .map((classInfo) => classInfo.id);
    });
    const [note, setNote] = useState("");

    function toggleClass(classId: string) {
        setSelectedClassIds((prev) =>
            prev.includes(classId)
                ? prev.filter((id) => id !== classId)
                : [...prev, classId]
        );
    }

    function handleSubmit(event: FormEvent) {
        event.preventDefault();
        if (selectedClassIds.length === 0) {
            alert("최소 1개의 반을 선택해주세요.");
            return;
        }
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

                {app.preferredSlotKeys && (
                    <div className="bg-purple-50 text-purple-700 text-sm rounded-lg px-3 py-2 mb-4 flex items-center gap-2">
                        <span className="material-symbols-outlined text-base">info</span>
                        <span>희망 시간대: <span className="font-medium">{app.preferredSlotKeys}</span></span>
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
                                                            ? "border-green-500 bg-green-50 text-green-800"
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
    onClose,
}: {
    app: EnrollApplication;
    onClose: () => void;
}) {
    const cfg = STATUS_CONFIG[app.status] || STATUS_CONFIG.PENDING;

    function formatDate(dateStr: string | null) {
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
                            <InfoRow label="생년월일" value={formatDate(app.childBirthDate)} />
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
                            <InfoRow label="희망 시간" value={app.preferredSlotKeys} />
                            <InfoRow label="농구 경험" value={app.basketballExp} />
                            <InfoRow label="셔틀" value={app.shuttleNeeded} />
                            <InfoRow label="탑승지" value={app.shuttlePickup} />
                            <InfoRow label="하차지" value={app.shuttleDropoff} />
                            <InfoRow label="셔틀 시간" value={app.shuttleTime} />
                            <InfoRow label="유입경로" value={app.referralSource ? (SOURCE_LABELS[app.referralSource] || app.referralSource) : null} />
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
                                <InfoRow label="처리일" value={formatDate(app.processedAt)} />
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
