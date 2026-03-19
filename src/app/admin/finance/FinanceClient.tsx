"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createPayment, updatePaymentStatus, deletePayment } from "@/app/actions/admin";

type Payment = {
    id: string;
    studentId: string;
    studentName: string;
    amount: number;
    status: string;
    dueDate: Date | string;
    paidDate: Date | string | null;
    createdAt: Date | string;
};

type Student = {
    id: string;
    name: string;
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
    PENDING: { label: "미납", color: "bg-yellow-100 text-yellow-700" },
    PAID: { label: "납부완료", color: "bg-green-100 text-green-700" },
    OVERDUE: { label: "연체", color: "bg-red-100 text-red-700" },
    REFUNDED: { label: "환불", color: "bg-gray-100 text-gray-600" },
};

function toDateStr(d: Date | string | null): string {
    if (!d) return "-";
    const date = typeof d === "string" ? new Date(d) : d;
    return date.toISOString().split("T")[0];
}

function formatAmount(n: number): string {
    return n.toLocaleString("ko-KR") + "원";
}

export default function FinanceClient({
    initialPayments,
    students,
    initialYear,
    initialMonth,
}: {
    initialPayments: Payment[];
    students: Student[];
    initialYear: number;
    initialMonth: number;
}) {
    const router = useRouter();
    const [payments, setPayments] = useState(initialPayments);
    const [year, setYear] = useState(initialYear);
    const [month, setMonth] = useState(initialMonth);
    const [showForm, setShowForm] = useState(false);
    const [busy, setBusy] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

    // Form state
    const [studentId, setStudentId] = useState("");
    const [amount, setAmount] = useState(0);
    const [dueDate, setDueDate] = useState("");
    const [status, setStatus] = useState("PENDING");

    async function loadMonth(y: number, m: number) {
        setYear(y);
        setMonth(m);
        try {
            const res = await fetch(`/api/admin/finance?year=${y}&month=${m}`);
            if (res.ok) {
                const data = await res.json();
                setPayments(data);
            }
        } catch {}
    }

    function prevMonth() {
        const m = month === 1 ? 12 : month - 1;
        const y = month === 1 ? year - 1 : year;
        loadMonth(y, m);
    }

    function nextMonth() {
        const m = month === 12 ? 1 : month + 1;
        const y = month === 12 ? year + 1 : year;
        loadMonth(y, m);
    }

    async function handleCreate(e: React.FormEvent) {
        e.preventDefault();
        if (!studentId || !amount || !dueDate) return;
        setBusy(true);
        try {
            await createPayment({ studentId, amount, dueDate, status });
            setShowForm(false);
            setStudentId("");
            setAmount(0);
            setDueDate("");
            setStatus("PENDING");
            router.refresh();
            loadMonth(year, month);
        } catch (err: any) {
            alert(err.message || "생성 실패");
        } finally {
            setBusy(false);
        }
    }

    async function handleStatusChange(id: string, newStatus: string) {
        setBusy(true);
        try {
            await updatePaymentStatus(id, newStatus);
            router.refresh();
            loadMonth(year, month);
        } catch (err: any) {
            alert(err.message || "상태 변경 실패");
        } finally {
            setBusy(false);
        }
    }

    async function handleDelete(id: string) {
        setBusy(true);
        try {
            await deletePayment(id);
            setDeleteConfirm(null);
            router.refresh();
            loadMonth(year, month);
        } catch (err: any) {
            alert(err.message || "삭제 실패");
        } finally {
            setBusy(false);
        }
    }

    const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);
    const paidAmount = payments.filter((p) => p.status === "PAID").reduce((sum, p) => sum + p.amount, 0);
    const pendingAmount = payments.filter((p) => p.status === "PENDING" || p.status === "OVERDUE").reduce((sum, p) => sum + p.amount, 0);

    return (
        <div className="max-w-5xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-extrabold text-gray-900">수납/결제 관리</h1>
                    <p className="text-gray-500 text-sm mt-1">원생별 수납 현황을 관리합니다.</p>
                </div>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="bg-brand-orange-500 text-white px-4 py-2 rounded-lg font-bold hover:bg-orange-600 transition"
                >
                    + 수납 기록 추가
                </button>
            </div>

            {/* Month navigation */}
            <div className="flex items-center gap-4 mb-6">
                <button onClick={prevMonth} className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 font-bold">&larr;</button>
                <span className="text-lg font-bold text-gray-900">{year}년 {month}월</span>
                <button onClick={nextMonth} className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 font-bold">&rarr;</button>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                    <p className="text-xs text-gray-500 font-medium">총 청구액</p>
                    <p className="text-xl font-extrabold text-gray-900 mt-1">{formatAmount(totalAmount)}</p>
                </div>
                <div className="bg-white border border-green-200 rounded-xl p-4">
                    <p className="text-xs text-green-600 font-medium">납부완료</p>
                    <p className="text-xl font-extrabold text-green-700 mt-1">{formatAmount(paidAmount)}</p>
                </div>
                <div className="bg-white border border-yellow-200 rounded-xl p-4">
                    <p className="text-xs text-yellow-600 font-medium">미납/연체</p>
                    <p className="text-xl font-extrabold text-yellow-700 mt-1">{formatAmount(pendingAmount)}</p>
                </div>
            </div>

            {/* Create form */}
            {showForm && (
                <form onSubmit={handleCreate} className="bg-white border border-gray-200 rounded-xl p-6 mb-6 shadow-sm space-y-4">
                    <h3 className="font-bold text-lg text-gray-900">새 수납 기록</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">원생 *</label>
                            <select
                                value={studentId}
                                onChange={(e) => setStudentId(e.target.value)}
                                required
                                className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-brand-orange-500 bg-white"
                            >
                                <option value="">선택하세요</option>
                                {students.map((s) => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">금액 (원) *</label>
                            <input
                                type="number"
                                value={amount || ""}
                                onChange={(e) => setAmount(parseInt(e.target.value) || 0)}
                                required
                                placeholder="100000"
                                className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-brand-orange-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">납부 기한 *</label>
                            <input
                                type="date"
                                value={dueDate}
                                onChange={(e) => setDueDate(e.target.value)}
                                required
                                className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-brand-orange-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">상태</label>
                            <select
                                value={status}
                                onChange={(e) => setStatus(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-brand-orange-500 bg-white"
                            >
                                <option value="PENDING">미납</option>
                                <option value="PAID">납부완료</option>
                                <option value="OVERDUE">연체</option>
                            </select>
                        </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                        <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600">취소</button>
                        <button type="submit" disabled={busy} className="bg-brand-orange-500 text-white px-6 py-2 rounded-lg font-bold hover:bg-orange-600 transition disabled:opacity-50">
                            {busy ? "저장 중..." : "추가"}
                        </button>
                    </div>
                </form>
            )}

            {/* Payment list */}
            {payments.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
                    {year}년 {month}월 수납 기록이 없습니다.
                </div>
            ) : (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">원생</th>
                                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">금액</th>
                                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">납부기한</th>
                                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">납부일</th>
                                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">상태</th>
                                    <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase">관리</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {payments.map((p) => {
                                    const statusInfo = STATUS_LABELS[p.status] || STATUS_LABELS.PENDING;
                                    return (
                                        <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-5 py-3.5 font-medium text-gray-900">{p.studentName}</td>
                                            <td className="px-5 py-3.5 text-sm text-gray-700 font-mono">{formatAmount(p.amount)}</td>
                                            <td className="px-5 py-3.5 text-sm text-gray-600">{toDateStr(p.dueDate)}</td>
                                            <td className="px-5 py-3.5 text-sm text-gray-600">{toDateStr(p.paidDate)}</td>
                                            <td className="px-5 py-3.5">
                                                <span className={`text-xs font-bold px-2 py-1 rounded-full ${statusInfo.color}`}>
                                                    {statusInfo.label}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3.5 text-right">
                                                <div className="flex items-center gap-2 justify-end">
                                                    {p.status !== "PAID" && (
                                                        <button
                                                            onClick={() => handleStatusChange(p.id, "PAID")}
                                                            disabled={busy}
                                                            className="text-xs text-green-600 hover:text-green-800 font-medium"
                                                        >
                                                            납부처리
                                                        </button>
                                                    )}
                                                    {p.status === "PENDING" && (
                                                        <button
                                                            onClick={() => handleStatusChange(p.id, "OVERDUE")}
                                                            disabled={busy}
                                                            className="text-xs text-yellow-600 hover:text-yellow-800 font-medium"
                                                        >
                                                            연체처리
                                                        </button>
                                                    )}
                                                    {p.status === "PAID" && (
                                                        <button
                                                            onClick={() => handleStatusChange(p.id, "REFUNDED")}
                                                            disabled={busy}
                                                            className="text-xs text-gray-500 hover:text-gray-700 font-medium"
                                                        >
                                                            환불
                                                        </button>
                                                    )}
                                                    {deleteConfirm === p.id ? (
                                                        <div className="flex gap-1">
                                                            <button onClick={() => handleDelete(p.id)} disabled={busy}
                                                                className="text-xs bg-red-500 text-white px-2 py-1 rounded font-bold disabled:opacity-50">확인</button>
                                                            <button onClick={() => setDeleteConfirm(null)}
                                                                className="text-xs text-gray-500 px-2 py-1">취소</button>
                                                        </div>
                                                    ) : (
                                                        <button onClick={() => setDeleteConfirm(p.id)}
                                                            className="text-xs text-red-500 hover:text-red-700 font-medium">삭제</button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
