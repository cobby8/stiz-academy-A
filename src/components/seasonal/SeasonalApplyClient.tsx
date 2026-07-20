"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { formatWon, normalizeProgram, programClasses, type SeasonalClass, type SeasonalProgram } from "./types";

type LoadState = "loading" | "ready" | "error";
type SubmitState = "idle" | "submitting" | "done" | "error";

type FormState = {
  childName: string;
  childBirthDate: string;
  childGender: string;
  childGrade: string;
  childSchool: string;
  childPhone: string;
  parentName: string;
  parentPhone: string;
  parentRelation: string;
  address: string;
  memo: string;
  agreedTerms: boolean;
  agreedPrivacy: boolean;
};

type ShuttleDraft = {
  pickupLocation: string;
  pickupTime: string;
  dropoffLocation: string;
  note: string;
};

type SubmitResult = {
  applicationId?: string;
  duplicate?: boolean;
  items?: Array<{ offeringId: string; status: string; waitlistOrder?: number | null }>;
};

const EMPTY_FORM: FormState = {
  childName: "",
  childBirthDate: "",
  childGender: "",
  childGrade: "",
  childSchool: "",
  childPhone: "",
  parentName: "",
  parentPhone: "",
  parentRelation: "보호자",
  address: "",
  memo: "",
  agreedTerms: false,
  agreedPrivacy: false,
};

function makeIdempotencyKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `seasonal-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function hasShuttle(draft?: ShuttleDraft) {
  return Boolean(draft && Object.values(draft).some((value) => value.trim().length > 0));
}

function emptyShuttle(): ShuttleDraft {
  return { pickupLocation: "", pickupTime: "", dropoffLocation: "", note: "" };
}

function statusText(status: string) {
  if (status === "WAITLISTED") return "대기 접수";
  if (status === "APPROVED") return "승인";
  if (status === "PENDING") return "접수";
  return status;
}

export default function SeasonalApplyClient({ slug }: { slug: string }) {
  const [state, setState] = useState<LoadState>("loading");
  const [program, setProgram] = useState<SeasonalProgram | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [shuttle, setShuttle] = useState<Record<string, ShuttleDraft>>({});
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<SubmitResult | null>(null);
  const idempotencyKeyRef = useRef(makeIdempotencyKey());

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/seasonal/${encodeURIComponent(slug)}`, { signal: controller.signal })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error || "특강 정보를 불러오지 못했습니다.");
        return normalizeProgram(body);
      })
      .then((data) => {
        setProgram(data);
        setState("ready");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setMessage(error instanceof Error ? error.message : "특강 정보를 불러오지 못했습니다.");
        setState("error");
      });
    return () => controller.abort();
  }, [slug]);

  const offerings = useMemo(() => program ? programClasses(program) : [], [program]);
  const selectedOfferings = offerings.filter((item) => selectedIds.includes(item.id));
  const totalPrice = selectedOfferings.reduce((sum, item) => sum + item.price, 0);
  const canSubmit = selectedIds.length > 0 && form.childName && form.childBirthDate && form.parentName
    && form.parentPhone && form.agreedTerms && form.agreedPrivacy && submitState !== "submitting";

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function toggleOffering(item: SeasonalClass) {
    if (item.remaining <= 0 && !item.waitlistEnabled) return;
    setSelectedIds((current) => current.includes(item.id)
      ? current.filter((id) => id !== item.id)
      : [...current, item.id]);
  }

  function updateShuttle(offeringId: string, key: keyof ShuttleDraft, value: string) {
    setShuttle((current) => ({
      ...current,
      [offeringId]: { ...(current[offeringId] ?? emptyShuttle()), [key]: value },
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) {
      setMessage("필수 정보와 신청할 수업, 동의 항목을 확인해 주세요.");
      setSubmitState("error");
      return;
    }

    setSubmitState("submitting");
    setMessage("");

    try {
      const response = await fetch(`/api/seasonal/${encodeURIComponent(slug)}/applications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idempotencyKey: idempotencyKeyRef.current,
          child: {
            name: form.childName,
            birthDate: form.childBirthDate,
            gender: form.childGender,
            grade: form.childGrade,
            school: form.childSchool,
            phone: form.childPhone,
          },
          parent: {
            name: form.parentName,
            phone: form.parentPhone,
            relation: form.parentRelation,
          },
          address: form.address,
          memo: form.memo,
          agreedTerms: form.agreedTerms,
          agreedPrivacy: form.agreedPrivacy,
          items: selectedIds.map((offeringId) => ({
            offeringId,
            shuttle: hasShuttle(shuttle[offeringId]) ? shuttle[offeringId] : undefined,
          })),
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "신청을 저장하지 못했습니다.");
      setResult(body as SubmitResult);
      setSubmitState("done");
      setMessage("신청이 접수되었습니다. 학원에서 확인 후 안내드릴게요.");
    } catch (error) {
      setSubmitState("error");
      setMessage(error instanceof Error ? error.message : "신청을 저장하지 못했습니다.");
    }
  }

  if (state === "loading") return <StatusBox icon="progress_activity" text="신청 정보를 불러오고 있어요." />;
  if (state === "error" || !program) return <StatusBox icon="error" text={message || "신청 정보를 불러오지 못했습니다."} retry />;
  if (submitState === "done") return <DoneView slug={slug} result={result} offerings={offerings} message={message} />;

  return (
    <form onSubmit={handleSubmit} className="bg-gray-50 px-4 py-8 pb-28 dark:bg-gray-900">
      <div className="mx-auto max-w-5xl space-y-6">
        <header>
          <Link href={`/seasonal/${slug}`} className="text-sm font-bold text-brand-orange-500 dark:text-brand-neon-lime">특강 상세로 돌아가기</Link>
          <p className="mt-5 text-sm font-bold text-brand-orange-500 dark:text-brand-neon-lime">방학특강 신청</p>
          <h1 className="mt-2 text-3xl font-black text-gray-900 dark:text-white">{program.title}</h1>
          {program.summary && <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600 dark:text-gray-300">{program.summary}</p>}
        </header>

        {message && (
          <p role="status" className={`rounded-xl border px-4 py-3 text-sm font-bold ${submitState === "error" ? "border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-100" : "border-green-200 bg-green-50 text-green-800 dark:border-green-500/30 dark:bg-green-500/10 dark:text-green-100"}`}>
            {message}
          </p>
        )}

        <section className="space-y-3">
          <div>
            <h2 className="text-xl font-black text-gray-900 dark:text-white">수업 선택</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">신청할 수업을 한 개 이상 선택해 주세요.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {offerings.map((item) => {
              const selected = selectedIds.includes(item.id);
              const disabled = item.remaining <= 0 && !item.waitlistEnabled;
              return (
                <article key={item.id} className={`rounded-2xl border bg-white p-5 shadow-sm dark:bg-gray-800 ${selected ? "border-brand-orange-500 ring-2 ring-brand-orange-100 dark:border-brand-neon-lime dark:ring-brand-neon-lime/20" : "border-gray-200 dark:border-gray-700"} ${disabled ? "opacity-60" : ""}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold text-brand-orange-500 dark:text-brand-neon-lime">{item.dayLabel} {item.dateLabel}</p>
                      <h3 className="mt-1 text-lg font-black text-gray-900 dark:text-white">{item.name}</h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleOffering(item)}
                      disabled={disabled}
                      className={`min-h-10 rounded-xl px-4 text-sm font-black transition ${selected ? "bg-brand-orange-500 text-white dark:bg-brand-neon-lime dark:text-brand-navy-900" : "border border-gray-300 text-gray-700 dark:border-gray-600 dark:text-gray-200"} disabled:cursor-not-allowed`}
                    >
                      {selected ? "선택됨" : disabled ? "마감" : "선택"}
                    </button>
                  </div>
                  <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <Pair label="시간" value={`${item.startTime}~${item.endTime}`} />
                    <Pair label="대상" value={item.targetGrade || "전체"} />
                    <Pair label="잔여" value={item.remaining > 0 ? `${item.remaining}석` : item.waitlistEnabled ? "대기 가능" : "마감"} />
                    <Pair label="수강료" value={formatWon(item.price)} />
                  </dl>
                  {selected && (
                    <div className="mt-4 rounded-xl bg-gray-50 p-3 dark:bg-gray-900">
                      <p className="text-xs font-bold text-gray-600 dark:text-gray-300">셔틀 요청이 있으면 적어주세요</p>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <TextInput label="탑승 위치" value={shuttle[item.id]?.pickupLocation ?? ""} onChange={(value) => updateShuttle(item.id, "pickupLocation", value)} />
                        <TextInput label="희망 시간" value={shuttle[item.id]?.pickupTime ?? ""} onChange={(value) => updateShuttle(item.id, "pickupTime", value)} />
                        <TextInput label="하차 위치" value={shuttle[item.id]?.dropoffLocation ?? ""} onChange={(value) => updateShuttle(item.id, "dropoffLocation", value)} />
                        <TextInput label="셔틀 메모" value={shuttle[item.id]?.note ?? ""} onChange={(value) => updateShuttle(item.id, "note", value)} />
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <h2 className="text-xl font-black text-gray-900 dark:text-white">신청 정보</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <TextInput label="학생 이름 *" value={form.childName} onChange={(value) => update("childName", value)} required />
              <DateInput label="학생 생년월일 *" value={form.childBirthDate} onChange={(value) => update("childBirthDate", value)} required />
              <TextInput label="학생 성별" value={form.childGender} onChange={(value) => update("childGender", value)} placeholder="예: 남 / 여" />
              <TextInput label="학년" value={form.childGrade} onChange={(value) => update("childGrade", value)} placeholder="예: 초4" />
              <TextInput label="학교" value={form.childSchool} onChange={(value) => update("childSchool", value)} />
              <TextInput label="학생 연락처" value={form.childPhone} onChange={(value) => update("childPhone", value)} inputMode="tel" />
              <TextInput label="보호자 이름 *" value={form.parentName} onChange={(value) => update("parentName", value)} required />
              <TextInput label="보호자 연락처 *" value={form.parentPhone} onChange={(value) => update("parentPhone", value)} inputMode="tel" required />
              <TextInput label="보호자 관계" value={form.parentRelation} onChange={(value) => update("parentRelation", value)} />
              <TextInput label="주소" value={form.address} onChange={(value) => update("address", value)} />
            </div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-200">
              요청 사항
              <textarea
                value={form.memo}
                onChange={(event) => update("memo", event.target.value)}
                rows={4}
                className="mt-1 w-full rounded-xl border border-gray-300 bg-white p-3 text-sm text-gray-900 focus:ring-2 focus:ring-brand-orange-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white dark:focus:ring-brand-neon-lime"
                placeholder="상담 시 참고할 내용을 적어주세요"
              />
            </label>
          </div>

          <aside className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <h2 className="text-xl font-black text-gray-900 dark:text-white">신청 요약</h2>
            <div className="space-y-2">
              {selectedOfferings.length === 0 ? (
                <p className="rounded-xl bg-gray-50 p-4 text-sm text-gray-500 dark:bg-gray-900 dark:text-gray-400">선택한 수업이 없습니다.</p>
              ) : selectedOfferings.map((item) => (
                <div key={item.id} className="rounded-xl bg-gray-50 p-3 text-sm dark:bg-gray-900">
                  <p className="font-bold text-gray-900 dark:text-white">{item.name}</p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{item.dayLabel} {item.startTime}~{item.endTime} · {formatWon(item.price)}</p>
                  {item.remaining <= 0 && <p className="mt-1 text-xs font-bold text-amber-600 dark:text-amber-300">대기 접수로 신청됩니다.</p>}
                </div>
              ))}
            </div>
            <div className="border-t border-gray-100 pt-4 dark:border-gray-700">
              <p className="text-sm text-gray-500 dark:text-gray-400">예상 합계</p>
              <p className="mt-1 text-2xl font-black text-brand-navy-900 dark:text-white">{formatWon(totalPrice)}</p>
            </div>
            <CheckBox label="방학특강 운영 안내와 환불 규정을 확인했습니다." checked={form.agreedTerms} onChange={(checked) => update("agreedTerms", checked)} />
            <CheckBox label="신청과 상담을 위한 개인정보 수집·이용에 동의합니다." checked={form.agreedPrivacy} onChange={(checked) => update("agreedPrivacy", checked)} />
          </aside>
        </section>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white/95 p-3 backdrop-blur dark:border-gray-700 dark:bg-gray-900/95">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <div className="hidden min-w-0 flex-1 sm:block">
            <p className="truncate text-sm font-bold text-gray-900 dark:text-white">{selectedOfferings.length}개 수업 선택 · {formatWon(totalPrice)}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">제출 후 학원에서 확인 연락을 드립니다.</p>
          </div>
          <Link href={`/seasonal/${slug}`} className="flex min-h-12 items-center justify-center rounded-xl border border-gray-300 px-4 font-bold text-gray-700 dark:border-gray-600 dark:text-gray-200">취소</Link>
          <button
            type="submit"
            disabled={!canSubmit}
            className="flex min-h-12 flex-1 items-center justify-center rounded-xl bg-brand-orange-500 px-5 font-black text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-brand-neon-lime dark:text-brand-navy-900 sm:flex-none"
          >
            {submitState === "submitting" ? "접수 중..." : "신청 접수"}
          </button>
        </div>
      </div>
    </form>
  );
}

function DoneView({ slug, result, offerings, message }: { slug: string; result: SubmitResult | null; offerings: SeasonalClass[]; message: string }) {
  const byId = new Map(offerings.map((item) => [item.id, item]));
  return (
    <main className="bg-gray-50 px-4 py-12 dark:bg-gray-900">
      <section className="mx-auto max-w-xl rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-sm font-black text-green-700 dark:bg-green-500/15 dark:text-green-200">완료</div>
        <h1 className="mt-5 text-2xl font-black text-gray-900 dark:text-white">신청이 접수되었습니다</h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-300">{message}</p>
        {result?.items && result.items.length > 0 && (
          <div className="mt-6 space-y-2 text-left">
            {result.items.map((item) => (
              <div key={item.offeringId} className="rounded-xl bg-gray-50 p-3 text-sm dark:bg-gray-900">
                <p className="font-bold text-gray-900 dark:text-white">{byId.get(item.offeringId)?.name ?? "선택 수업"}</p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {statusText(item.status)}{item.waitlistOrder ? ` · 대기 ${item.waitlistOrder}번` : ""}
                </p>
              </div>
            ))}
          </div>
        )}
        <div className="mt-6 flex justify-center gap-2">
          <Link href={`/seasonal/${slug}`} className="inline-flex min-h-11 items-center rounded-xl border border-gray-300 px-5 font-bold text-gray-700 dark:border-gray-600 dark:text-gray-200">상세 보기</Link>
          <Link href="/" className="inline-flex min-h-11 items-center rounded-xl bg-brand-orange-500 px-5 font-bold text-white dark:bg-brand-neon-lime dark:text-brand-navy-900">홈으로</Link>
        </div>
      </section>
    </main>
  );
}

function TextInput({
  label,
  value,
  onChange,
  placeholder,
  required,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  inputMode?: "text" | "tel";
}) {
  return (
    <label className="block text-sm font-bold text-gray-700 dark:text-gray-200">
      {label}
      <input
        type="text"
        inputMode={inputMode}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        className="mt-1 w-full rounded-xl border border-gray-300 bg-white p-3 text-sm text-gray-900 focus:ring-2 focus:ring-brand-orange-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white dark:focus:ring-brand-neon-lime"
      />
    </label>
  );
}

function DateInput({ label, value, onChange, required }: { label: string; value: string; onChange: (value: string) => void; required?: boolean }) {
  return (
    <label className="block text-sm font-bold text-gray-700 dark:text-gray-200">
      {label}
      <input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        className="mt-1 w-full rounded-xl border border-gray-300 bg-white p-3 text-sm text-gray-900 focus:ring-2 focus:ring-brand-orange-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white dark:focus:ring-brand-neon-lime"
      />
    </label>
  );
}

function CheckBox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex items-start gap-2 text-sm font-bold text-gray-700 dark:text-gray-200">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 rounded border-gray-300 text-brand-orange-500 focus:ring-brand-orange-500 dark:border-gray-600"
      />
      <span>{label}</span>
    </label>
  );
}

function Pair({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs text-gray-500 dark:text-gray-400">{label}</dt><dd className="mt-0.5 font-bold text-gray-900 dark:text-white">{value}</dd></div>;
}

function StatusBox({ icon, text, retry }: { icon: string; text: string; retry?: boolean }) {
  return (
    <div className="bg-gray-50 px-4 py-12 dark:bg-gray-900">
      <div className="mx-auto max-w-3xl rounded-2xl border border-gray-200 bg-white p-10 text-center dark:border-gray-700 dark:bg-gray-800">
        <span className="material-symbols-outlined text-4xl text-gray-400" aria-hidden="true">{icon}</span>
        <p className="mt-3 text-gray-600 dark:text-gray-300">{text}</p>
        {retry && <button type="button" onClick={() => location.reload()} className="mt-4 min-h-11 rounded-xl border border-gray-300 px-5 font-bold">다시 시도</button>}
      </div>
    </div>
  );
}
