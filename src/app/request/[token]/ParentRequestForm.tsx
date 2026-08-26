"use client";

import { useState, useTransition } from "react";

export type PublicParentRequestContext = {
  valid: boolean;
  linkStatus: "ACTIVE" | "EXPIRED" | "INVALID";
  studentHint: string | null;
  expiresAt: string | null;
};

type SubmitInput = { kind: string; effectiveDate: string; details: string };

const REQUEST_TYPES = [
  ["PAUSE", "휴원"], ["WITHDRAW", "퇴원"], ["RESUME", "복귀"], ["CLASS_CHANGE", "수업 변경"],
  ["CLASS_ADD", "수업 추가"], ["SHUTTLE_CHANGE", "셔틀 변경"], ["CONTACT_UPDATE", "연락처 변경"],
  ["BILLING_CORRECTION", "청구 확인"], ["OTHER", "기타 요청"],
] as const;

export default function ParentRequestForm({ context, submitRequest }: { context: PublicParentRequestContext; submitRequest: (input: SubmitInput) => Promise<{ ok: true }> }) {
  const [kind, setKind] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [details, setDetails] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  if (!context.valid) return <InvalidLink expired={context.linkStatus === "EXPIRED"} />;
  if (submitted) return <main className="flex min-h-dvh items-center justify-center bg-slate-50 px-5 py-10"><section className="w-full max-w-md rounded-3xl bg-white p-7 text-center shadow-xl shadow-slate-200/70"><div className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-100 text-2xl" aria-hidden="true">✓</div><h1 className="mt-5 text-2xl font-black text-slate-950">요청을 접수했습니다</h1><p className="mt-3 leading-7 text-slate-600">원장님이 내용을 확인하고 승인한 뒤 반영합니다. 아직 수업·셔틀·청구 내용은 변경되지 않았습니다.</p><p className="mt-5 rounded-xl bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">청구서나 안내 문자도 별도 확인 전에는 발송되지 않습니다.</p></section></main>;

  function submit() {
    if (!kind || !effectiveDate || !details.trim()) { setMessage("요청 종류, 희망 적용일, 요청 내용을 모두 입력해 주세요."); return; }
    startTransition(async () => {
      try { await submitRequest({ kind, effectiveDate, details: details.trim() }); setSubmitted(true); }
      catch (error) { setMessage(error instanceof Error ? error.message : "요청을 접수하지 못했습니다. 학원으로 연락해 주세요."); }
    });
  }

  return <main className="min-h-dvh bg-slate-50 px-4 py-8 sm:py-12"><div className="mx-auto max-w-lg">
    <header className="px-1"><p className="text-xs font-black tracking-[0.2em] text-lime-600">STIZ BASKETBALL</p><h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">학부모 요청 접수</h1><p className="mt-2 text-sm leading-6 text-slate-600">{context.studentHint ? `${context.studentHint} 학생에 대한 ` : ""}변경 요청을 남겨 주세요.</p></header>
    <section className="mt-6 rounded-3xl bg-white p-5 shadow-xl shadow-slate-200/60 sm:p-7">
      <div className="rounded-2xl bg-blue-50 p-4 text-sm font-bold leading-6 text-blue-900">제출 즉시 바뀌지 않습니다. 원장님이 시트·랠리즈·홈페이지의 변경 전후를 확인한 뒤 승인합니다.</div>
      <fieldset className="mt-6"><legend className="text-sm font-black text-slate-900">1. 요청 종류</legend><div className="mt-3 grid grid-cols-2 gap-2">{REQUEST_TYPES.map(([value, label]) => <label key={value} className={`flex min-h-12 cursor-pointer items-center justify-center rounded-xl border px-3 text-center text-sm font-bold ${kind === value ? "border-blue-600 bg-blue-50 text-blue-800" : "border-slate-200 text-slate-700"}`}><input className="sr-only" type="radio" name="kind" value={value} checked={kind === value} onChange={() => setKind(value)} />{label}</label>)}</div></fieldset>
      <label className="mt-6 block text-sm font-black text-slate-900">2. 희망 적용일<input type="date" value={effectiveDate} onChange={(event) => setEffectiveDate(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base" /></label>
      <label className="mt-6 block text-sm font-black text-slate-900">3. 요청 내용<textarea value={details} onChange={(event) => setDetails(event.target.value)} rows={5} maxLength={1000} placeholder="예: 9월부터 화요일 수업을 토요일로 변경하고 싶습니다." className="mt-2 w-full resize-y rounded-xl border border-slate-300 px-3 py-3 text-base leading-6" /><span className="mt-1 block text-right text-xs font-medium text-slate-400">{details.length}/1000</span></label>
      <p role="alert" className="mt-3 min-h-5 text-sm font-bold text-red-600">{message}</p>
      <button type="button" disabled={isPending} onClick={submit} className="mt-2 min-h-14 w-full rounded-2xl bg-slate-950 px-5 text-base font-black text-white disabled:opacity-50">{isPending ? "접수 중…" : "원장님께 검토 요청"}</button>
      <p className="mt-3 text-center text-xs leading-5 text-slate-500">이 링크는 {context.expiresAt ? new Date(context.expiresAt).toLocaleString("ko-KR") : "정해진 시간"}까지 사용할 수 있습니다.</p>
    </section>
  </div></main>;
}

function InvalidLink({ expired }: { expired: boolean }) {
  return <main className="flex min-h-dvh items-center justify-center bg-slate-50 px-5"><section className="w-full max-w-md rounded-3xl bg-white p-7 text-center shadow-xl shadow-slate-200/70"><div className="text-4xl" aria-hidden="true">🔒</div><h1 className="mt-4 text-2xl font-black text-slate-950">{expired ? "링크 사용 기간이 끝났습니다" : "올바르지 않은 링크입니다"}</h1><p className="mt-3 leading-7 text-slate-600">개인정보 보호를 위해 이 링크로는 요청을 접수할 수 없습니다. 학원에 새 요청 링크를 보내 달라고 말씀해 주세요.</p></section></main>;
}
