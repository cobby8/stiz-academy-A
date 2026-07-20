"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { formatWon, normalizeProgram, programClasses, type SeasonalProgram } from "./types";

type Form = {
  childName: string; birthDate: string; gender: string; grade: string; school: string; childPhone: string;
  parentName: string; parentPhone: string; relation: string; address: string; memo: string;
  selected: string[]; shuttle: boolean; pickupLocation: string; pickupTime: string; dropoffLocation: string; shuttleNote: string;
  agreedTerms: boolean; agreedPrivacy: boolean;
};

const EMPTY: Form = { childName: "", birthDate: "", gender: "", grade: "", school: "", childPhone: "", parentName: "", parentPhone: "", relation: "", address: "", memo: "", selected: [], shuttle: false, pickupLocation: "", pickupTime: "", dropoffLocation: "", shuttleNote: "", agreedTerms: false, agreedPrivacy: false };
const STEP_NAMES = ["신청 방법", "학생·보호자", "수업 선택", "셔틀·금액", "확인·동의"];

export default function SeasonalApplyClient({ slug }: { slug: string }) {
  const storageKey = `seasonal-application:${slug}`;
  const idempotencyStorageKey = `seasonal-application-key:${slug}`;
  const [program, setProgram] = useState<SeasonalProgram | null>(null);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<Form>(EMPTY);
  const [error, setError] = useState("");
  const [loadFailed, setLoadFailed] = useState(false);
  const [result, setResult] = useState<{ applicationId: string; status: string; totalPriceSnapshot: number; duplicate?: boolean } | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    try { const saved = localStorage.getItem(storageKey); if (saved) setForm({ ...EMPTY, ...JSON.parse(saved) }); } catch { /* 손상된 임시 데이터는 무시 */ }
    fetch(`/api/seasonal/${encodeURIComponent(slug)}`).then(async (response) => { if (!response.ok) throw new Error(); const data = await response.json(); return normalizeProgram(data.program ?? data.season ?? data); }).then(setProgram).catch(() => setLoadFailed(true));
  }, [slug, storageKey]);
  useEffect(() => { if (form !== EMPTY) localStorage.setItem(storageKey, JSON.stringify(form)); }, [form, storageKey]);

  const offerings = useMemo(() => program ? programClasses(program) : [], [program]);
  const selected = offerings.filter((item) => form.selected.includes(item.id));
  const total = selected.reduce((sum, item) => sum + item.price, 0);
  const update = <K extends keyof Form>(key: K, value: Form[K]) => { setForm((current) => ({ ...current, [key]: value })); setError(""); };

  const next = () => {
    const message = validate(step, form);
    if (message) { setError(message); return; }
    setStep((value) => Math.min(5, value + 1)); window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const submit = () => {
    const message = validate(5, form); if (message) { setError(message); return; }
    let idempotencyKey = localStorage.getItem(idempotencyStorageKey);
    if (!idempotencyKey) {
      idempotencyKey = crypto.randomUUID();
      localStorage.setItem(idempotencyStorageKey, idempotencyKey);
    }
    startTransition(async () => {
      try {
        const response = await fetch(`/api/seasonal/${encodeURIComponent(slug)}/applications`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idempotencyKey, child: { name: form.childName.trim(), birthDate: form.birthDate, gender: form.gender || undefined, grade: form.grade || undefined, school: form.school.trim() || undefined, phone: form.childPhone || undefined }, parent: { name: form.parentName.trim(), phone: form.parentPhone, relation: form.relation || undefined }, address: form.address.trim() || undefined, memo: form.memo.trim() || undefined, agreedTerms: form.agreedTerms, agreedPrivacy: form.agreedPrivacy, items: form.selected.map((offeringId) => ({ offeringId, shuttle: form.shuttle ? { pickupLocation: form.pickupLocation.trim(), pickupTime: form.pickupTime, dropoffLocation: form.dropoffLocation.trim(), note: form.shuttleNote.trim() || undefined } : undefined })) }) });
        const data = await response.json(); if (!response.ok) throw new Error(data.message || data.error || "신청을 완료하지 못했습니다.");
        setResult(data); localStorage.removeItem(storageKey); localStorage.removeItem(idempotencyStorageKey);
      } catch (reason) { setError(reason instanceof Error ? reason.message : "신청 중 오류가 발생했습니다."); }
    });
  };

  if (loadFailed) return <Center text="특강 정보를 불러오지 못했습니다." />;
  if (!program) return <Center text="신청 정보를 준비하고 있어요." />;
  if (result) return <Complete result={result} slug={slug} />;

  return (
    <section className="bg-gray-50 px-4 py-6 dark:bg-gray-900 md:py-10">
      <div className="mx-auto max-w-2xl">
        <Link href={`/seasonal/${slug}`} className="inline-flex min-h-11 items-center gap-1 text-sm font-bold text-gray-600 dark:text-gray-300"><span className="material-symbols-outlined" aria-hidden="true">arrow_back</span>특강 안내</Link>
        <div className="mt-3 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <header className="border-b border-gray-100 p-5 dark:border-gray-700"><p className="text-sm font-bold text-brand-orange-500">{program.title}</p><h1 className="mt-1 text-2xl font-black">방학특강 신청</h1><ol className="mt-5 grid grid-cols-5 gap-1" aria-label="신청 단계">{STEP_NAMES.map((name, index) => <li key={name} aria-current={step === index + 1 ? "step" : undefined}><div className={`h-1.5 rounded-full ${step >= index + 1 ? "bg-brand-orange-500" : "bg-gray-200 dark:bg-gray-700"}`} /><span className={`mt-1 hidden text-center text-[10px] sm:block ${step === index + 1 ? "font-bold" : "text-gray-400"}`}>{name}</span></li>)}</ol><p className="mt-2 text-sm font-bold">{step}단계 · {STEP_NAMES[step - 1]}</p></header>
          <div className="p-5 md:p-7">{step === 1 && <MethodStep slug={slug} onContinue={next} />}{step === 2 && <PeopleStep form={form} update={update} />}{step === 3 && <OfferingStep offerings={offerings} form={form} update={update} />}{step === 4 && <ShuttleStep form={form} total={total} update={update} />}{step === 5 && <ConfirmStep form={form} selected={selected} total={total} update={update} />}{error && <div role="alert" className="mt-5 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</div>}{step > 1 && <div className="mt-7 flex gap-2"><button type="button" onClick={() => { setError(""); setStep((value) => value - 1); }} className="min-h-12 rounded-xl border border-gray-300 px-5 font-bold">이전</button><button type="button" disabled={pending} onClick={step === 5 ? submit : next} className="min-h-12 flex-1 rounded-xl bg-brand-orange-500 px-5 font-black text-white disabled:opacity-60">{pending ? "신청 중…" : step === 5 ? "신청서 제출" : "다음"}</button></div>}</div>
        </div>
      </div>
    </section>
  );
}

