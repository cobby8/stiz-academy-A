"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, Save, CalendarCheck, CreditCard, Image as ImageIcon, User, BookOpen } from "lucide-react";
import { updateStudentMemo } from "@/app/actions/admin";

type MediaItem = { url: string; type: "image" | "video" };

const DAY_LABELS: Record<string, string> = {
    Mon: "월", Tue: "화", Wed: "수", Thu: "목", Fri: "금", Sat: "토", Sun: "일",
};
const ATT_STATUS: Record<string, { label: string; color: string }> = {
    PRESENT: { label: "출석", color: "bg-green-100 text-green-700" },
    ABSENT: { label: "결석", color: "bg-red-100 text-red-700" },
    LATE: { label: "지각", color: "bg-yellow-100 text-yellow-700" },
    EXCUSED: { label: "사유결석", color: "bg-blue-100 text-blue-700" },
};
const PAY_STATUS: Record<string, { label: string; color: string }> = {
    PENDING: { label: "미납", color: "text-yellow-600 bg-yellow-50" },
    PAID: { label: "납부완료", color: "text-green-600 bg-green-50" },
    OVERDUE: { label: "연체", color: "text-red-600 bg-red-50" },
};

function toDateStr(d: Date | string | null): string {
    if (!d) return "-";
    const date = typeof d === "string" ? new Date(d) : d;
    return date.toISOString().split("T")[0];
}
function calcAge(birthDate: Date | string): number {
    const birth = typeof birthDate === "string" ? new Date(birthDate) : birthDate;
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
}
function formatKRW(n: number): string {
    return n.toLocaleString("ko-KR") + "원";
}

type StudentActivityData = {
    student: {
        id: string; name: string; birthDate: Date | string; gender: string | null;
        memo: string | null; parentId: string; createdAt: Date | string;
        parent: { name: string | null; phone: string | null; email: string | null };
    };
    enrollments: {
        id: string; classId: string; status: string; createdAt: Date | string;
        className: string; dayOfWeek: string; startTime: string; endTime: string; programName: string;
    }[];
    attendances: { id: string; status: string; date: Date | string; className: string }[];
    payments: { id: string; amount: number; status: string; dueDate: Date | string; paidDate: Date | string | null }[];
    attendanceStats: { total: number; present: number; absent: number; late: number; excused: number; rate: number };
    galleryPosts: { id: string; title: string | null; mediaJSON: string; createdAt: Date | string }[];
};

