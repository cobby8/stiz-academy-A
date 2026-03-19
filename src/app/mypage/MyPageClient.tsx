"use client";

import { useState } from "react";
import { CalendarCheck, CreditCard } from "lucide-react";

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

type MyPageData = {
    parent: { id: string; name: string; email: string; phone: string | null };
    children: ChildData[];
};

export default function MyPageClient({ data }: { data: MyPageData }) {
    const [selectedIdx, setSelectedIdx] = useState(0);
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
        </div>
    );
}