function MethodStep({ slug, onContinue }: { slug: string; onContinue: () => void }) { return <div className="space-y-3"><h2 className="text-xl font-black">어떻게 신청하시겠어요?</h2><p className="text-sm text-gray-500">학부모 회원은 로그인하면 기존 자녀 정보를 확인할 수 있습니다.</p><Link href={`/login?next=/seasonal/${slug}/apply`} className="flex min-h-14 items-center justify-between rounded-xl border border-brand-orange-500 p-4 font-bold"><span><span className="block">로그인하고 신청</span><span className="text-xs font-normal text-gray-500">기존 회원에게 편리해요</span></span><span className="material-symbols-outlined" aria-hidden="true">arrow_forward</span></Link><button type="button" onClick={onContinue} className="flex min-h-14 w-full items-center justify-between rounded-xl border border-gray-300 p-4 text-left font-bold"><span><span className="block">비회원으로 신청</span><span className="text-xs font-normal text-gray-500">가입 없이 바로 입력해요</span></span><span className="material-symbols-outlined" aria-hidden="true">arrow_forward</span></button></div>; }

function PeopleStep({ form, update }: StepProps) { return <div className="space-y-5"><h2 className="text-xl font-black">학생과 보호자 정보</h2><div className="grid gap-4 sm:grid-cols-2"><Field label="학생 이름" required value={form.childName} onChange={(v) => update("childName", v)} /><Field label="생년월일" required type="date" value={form.birthDate} onChange={(v) => update("birthDate", v)} /><Field label="성별" value={form.gender} onChange={(v) => update("gender", v)} /><Field label="현재 학년" value={form.grade} onChange={(v) => update("grade", v)} /><Field label="학교" value={form.school} onChange={(v) => update("school", v)} /><Field label="학생 연락처" type="tel" value={form.childPhone} onChange={(v) => update("childPhone", phone(v))} /><Field label="보호자 이름" required value={form.parentName} onChange={(v) => update("parentName", v)} /><Field label="보호자 연락처" required type="tel" value={form.parentPhone} onChange={(v) => update("parentPhone", phone(v))} /><Field label="관계" value={form.relation} onChange={(v) => update("relation", v)} /><Field label="주소" value={form.address} onChange={(v) => update("address", v)} /></div><Field label="요청사항" value={form.memo} onChange={(v) => update("memo", v)} /></div>; }