export default function StudentDetailClient({ data }: { data: StudentActivityData }) {
    const { student, enrollments, attendances, payments, attendanceStats, galleryPosts } = data;
    const [memo, setMemo] = useState(student.memo || "");
    const [isPending, startTransition] = useTransition();
    const [memoSaved, setMemoSaved] = useState(false);

    function saveMemo() {
        startTransition(async () => {
            await updateStudentMemo(student.id, memo);
            setMemoSaved(true);
            setTimeout(() => setMemoSaved(false), 2000);
        });
    }

    const activeEnrollments = enrollments.filter(e => e.status === "ACTIVE");
    const totalPaid = payments.filter(p => p.status === "PAID").reduce((s, p) => s + p.amount, 0);
    const unpaid = payments.filter(p => p.status === "PENDING" || p.status === "OVERDUE");

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link href="/admin/students" className="p-2 hover:bg-gray-100 rounded-lg transition">
                    <ArrowLeft size={20} className="text-gray-500" />
                </Link>
                <div>
                    <h1 className="text-2xl font-extrabold text-gray-900">{student.name} <span className="text-gray-400 font-normal text-lg">학생</span></h1>
                    <p className="text-sm text-gray-500">
                        {calcAge(student.birthDate)}세 ({toDateStr(student.birthDate)})
                        {student.gender && ` · ${student.gender}`}
                        {" · "}등록일 {toDateStr(student.createdAt)}
                    </p>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                    <p className="text-xs text-gray-500 mb-1">출석률</p>
                    <p className="text-2xl font-extrabold text-gray-900">{attendanceStats.rate}%</p>
                    <p className="text-xs text-gray-400">{attendanceStats.present}/{attendanceStats.total}회 출석</p>
                </div>
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                    <p className="text-xs text-gray-500 mb-1">결석/지각</p>
                    <p className="text-2xl font-extrabold">
                        <span className={attendanceStats.absent > 0 ? "text-red-600" : "text-gray-900"}>{attendanceStats.absent}</span>
                        <span className="text-gray-300 mx-1">/</span>
                        <span className={attendanceStats.late > 0 ? "text-yellow-600" : "text-gray-900"}>{attendanceStats.late}</span>
                    </p>
                    <p className="text-xs text-gray-400">결석 / 지각</p>
                </div>
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                    <p className="text-xs text-gray-500 mb-1">수강 중</p>
                    <p className="text-2xl font-extrabold text-gray-900">{activeEnrollments.length}개</p>
                    <p className="text-xs text-gray-400">반</p>
                </div>
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                    <p className="text-xs text-gray-500 mb-1">총 납부액</p>
                    <p className="text-2xl font-extrabold text-gray-900">{formatKRW(totalPaid)}</p>
                    {unpaid.length > 0 && <p className="text-xs text-red-500">미납 {unpaid.length}건</p>}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column: 학부모 정보 + 메모 */}
                <div className="space-y-4">
                    {/* 학부모 정보 */}
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                        <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                            <User size={16} className="text-gray-400" /> 학부모 정보
                        </h3>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-500">이름</span>
                                <span className="font-medium">{student.parent.name || "-"}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">연락처</span>
                                <span className="font-medium">{student.parent.phone || "-"}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">이메일</span>
                                <span className="font-medium text-xs">{student.parent.email || "-"}</span>
                            </div>
                        </div>
                    </div>

                    {/* 메모 */}
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                        <h3 className="font-bold text-gray-900 mb-3">메모</h3>
                        <textarea
                            value={memo}
                            onChange={e => { setMemo(e.target.value); setMemoSaved(false); }}
                            rows={4}
                            placeholder="원생에 대한 메모를 입력하세요 (특이사항, 건강 이슈 등)"
                            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:ring-2 focus:ring-brand-orange-500"
                        />
                        <div className="flex items-center justify-between mt-2">
                            {memoSaved && <span className="text-xs text-green-600 font-medium">저장됨</span>}
                            {!memoSaved && <span />}
                            <button onClick={saveMemo} disabled={isPending}
                                className="flex items-center gap-1 text-sm bg-brand-orange-500 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-orange-600 transition disabled:opacity-50">
                                <Save size={14} /> {isPending ? "저장 중..." : "저장"}
                            </button>
                        </div>
                    </div>

                    {/* 수강 반 */}
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                        <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                            <BookOpen size={16} className="text-gray-400" /> 수강 중인 반
                        </h3>
                        {activeEnrollments.length === 0 ? (
                            <p className="text-sm text-gray-400">수강 중인 반이 없습니다</p>
                        ) : (
                            <div className="space-y-2">
                                {activeEnrollments.map(e => (
                                    <div key={e.id} className="bg-gray-50 rounded-xl p-3">
                                        <p className="font-bold text-sm text-gray-900">{e.className}</p>
                                        <p className="text-xs text-gray-500">
                                            {e.programName} · {DAY_LABELS[e.dayOfWeek] || e.dayOfWeek} {e.startTime}~{e.endTime}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Column: 활동 이력 */}
                <div className="lg:col-span-2 space-y-4">
                    {/* 출결 기록 */}
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                        <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                            <CalendarCheck size={16} className="text-gray-400" /> 출결 기록
                            <span className="text-xs text-gray-400 font-normal ml-1">최근 50건</span>
                        </h3>
                        {attendances.length === 0 ? (
                            <p className="text-sm text-gray-400">출결 기록이 없습니다</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-gray-100">
                                            <th className="text-left py-2 px-3 text-xs text-gray-500 font-medium">날짜</th>
                                            <th className="text-left py-2 px-3 text-xs text-gray-500 font-medium">반</th>
                                            <th className="text-left py-2 px-3 text-xs text-gray-500 font-medium">상태</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {attendances.map(a => {
                                            const info = ATT_STATUS[a.status] || ATT_STATUS.PRESENT;
                                            return (
                                                <tr key={a.id} className="border-b border-gray-50 hover:bg-gray-50">
                                                    <td className="py-2 px-3 text-gray-700">{toDateStr(a.date)}</td>
                                                    <td className="py-2 px-3 text-gray-600">{a.className}</td>
                                                    <td className="py-2 px-3">
                                                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${info.color}`}>{info.label}</span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* 수납 내역 */}
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                        <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                            <CreditCard size={16} className="text-gray-400" /> 수납 내역
                        </h3>
                        {payments.length === 0 ? (
                            <p className="text-sm text-gray-400">수납 내역이 없습니다</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-gray-100">
                                            <th className="text-left py-2 px-3 text-xs text-gray-500 font-medium">납부기한</th>
                                            <th className="text-left py-2 px-3 text-xs text-gray-500 font-medium">금액</th>
                                            <th className="text-left py-2 px-3 text-xs text-gray-500 font-medium">상태</th>
                                            <th className="text-left py-2 px-3 text-xs text-gray-500 font-medium">납부일</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {payments.map(p => {
                                            const info = PAY_STATUS[p.status] || PAY_STATUS.PENDING;
                                            return (
                                                <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50">
                                                    <td className="py-2 px-3 text-gray-700">{toDateStr(p.dueDate)}</td>
                                                    <td className="py-2 px-3 font-medium text-gray-900">{formatKRW(p.amount)}</td>
                                                    <td className="py-2 px-3">
                                                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${info.color}`}>{info.label}</span>
                                                    </td>
                                                    <td className="py-2 px-3 text-gray-500">{toDateStr(p.paidDate)}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* 수업 사진 */}
                    {galleryPosts.length > 0 && (
                        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                            <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                                <ImageIcon size={16} className="text-gray-400" /> 수업 사진
                            </h3>
                            <div className="grid grid-cols-3 gap-2">
                                {galleryPosts.map(g => {
                                    let media: MediaItem[] = [];
                                    try { media = JSON.parse(g.mediaJSON); } catch {}
                                    const first = media[0];
                                    if (!first) return null;
                                    return (
                                        <div key={g.id} className="aspect-square rounded-xl overflow-hidden bg-gray-100">
                                            {first.type === "image" ? (
                                                <img src={first.url} alt={g.title || ""} className="w-full h-full object-cover" />
                                            ) : (
                                                <video src={first.url} className="w-full h-full object-cover" muted />
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
