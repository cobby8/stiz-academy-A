"use client";

import { useState, useTransition, useEffect } from "react";
import { CalendarCheck, CreditCard, Image as ImageIcon, Bell, Paperclip, Check, CheckCheck, BellRing, BellOff, Send, MessageSquare, Clock, CheckCircle2, XCircle } from "lucide-react";
import Link from "next/link";
import { markNotificationRead, markAllNotificationsRead, createParentRequest } from "@/app/actions/admin";

const DAY_LABELS: Record<string, string> = {
    Mon: "월", Tue: "화", Wed: "수", Thu: "목", Fri: "금", Sat: "토", Sun: "일",
};

const PAYMENT_STATUS: Record<string, { label: string; color: string }> = {
    PENDING: { label: "미납", color: "text-yellow-600 bg-yellow-50" },
    PAID: { label: "납부완료", color: "text-green-600 bg-green-50" },
    OVERDUE: { label: "연체", color: "text-red-600 bg-red-50" },
    REFUNDED: { label: "환불", color: "text-gray-500 bg-gray-50" },
};

function toDateStr(d: Date | string | null): string {
    if (!d) return "-";
    const date = typeof d === "string" ? new Date(d) : d;
    return date.toISOString().split("T")[0];
}

function formatAmount(n: number): string {
    return n.toLocaleString("ko-KR") + "원";
}

type ChildData = {
    id: string;
    name: string;
    birthDate: Date | string;
    gender: string | null;
    enrollments: {
        id: string;
        classId: string;
        className: string;
        dayOfWeek: string;
        startTime: string;
        endTime: string;
        programName: string;
    }[];
    attendance: {
        total: number;
        present: number;
        absent: number;
        late: number;
        records: { status: string; date: Date | string }[];
    };
    payments: {
        id: string;
        amount: number;
        status: string;
        dueDate: Date | string;
        paidDate: Date | string | null;
    }[];
};

type GalleryItem = {
    id: string;
    title: string | null;
    caption: string | null;
    mediaJSON: string;
    createdAt: Date | string;
    className: string | null;
};

type NoticeItem = {
    id: string;
    title: string;
    content: string;
    targetType: string;
    isPinned: boolean;
    createdAt: Date | string;
    attachmentsJSON: string | null;
};

type NotificationItem = {
    id: string;
    userId: string;
    type: string;
    title: string;
    message: string;
    linkUrl: string | null;
    isRead: boolean;
    createdAt: Date | string;
};

type RequestItem = {
    id: string;
    userId: string;
    studentId: string;
    type: string;
    title: string;
    content: string;
    date: Date | string | null;
    status: string;
    adminNote: string | null;
    createdAt: Date | string;
    updatedAt: Date | string;
    studentName: string;
};

type MyPageData = {
    parent: { id: string; name: string; email: string; phone: string | null };
    children: ChildData[];
};

const REQUEST_TYPES = [
    { value: "ABSENCE", label: "결석 신청" },
    { value: "SHUTTLE", label: "셔틀 변경" },
    { value: "EARLY_LEAVE", label: "조퇴 요청" },
    { value: "OTHER", label: "기타 요청" },
];

const REQUEST_STATUS: Record<string, { label: string; color: string; icon: typeof Clock }> = {
    PENDING: { label: "대기중", color: "bg-yellow-100 text-yellow-700", icon: Clock },
    CONFIRMED: { label: "확인됨", color: "bg-blue-100 text-blue-700", icon: CheckCircle2 },
    COMPLETED: { label: "처리완료", color: "bg-green-100 text-green-700", icon: CheckCircle2 },
    REJECTED: { label: "반려", color: "bg-red-100 text-red-700", icon: XCircle },
};