function OfferingStep({ offerings, form, update }: { offerings: ReturnType<typeof programClasses>; form: Form; update: Update }) { const toggle = (id: string) => update("selected", form.selected.includes(id) ? form.selected.filter((key) => key !== id) : [...form.selected, id]); return <div><h2 className="text-xl font-black">수업 선택</h2><p className="mt-1 text-sm text-gray-500">여러 수업을 선택할 수 있으며, 마감 반은 대기로 접수됩니다.</p><div className="mt-5 space-y-3">{offerings.map((item) => { const selected = form.selected.includes(item.id); const closed = item.remaining <= 0 && !item.waitlistEnabled; return <button key={item.id} type="button" disabled={closed} aria-pressed={selected} onClick={() => toggle(item.id)} className={`w-full rounded-xl border p-4 text-left ${closed ? "cursor-not-allowed opacity-50" : selected ? "border-brand-orange-500 bg-orange-50 dark:bg-gray-900" : "border-gray-300"}`}><div className="flex justify-between gap-3"><span className="font-black">{item.dayLabel} {item.startTime} · {item.name}</span><span className="text-xs font-bold">{closed ? "마감" : item.remaining <= 0 ? "대기" : `잔여 ${item.remaining}석`}</span></div><p className="mt-1 text-sm text-gray-500">{item.targetGrade || "전체"} · {formatWon(item.price)}</p></button>; })}</div></div>; }

function ShuttleStep({ form, total, update }: StepProps & { total: number }) { return <div className="space-y-5"><h2 className="text-xl font-black">셔틀과 예상 금액</h2><label className="flex min-h-12 items-center gap-3 rounded-xl border border-gray-300 p-4"><input type="checkbox" checked={form.shuttle} onChange={(e) => update("shuttle", e.target.checked)} className="h-5 w-5" />셔틀을 이용합니다</label>{form.shuttle && <div className="space-y-4 rounded-xl bg-gray-50 p-4 dark:bg-gray-900"><Field label="승차 장소" required value={form.pickupLocation} onChange={(v) => update("pickupLocation", v)} /><Field label="희망 시간" required type="time" value={form.pickupTime} onChange={(v) => update("pickupTime", v)} /><Field label="하차 장소" required value={form.dropoffLocation} onChange={(v) => update("dropoffLocation", v)} /><Field label="셔틀 메모" value={form.shuttleNote} onChange={(v) => update("shuttleNote", v)} /></div>}<Price total={total} /><p className="text-xs leading-5 text-gray-500">표시 금액은 예상 금액이며, 셔틀 배차와 관리자 확인 후 발행되는 청구서에서 최종 금액을 확인할 수 있습니다.</p></div>; }

