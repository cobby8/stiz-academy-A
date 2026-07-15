"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

import { loadStaffClassBilling, requestStaffPaymentConfirmation, type SerializedStaffClassBillingItem } from "@/app/actions/staff-billing";

const billingRequests = new Map<string, Promise<Awaited<ReturnType<typeof loadStaffClassBilling>>>>();

type Filter = "OPEN" | "PENDING" | "PAID" | "ALL";

export function ClassBillingSheet({ open, classId, className, student, onClose }: { open: boolean; classId: string; className: string; student?: { id: string; name: string } | null; onClose: () => void }) {
  const cacheKey = `${classId}:${student?.id || "all"}`;
  const [items, setItems] = useState<SerializedStaffClassBillingItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState<Filter>("OPEN");
  const [requestTarget, setRequestTarget] = useState<SerializedStaffClassBillingItem | null>(null);

  useEffect(() => {
    if (!open || requestTarget) return;
    const handleEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose, open, requestTarget]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    queueMicrotask(() => {
      if (active) {
        setItems([]);
        setLoading(true);
        setError("");
        setNotice("");
      }
    });
    const request = billingRequests.get(cacheKey) ?? loadStaffClassBilling({ classId, studentId: student?.id });
    billingRequests.set(cacheKey, request);
    void request.then((result) => {
      if (active) setItems(result.items);
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : "청구 내역을 불러오지 못했습니다.");
    }).finally(() => {
      billingRequests.delete(cacheKey);
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [cacheKey, classId, open, student?.id]);

  const counts = useMemo(() => ({
    open: items.filter((item) => item.status === "UNPAID").length,
    pending: items.filter((item) => item.status === "PENDING_CONFIRMATION").length,
  }), [items]);
  const visible = items.filter((item) => filter === "ALL" || (filter === "OPEN" && item.status === "UNPAID") || (filter === "PENDING" && item.status === "PENDING_CONFIRMATION") || (filter === "PAID" && item.status === "PAID"));

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-end bg-black/55 sm:items-center sm:justify-center" role="dialog" aria-modal="true" aria-labelledby="class-billing-title">
      <button type="button" aria-label="청구 확인 닫기" className="absolute inset-0 cursor-default" onClick={onClose} />
      <section className="relative max-h-[92dvh] w-full max-w-lg overflow-hidden rounded-t-3xl bg-white shadow-2xl dark:bg-gray-900 sm:rounded-3xl">
        <header className="border-b border-gray-100 px-5 pb-4 pt-3 dark:border-gray-800">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-gray-300 dark:bg-gray-700" />
          <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold text-[var(--brand-accent)]">{className}</p><h2 id="class-billing-title" className="mt-0.5 text-xl font-black dark:text-white">{student ? `${student.name} 청구` : "수업 청구 확인"}</h2><p className="mt-1 text-xs text-gray-500">미납 {counts.open}건 · 확인 대기 {counts.pending}건</p></div><button type="button" autoFocus onClick={onClose} aria-label="닫기" className="flex min-h-11 min-w-11 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800"><span className="material-symbols-outlined">close</span></button></div>
          <div className="mt-4 flex gap-2 overflow-x-auto">{(["OPEN", "PENDING", "PAID", "ALL"] as Filter[]).map((value) => <button key={value} type="button" onClick={() => setFilter(value)} className={`min-h-10 shrink-0 rounded-full px-4 text-sm font-black ${filter === value ? "bg-brand-navy-900 text-white" : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"}`}>{({ OPEN: "미납", PENDING: "확인 대기", PAID: "납부 완료", ALL: "전체" } as const)[value]}</button>)}</div>
        </header>
        <div className="max-h-[calc(92dvh-11.5rem)] overflow-y-auto overscroll-contain px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
          {loading && items.length === 0 && <BillingMessage icon="progress_activity" text="청구 내역을 불러오는 중입니다." spin />}
          {error && <BillingMessage icon="error" text={error} />}
          {notice && <p aria-live="polite" className="mb-3 rounded-xl bg-green-50 p-3 text-sm font-bold text-green-700">{notice}</p>}
          {!loading && !error && visible.length === 0 && <BillingMessage icon="receipt_long" text="해당하는 청구 내역이 없습니다." />}
          <div className="space-y-3">{visible.map((item) => <BillingCard key={item.id} item={item} onRequest={() => setRequestTarget(item)} />)}</div>
        </div>
      </section>
      {requestTarget && <PaymentRequestDialog item={requestTarget} onClose={() => setRequestTarget(null)} onCompleted={(message) => {
        const updated = items.map((item) => item.id === requestTarget.id ? { ...item, status: "PENDING_CONFIRMATION" as const, confirmationStatus: "PENDING" } : item);
        setItems(updated);
        setRequestTarget(null);
        setNotice(message);
      }} />}
    </div>
  );
}