export default function MyPageClient({ data, gallery = [], notices = [], notifications = [], unreadCount = 0, myRequests = [] }: {
    data: MyPageData;
    gallery?: GalleryItem[];
    notices?: NoticeItem[];
    notifications?: NotificationItem[];
    unreadCount?: number;
    myRequests?: RequestItem[];
}) {
    const [selectedIdx, setSelectedIdx] = useState(0);
    const [showNotifications, setShowNotifications] = useState(false);
    const [showRequestForm, setShowRequestForm] = useState(false);
    const [showRequests, setShowRequests] = useState(false);
    const [isPending, startTransition] = useTransition();
    // 요청 폼 상태
    const [reqType, setReqType] = useState("ABSENCE");
    const [reqContent, setReqContent] = useState("");
    const [reqDate, setReqDate] = useState("");
    // 푸시 알림 상태
    const [pushSupported, setPushSupported] = useState(false);
    const [pushEnabled, setPushEnabled] = useState(false);
    const [pushLoading, setPushLoading] = useState(false);

    // 브라우저 푸시 지원 여부 및 현재 구독 상태 확인
    useEffect(() => {
        if ("serviceWorker" in navigator && "PushManager" in window) {
            setPushSupported(true);
            navigator.serviceWorker.ready.then(reg => {
                reg.pushManager.getSubscription().then(sub => {
                    setPushEnabled(!!sub);
                });
            });
            // Service Worker 등록
            navigator.serviceWorker.register("/sw.js").catch(() => {});
        }
    }, []);

    // 푸시 알림 구독/해제 토글
    async function togglePush() {
        setPushLoading(true);
        try {
            const reg = await navigator.serviceWorker.ready;
            const existing = await reg.pushManager.getSubscription();

            if (existing) {
                // 구독 해제
                await existing.unsubscribe();
                await fetch("/api/push", {
                    method: "DELETE",
                    body: JSON.stringify({ endpoint: existing.endpoint }),
                });
                setPushEnabled(false);
            } else {
                // 구독 등록
                const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
                if (!vapidKey) throw new Error("VAPID 키 없음");
                const sub = await reg.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
                });
                await fetch("/api/push", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ subscription: sub.toJSON() }),
                });
                setPushEnabled(true);
            }
        } catch (e) {
            console.error("Push toggle error:", e);
            alert("알림 설정에 실패했습니다. 브라우저 알림 권한을 확인해주세요.");
        }
        setPushLoading(false);
    }
    const child = data.children[selectedIdx];

    const enrollSummary = child.enrollments
        .map((e) => `${e.className} (${DAY_LABELS[e.dayOfWeek] || e.dayOfWeek} ${e.startTime}~${e.endTime})`)
        .join(", ");

    const pendingPayments = child.payments.filter((p) => p.status === "PENDING" || p.status === "OVERDUE");

    return (
        <div className="space-y-6">
            {/* Student Card */}
            <div className="bg-brand-navy-900 text-white rounded-2xl p-6 shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-5 mix-blend-overlay rounded-full -mr-10 -mt-10 blur-xl"></div>
                <div className="relative z-10">
                    <div className="flex justify-between items-center mb-4">
                        <h1 className="text-2xl font-bold">
                            {child.name} <span className="text-brand-orange-500 text-lg font-medium">학생</span>
                        </h1>
                        {data.children.length > 1 && (
                            <select
                                value={selectedIdx}
                                onChange={(e) => setSelectedIdx(Number(e.target.value))}
                                className="bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-full text-xs font-bold transition text-white border-none"
                            >
                                {data.children.map((c, i) => (
                                    <option key={c.id} value={i} className="text-gray-900">{c.name}</option>
                                ))}
                            </select>
                        )}
                    </div>
                    <p className="text-gray-300 text-sm mb-6">
                        {enrollSummary || "수강 중인 반이 없습니다"}
                    </p>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white/10 rounded-xl p-3 backdrop-blur-sm border border-white/5">
                            <div className="text-white/60 text-xs font-medium mb-1">이번 달 출석</div>
                            <div className="text-xl font-bold">
                                {child.attendance.present}
                                <span className="text-sm font-normal text-white/60"> / {child.attendance.total}회</span>
                            </div>
                        </div>
                        <div className="bg-white/10 rounded-xl p-3 backdrop-blur-sm border border-white/5">
                            <div className="text-white/60 text-xs font-medium mb-1">결석/지각</div>
                            <div className="text-xl font-bold">
                                {child.attendance.absent > 0 ? (
                                    <span className="text-red-400">{child.attendance.absent}</span>
                                ) : (
                                    <span className="text-green-400">0</span>
                                )}
                                {child.attendance.late > 0 && (
                                    <span className="text-yellow-400 text-sm ml-1">지각 {child.attendance.late}</span>
                                )}
                                {child.attendance.absent === 0 && child.attendance.late === 0 && (
                                    <span className="text-sm font-normal text-white/60"> 없음</span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 알림 토글 버튼 */}
            <div>
                <button
                    onClick={() => setShowNotifications(!showNotifications)}
                    className="w-full flex items-center justify-between bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition"
                >
                    <div className="flex items-center gap-3">
                        <div className="bg-brand-orange-50 p-2 rounded-full">
                            <Bell className="w-5 h-5 text-brand-orange-500" />
                        </div>
                        <span className="font-bold text-gray-900">알림</span>
                        {unreadCount > 0 && (
                            <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center">
                                {unreadCount}
                            </span>
                        )}
                    </div>
                    <span className="text-gray-400 text-sm">{showNotifications ? "접기" : "펼치기"}</span>
                </button>

                {showNotifications && (
                    <div className="mt-2 bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                        {/* 상단 바: 푸시 설정 + 전체 읽음 */}
                        <div className="px-4 py-2 border-b border-gray-50 flex items-center justify-between">
                            {/* 푸시 알림 토글 */}
                            {pushSupported && (
                                <button
                                    onClick={togglePush}
                                    disabled={pushLoading}
                                    className={`text-xs flex items-center gap-1 px-2.5 py-1 rounded-full transition ${
                                        pushEnabled
                                            ? "bg-green-100 text-green-700"
                                            : "bg-gray-100 text-gray-500 hover:bg-orange-50 hover:text-brand-orange-500"
                                    }`}
                                >
                                    {pushLoading ? "..." : pushEnabled ? (
                                        <><BellRing size={13} /> 푸시 ON</>
                                    ) : (
                                        <><BellOff size={13} /> 푸시 OFF</>
                                    )}
                                </button>
                            )}
                            {!pushSupported && <span />}
                            {unreadCount > 0 && (
                                <button
                                    onClick={() => startTransition(() => markAllNotificationsRead(data.parent.id))}
                                    disabled={isPending}
                                    className="text-xs text-brand-orange-500 hover:underline flex items-center gap-1"
                                >
                                    <CheckCheck size={14} /> 모두 읽음
                                </button>
                            )}
                        </div>

                        {notifications.length === 0 ? (
                            <div className="p-8 text-center text-gray-400 text-sm">
                                알림이 없습니다
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-50 max-h-80 overflow-y-auto">
                                {notifications.map(n => (
                                    <div
                                        key={n.id}
                                        className={`px-4 py-3 flex items-start gap-3 ${!n.isRead ? "bg-orange-50/50" : ""}`}
                                    >
                                        {/* 알림 타입 아이콘 */}
                                        <div className={`mt-0.5 p-1.5 rounded-full flex-shrink-0 ${
                                            n.type === "ATTENDANCE" ? "bg-green-100 text-green-600" :
                                            n.type === "PAYMENT" ? "bg-red-100 text-red-600" :
                                            "bg-blue-100 text-blue-600"
                                        }`}>
                                            {n.type === "ATTENDANCE" ? <CalendarCheck size={14} /> :
                                             n.type === "PAYMENT" ? <CreditCard size={14} /> :
                                             <Bell size={14} />}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <p className={`text-sm ${!n.isRead ? "font-bold text-gray-900" : "text-gray-700"}`}>
                                                {n.title}
                                            </p>
                                            <p className="text-xs text-gray-500 mt-0.5">{n.message}</p>
                                            <p className="text-xs text-gray-400 mt-1">
                                                {new Date(n.createdAt).toLocaleDateString("ko-KR", {
                                                    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
                                                })}
                                            </p>
                                        </div>

                                        {/* 읽음 처리 버튼 */}
                                        {!n.isRead && (
                                            <button
                                                onClick={() => startTransition(() => markNotificationRead(n.id))}
                                                disabled={isPending}
                                                className="text-gray-400 hover:text-brand-orange-500 p-1 flex-shrink-0"
                                                title="읽음 처리"
                                            >
                                                <Check size={14} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* 학원에 요청하기 */}
            <div>
                <div className="flex gap-2">
                    <button
                        onClick={() => { setShowRequestForm(!showRequestForm); setShowRequests(false); }}
                        className="flex-1 flex items-center justify-center gap-2 bg-brand-orange-500 text-white font-bold py-3 rounded-2xl hover:bg-orange-600 transition shadow-sm"
                    >
                        <Send size={16} /> 학원에 요청하기
                    </button>
                    <button
                        onClick={() => { setShowRequests(!showRequests); setShowRequestForm(false); }}
                        className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 font-bold px-4 py-3 rounded-2xl hover:bg-gray-50 transition shadow-sm"
                    >
                        <MessageSquare size={16} />
                        내 요청
                        {myRequests.filter(r => r.status === "PENDING").length > 0 && (
                            <span className="bg-yellow-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
                                {myRequests.filter(r => r.status === "PENDING").length}
                            </span>
                        )}
                    </button>
                </div>

                {/* 요청 접수 폼 */}
                {showRequestForm && (
                    <div className="mt-3 bg-white border border-gray-100 rounded-2xl p-5 shadow-sm space-y-4">
                        <h3 className="font-bold text-gray-900">요청 접수</h3>

                        {/* 요청 유형 */}
                        <div className="grid grid-cols-2 gap-2">
                            {REQUEST_TYPES.map(t => (
                                <button key={t.value}
                                    onClick={() => setReqType(t.value)}
                                    className={`py-2 px-3 rounded-xl text-sm font-bold border transition ${
                                        reqType === t.value
                                            ? "bg-brand-orange-500 text-white border-brand-orange-500"
                                            : "bg-gray-50 text-gray-700 border-gray-200 hover:border-brand-orange-300"
                                    }`}
                                >
                                    {t.label}
                                </button>
                            ))}
                        </div>

                        {/* 자녀 선택 (여러 명일 때) */}
                        {data.children.length > 1 && (
                            <div>
                                <label className="text-xs font-medium text-gray-500 mb-1 block">자녀 선택</label>
                                <select
                                    value={selectedIdx}
                                    onChange={e => setSelectedIdx(Number(e.target.value))}
                                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
                                >
                                    {data.children.map((c, i) => (
                                        <option key={c.id} value={i}>{c.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {/* 날짜 */}
                        <div>
                            <label className="text-xs font-medium text-gray-500 mb-1 block">
                                {reqType === "ABSENCE" ? "결석일" : reqType === "EARLY_LEAVE" ? "조퇴일" : "해당 날짜"} (선택)
                            </label>
                            <input type="date" value={reqDate} onChange={e => setReqDate(e.target.value)}
                                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" />
                        </div>

                        {/* 내용 */}
                        <div>
                            <label className="text-xs font-medium text-gray-500 mb-1 block">상세 내용</label>
                            <textarea
                                value={reqContent}
                                onChange={e => setReqContent(e.target.value)}
                                placeholder={
                                    reqType === "ABSENCE" ? "결석 사유를 입력해주세요" :
                                    reqType === "SHUTTLE" ? "변경 희망 내용을 입력해주세요 (예: 3/25부터 A노선 → B노선)" :
                                    reqType === "EARLY_LEAVE" ? "조퇴 사유와 픽업 시간을 입력해주세요" :
                                    "요청 내용을 입력해주세요"
                                }
                                rows={3}
                                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none"
                            />
                        </div>

                        {/* 제출 */}
                        <button
                            disabled={isPending || !reqContent.trim()}
                            onClick={() => {
                                const typeLabel = REQUEST_TYPES.find(t => t.value === reqType)?.label || reqType;
                                const dateLabel = reqDate ? ` (${reqDate})` : "";
                                startTransition(async () => {
                                    await createParentRequest({
                                        userId: data.parent.id,
                                        studentId: child.id,
                                        type: reqType,
                                        title: `${child.name} ${typeLabel}${dateLabel}`,
                                        content: reqContent,
                                        date: reqDate || null,
                                    });
                                    setReqContent("");
                                    setReqDate("");
                                    setShowRequestForm(false);
                                });
                            }}
                            className="w-full bg-brand-orange-500 text-white font-bold py-3 rounded-xl hover:bg-orange-600 transition disabled:opacity-50"
                        >
                            {isPending ? "접수 중..." : "요청 접수하기"}
                        </button>
                    </div>
                )}

                {/* 내 요청 내역 */}
                {showRequests && (
                    <div className="mt-3 bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                        {myRequests.length === 0 ? (
                            <div className="p-8 text-center text-gray-400 text-sm">요청 내역이 없습니다</div>
                        ) : (
                            <div className="divide-y divide-gray-50 max-h-96 overflow-y-auto">
                                {myRequests.map(r => {
                                    const st = REQUEST_STATUS[r.status] || REQUEST_STATUS.PENDING;
                                    const StatusIcon = st.icon;
                                    return (
                                        <div key={r.id} className="px-4 py-3">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-sm font-bold text-gray-900">{r.title}</span>
                                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${st.color}`}>
                                                    <StatusIcon size={12} /> {st.label}
                                                </span>
                                            </div>
                                            <p className="text-xs text-gray-500 line-clamp-2">{r.content}</p>
                                            {r.adminNote && (
                                                <div className="mt-2 bg-blue-50 rounded-lg px-3 py-2">
                                                    <p className="text-xs text-blue-700">
                                                        <span className="font-bold">학원 답변:</span> {r.adminNote}
                                                    </p>
                                                </div>
                                            )}
                                            <p className="text-xs text-gray-400 mt-1">
                                                {new Date(r.createdAt).toLocaleDateString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                                            </p>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Payment Alert */}
            {pendingPayments.length > 0 && (
                <div className="space-y-3">
                    {pendingPayments.map((p) => (
                        <div key={p.id} className="bg-red-50 border border-red-100 rounded-2xl p-4 flex items-center justify-between shadow-sm">
                            <div className="flex items-center gap-3 text-red-700">
                                <div className="bg-white p-2 rounded-full shadow-sm text-red-500">
                                    <CreditCard className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="font-bold text-sm">{formatAmount(p.amount)} {p.status === "OVERDUE" ? "연체" : "미납"}</p>
                                    <p className="text-xs text-red-600 opacity-80 mt-0.5">
                                        납부 기한: {toDateStr(p.dueDate)}
                                    </p>
                                </div>
                            </div>
                            <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${PAYMENT_STATUS[p.status]?.color || ""}`}>
                                {PAYMENT_STATUS[p.status]?.label || p.status}
                            </span>
                        </div>
                    ))}
                </div>
            )}

            {/* Enrollment Info */}
            {child.enrollments.length > 0 && (
                <div>
                    <h2 className="font-bold text-gray-900 mb-3 px-1">수강 중인 반</h2>
                    <div className="space-y-2">
                        {child.enrollments.map((e) => (
                            <div key={e.id} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="font-bold text-gray-900">{e.className}</p>
                                        <p className="text-xs text-gray-500 mt-0.5">{e.programName}</p>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-sm font-bold text-brand-orange-500">
                                            {DAY_LABELS[e.dayOfWeek] || e.dayOfWeek}요일
                                        </span>
                                        <p className="text-xs text-gray-400">{e.startTime} ~ {e.endTime}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Attendance History */}
            {child.attendance.records.length > 0 && (
                <div>
                    <h2 className="font-bold text-gray-900 mb-3 px-1">이번 달 출결 기록</h2>
                    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                        <div className="divide-y divide-gray-50">
                            {child.attendance.records.map((r, i) => (
                                <div key={i} className="flex items-center justify-between px-4 py-3">
                                    <span className="text-sm text-gray-700">{toDateStr(r.date)}</span>
                                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                                        r.status === "PRESENT" ? "bg-green-100 text-green-700" :
                                        r.status === "ABSENT" ? "bg-red-100 text-red-700" :
                                        "bg-yellow-100 text-yellow-700"
                                    }`}>
                                        {r.status === "PRESENT" ? "출석" : r.status === "ABSENT" ? "결석" : "지각"}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Payment History */}
            {child.payments.length > 0 && (
                <div>
                    <h2 className="font-bold text-gray-900 mb-3 px-1">최근 수납 내역</h2>
                    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                        <div className="divide-y divide-gray-50">
                            {child.payments.map((p) => {
                                const statusInfo = PAYMENT_STATUS[p.status] || PAYMENT_STATUS.PENDING;
                                return (
                                    <div key={p.id} className="flex items-center justify-between px-4 py-3">
                                        <div>
                                            <p className="text-sm font-medium text-gray-900">{formatAmount(p.amount)}</p>
                                            <p className="text-xs text-gray-400">기한: {toDateStr(p.dueDate)}</p>
                                        </div>
                                        <div className="text-right">
                                            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${statusInfo.color}`}>
                                                {statusInfo.label}
                                            </span>
                                            {p.paidDate && (
                                                <p className="text-xs text-gray-400 mt-1">{toDateStr(p.paidDate)} 납부</p>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* No data state */}
            {child.enrollments.length === 0 && child.payments.length === 0 && child.attendance.total === 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-gray-400 shadow-sm">
                    <CalendarCheck className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p className="font-medium">아직 수강/출결/수납 데이터가 없습니다.</p>
                    <p className="text-sm mt-1">학원에서 반 배정 후 데이터가 표시됩니다.</p>
                </div>
            )}

            {/* 공지사항 섹션 */}
            {notices.length > 0 && (
                <div>
                    <div className="flex items-center justify-between mb-3 px-1">
                        <h2 className="font-bold text-gray-900 flex items-center gap-2">
                            <Bell size={18} className="text-brand-orange-500" /> 공지사항
                        </h2>
                        <Link href="/notices" className="text-xs text-brand-orange-500 hover:underline">전체보기</Link>
                    </div>
                    <div className="space-y-2">
                        {notices.slice(0, 5).map(n => (
                            <Link key={n.id} href={`/notices/${n.id}`}
                                className="block bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition">
                                <div className="flex items-center justify-between">
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-sm text-gray-900 truncate">{n.title}</p>
                                        <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{n.content}</p>
                                    </div>
                                    <span className="text-xs text-gray-400 flex-shrink-0 ml-3">
                                        {new Date(n.createdAt).toLocaleDateString("ko-KR")}
                                    </span>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            )}

            {/* 갤러리 섹션 */}
            {gallery.length > 0 && (
                <div>
                    <div className="flex items-center justify-between mb-3 px-1">
                        <h2 className="font-bold text-gray-900 flex items-center gap-2">
                            <ImageIcon size={18} className="text-brand-orange-500" /> 수업 사진
                        </h2>
                        <Link href="/gallery" className="text-xs text-brand-orange-500 hover:underline">전체보기</Link>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        {gallery.slice(0, 6).map(g => {
                            let media: { url: string; type: string }[] = [];
                            try { media = JSON.parse(g.mediaJSON); } catch {}
                            const first = media[0];
                            if (!first) return null;
                            return (
                                <Link key={g.id} href="/gallery"
                                    className="aspect-square rounded-xl overflow-hidden bg-gray-100 relative group">
                                    {first.type === "image" ? (
                                        <img src={first.url} alt={g.title || ""} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                                    ) : (
                                        <video src={first.url} className="w-full h-full object-cover" muted />
                                    )}
                                </Link>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

// VAPID 공개키를 Uint8Array로 변환 (Web Push API에 필요)
function urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}
