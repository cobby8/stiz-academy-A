"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import { requestStaffPaymentConfirmation } from "@/app/actions/staff-billing";
import { useStaffDialog } from "@/components/staff/useStaffDialog";
import type { StaffBillingListItem } from "@/lib/staff-portal-queries";

const labels: Record<string, string> = { PENDING: "납부 전", OVERDUE: "기한 지남", PAID: "납부 완료", REFUNDED: "환불" };

export default function StaffBillingClient({ bills }: { bills: StaffBillingListItem[] }) {
  const [filter, setFilter] = useState<"OPEN" | "ALL">("OPEN");
  const [target, setTarget] = useState<StaffBillingListItem | null>(null);
  const [method, setMethod] = useState("BANK_TRANSFER");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeDialog = useCallback(() => setTarget(null), []);
  useStaffDialog(Boolean(target), dialogRef, closeDialog, !pending);
  const visible = filter === "OPEN" ? bills.filter((bill) => ["PENDING", "OVERDUE"].includes(bill.status)) : bills;

  function submit() {
    if (!target || pending) return;
    setMessage("");
    startTransition(async () => {
      try {
        const result = await requestStaffPaymentConfirmation({
          paymentId: target.id,
          method,
          receivedAt: new Date().toISOString(),
          note,
        });
        setMessage(result.message);
        if (result.ok) {
          setTarget(null);
          window.location.reload();
        }
      } catch {
        setMessage("요청을 보내지 못했습니다. 네트워크 연결을 확인하고 다시 시도해 주세요.");
      }
    });
  }

  return (
    <main className="mx-auto max-w-lg space-y-4 px-4 py-5">
      <header>
        <p className="text-sm font-bold text-[var(--brand-accent)]">담당 수업 전용</p>
        <h1 className="mt-1 text-2xl font-black">청구 확인</h1>
        <p className="mt-1 text-sm text-gray-500">현금·계좌이체 수납은 관리자 승인 후 납부 완료됩니다.</p>
      </header>
      <div role="tablist" aria-label="청구 상태" className="grid grid-cols-2 rounded-xl bg-gray-100 p-1 dark:bg-gray-800">
        {([["OPEN", "미납"], ["ALL", "전체"]] as const).map(([value, label]) => (
          <button key={value} type="button" role="tab" aria-selected={filter === value} onClick={() => setFilter(value)} className={`min-h-11 rounded-lg font-bold ${filter === value ? "bg-white text-[var(--brand-accent)] shadow-sm dark:bg-gray-700" : "text-gray-500"}`}>
            {label}
          </button>
        ))}
      </div>
      {message && <p role="status" className="rounded-xl bg-blue-50 p-3 text-sm font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-200">{message}</p>}
      {visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center dark:border-gray-700">
          <span className="material-symbols-outlined text-4xl text-gray-400">verified_user</span>
          <p className="mt-2 font-bold">표시할 담당 수업 청구가 없습니다.</p>
        </div>
      ) : visible.map((bill) => (
        <article key={bill.id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex justify-between gap-3"><div><h2 className="font-black">{bill.studentName}</h2><p className="text-sm text-gray-500">{bill.className} · {bill.title}</p></div><span className="h-fit rounded-full bg-gray-100 px-2 py-1 text-xs font-bold dark:bg-gray-800">{labels[bill.status] ?? bill.status}</span></div>
          <p className="mt-4 text-xl font-black">{bill.amount.toLocaleString("ko-KR")}원</p>
          <p className="text-xs text-gray-500">납부 기한 {new Intl.DateTimeFormat("ko-KR").format(new Date(bill.dueDate))}</p>
          {bill.confirmationStatus === "PENDING" ? <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-700 dark:bg-amber-950 dark:text-amber-200">관리자 확인 대기 중</p> : ["PENDING", "OVERDUE"].includes(bill.status) && <button type="button" onClick={() => { setTarget(bill); setMessage(""); }} className="mt-3 min-h-12 w-full rounded-xl bg-[var(--brand-accent)] font-black text-[var(--brand-accent-contrast)]">납부 확인 요청</button>}
        </article>
      ))}
      {target && (
        <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/50 p-4 sm:items-center" onMouseDown={(event) => { if (event.target === event.currentTarget && !pending) setTarget(null); }}>
          <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="payment-dialog-title" aria-describedby="payment-dialog-description" className="max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl dark:bg-gray-900">
            <h2 id="payment-dialog-title" className="text-xl font-black">납부 확인 요청</h2>
            <p id="payment-dialog-description" className="mt-1 text-sm text-gray-500">{target.studentName} · {target.amount.toLocaleString("ko-KR")}원</p>
            <label className="mt-4 block text-sm font-bold" htmlFor="payment-method">납부 방법</label>
            <select id="payment-method" value={method} onChange={(event) => setMethod(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-gray-300 bg-white px-3 dark:border-gray-700 dark:bg-gray-800"><option value="BANK_TRANSFER">계좌이체</option><option value="CASH">현금</option></select>
            <label className="mt-3 block text-sm font-bold" htmlFor="payment-note">수납 메모</label>
            <textarea id="payment-note" value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} rows={3} placeholder="필요한 내용을 남겨 주세요" className="mt-2 w-full rounded-xl border border-gray-300 bg-white p-3 dark:border-gray-700 dark:bg-gray-800" />
            <div className="mt-4 grid grid-cols-2 gap-2 pb-[env(safe-area-inset-bottom)]"><button data-dialog-initial-focus type="button" disabled={pending} onClick={closeDialog} className="min-h-12 rounded-xl border border-gray-300 font-bold disabled:opacity-50 dark:border-gray-700">취소</button><button type="button" disabled={pending} onClick={submit} className="min-h-12 rounded-xl bg-[var(--brand-accent)] font-black text-[var(--brand-accent-contrast)] disabled:opacity-50">{pending ? "요청 중…" : "확인 요청"}</button></div>
          </div>
        </div>
      )}
    </main>
  );
}