function BillingCard({ item, onRequest }: { item: SerializedStaffClassBillingItem; onRequest: () => void }) {
  const status = item.status === "UNPAID" ? "미납" : item.status === "PENDING_CONFIRMATION" ? "관리자 확인 대기" : "납부 완료";
  return <article className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"><div className="flex justify-between gap-3"><div><h3 className="font-black dark:text-white">{item.studentName}</h3><p className="mt-0.5 text-sm text-gray-500">{item.title}</p></div><span className={`h-fit rounded-full px-2.5 py-1 text-xs font-black ${item.status === "UNPAID" ? "bg-red-50 text-red-700" : item.status === "PENDING_CONFIRMATION" ? "bg-amber-50 text-amber-700" : "bg-green-50 text-green-700"}`}>{status}</span></div><p className="mt-4 text-xl font-black dark:text-white">{item.amount.toLocaleString("ko-KR")}원</p><p className="mt-1 text-xs text-gray-500">납부 기한 {new Intl.DateTimeFormat("ko-KR").format(new Date(item.dueDate))}</p>{item.status === "UNPAID" && <button type="button" onClick={onRequest} className="mt-3 min-h-12 w-full rounded-xl bg-[var(--brand-accent)] font-black text-[var(--brand-accent-contrast)]">납부 확인 요청</button>}</article>;
}

function PaymentRequestDialog({ item, onClose, onCompleted }: { item: SerializedStaffClassBillingItem; onClose: () => void; onCompleted: (message: string) => void }) {
  const [method, setMethod] = useState("BANK_TRANSFER");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => { if (event.key === "Escape" && !pending) onClose(); };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose, pending]);
  function submit() { startTransition(async () => { try { const result = await requestStaffPaymentConfirmation({ paymentId: item.id, method, receivedAt: new Date().toISOString(), note }); if (result.ok) onCompleted(result.message); else setMessage(result.message); } catch { setMessage("네트워크 연결을 확인한 뒤 다시 요청해 주세요."); } }); }
  return <div className="fixed inset-0 z-[80] flex items-end bg-black/60 p-4 sm:items-center sm:justify-center" role="dialog" aria-modal="true" aria-labelledby="payment-request-title"><div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl dark:bg-gray-900"><h3 id="payment-request-title" className="text-xl font-black dark:text-white">납부 확인 요청</h3><p className="mt-1 text-sm text-gray-500">{item.studentName} · {item.amount.toLocaleString("ko-KR")}원</p><label className="mt-4 block text-sm font-bold">납부 방법<select autoFocus value={method} onChange={(event) => setMethod(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-gray-200 bg-white px-3 dark:border-gray-700 dark:bg-gray-800"><option value="BANK_TRANSFER">계좌이체</option><option value="CASH">현금</option></select></label><label className="mt-3 block text-sm font-bold">수납 메모<textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} rows={3} placeholder="필요한 경우 간단히 입력하세요." className="mt-2 w-full rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800" /></label>{message && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{message}</p>}<p className="mt-3 text-xs text-gray-500">요청 후 관리자가 확인해야 납부 완료로 처리됩니다.</p><div className="mt-4 grid grid-cols-2 gap-2"><button type="button" disabled={pending} onClick={onClose} className="min-h-12 rounded-xl border border-gray-200 font-bold dark:border-gray-700">취소</button><button type="button" disabled={pending} onClick={submit} className="min-h-12 rounded-xl bg-[var(--brand-accent)] font-black text-[var(--brand-accent-contrast)] disabled:opacity-50">{pending ? "요청 중" : "확인 요청"}</button></div></div></div>;
}

function BillingMessage({ icon, text, spin = false }: { icon: string; text: string; spin?: boolean }) { return <div className="py-12 text-center text-sm font-bold text-gray-500"><span className={`material-symbols-outlined mb-2 block text-4xl ${spin ? "animate-spin" : ""}`}>{icon}</span>{text}</div>; }