function ConfirmStep({ form, selected, total, update }: StepProps & { selected: ReturnType<typeof programClasses>; total: number }) { return <div className="space-y-5"><h2 className="text-xl font-black">신청 내용을 확인해주세요</h2><div className="rounded-xl bg-gray-50 p-4 text-sm dark:bg-gray-900"><p className="font-black">{form.childName} · 보호자 {form.parentName}</p>{selected.map((item) => <p key={item.id} className="mt-2">{item.dayLabel} {item.startTime} · {item.name}{item.remaining <= 0 ? " (대기)" : ""}</p>)}<Price total={total} /></div><Check label="이용약관에 동의합니다." checked={form.agreedTerms} onChange={(v) => update("agreedTerms", v)} /><Check label="개인정보 수집·이용에 동의합니다." checked={form.agreedPrivacy} onChange={(v) => update("agreedPrivacy", v)} /><p className="text-xs leading-5 text-gray-500">제출 시 서버가 잔여석과 금액을 다시 확인합니다. 마감된 반은 대기 상태로 접수될 수 있습니다.</p></div>; }

type Update = <K extends keyof Form>(key: K, value: Form[K]) => void;
type StepProps = { form: Form; update: Update };
function Field({ label, value, onChange, type = "text", required }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean }) { return <label className="block text-sm font-bold">{label}{required && <span className="text-red-500"> *</span>}<input type={type} required={required} value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 min-h-12 w-full rounded-xl border border-gray-300 bg-white px-3 font-normal outline-none focus:border-brand-orange-500 focus:ring-2 focus:ring-brand-orange-500/20 dark:bg-gray-900" /></label>; }
function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) { return <label className="flex min-h-12 items-center gap-3 rounded-xl border border-gray-300 p-4 text-sm font-bold"><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-5 w-5" />{label}<span className="text-red-500">*</span></label>; }
function Price({ total }: { total: number }) { return <div className="mt-4 flex items-center justify-between border-t border-gray-200 pt-4 dark:border-gray-700"><span className="font-bold">예상 수강료</span><strong className="text-xl text-brand-orange-500">{formatWon(total)}</strong></div>; }
function Complete({ result, slug }: { result: { applicationId: string; status: string; totalPriceSnapshot: number; duplicate?: boolean }; slug: string }) { return <section className="bg-gray-50 px-4 py-12 dark:bg-gray-900"><div className="mx-auto max-w-lg rounded-2xl bg-white p-8 text-center shadow-sm dark:bg-gray-800"><span className="material-symbols-outlined text-5xl text-emerald-600" aria-hidden="true">check_circle</span><h1 className="mt-4 text-2xl font-black">{result.duplicate ? "이미 접수된 신청입니다" : "신청이 접수되었습니다"}</h1><p className="mt-2 text-sm text-gray-500">접수번호 {result.applicationId}</p><p className="mt-5 text-lg font-black">{formatWon(result.totalPriceSnapshot)}</p><p className="mt-2 text-sm text-gray-500">관리자 확인 후 확정 및 결제 안내를 보내드립니다.</p><Link href={`/seasonal/${slug}`} className="mt-7 flex min-h-12 items-center justify-center rounded-xl bg-brand-navy-900 px-5 font-bold text-white">특강 안내로 돌아가기</Link></div></section>; }
function Center({ text }: { text: string }) { return <div className="p-16 text-center text-gray-500">{text}</div>; }
function phone(value: string) { const d = value.replace(/\D/g, "").slice(0, 11); return d.length <= 3 ? d : d.length <= 7 ? `${d.slice(0, 3)}-${d.slice(3)}` : `${d.slice(0, 3)}-${d.slice(3, d.length - 4)}-${d.slice(-4)}`; }
function validate(step: number, form: Form) { if (step === 2 && (!form.childName.trim() || !form.birthDate || !form.parentName.trim() || form.parentPhone.replace(/\D/g, "").length < 10)) return "필수 학생·보호자 정보를 확인해주세요."; if (step === 3 && form.selected.length === 0) return "수업을 하나 이상 선택해주세요."; if (step === 4 && form.shuttle && (!form.pickupLocation.trim() || !form.pickupTime || !form.dropoffLocation.trim())) return "셔틀 승차·시간·하차 정보를 입력해주세요."; if (step === 5 && (!form.agreedTerms || !form.agreedPrivacy)) return "필수 약관에 모두 동의해주세요."; return ""; }
