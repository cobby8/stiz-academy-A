"use client";

import { useEffect, useState } from "react";
import type { StudentDetail } from "@/lib/seasonal/student-detail";

// 방학특강 수강생 상세 — 여러 화면에서 공통으로 쓰는 모달.
// applicationId만 주면 서버에서 학생·보호자·수강 수업·셔틀 정보를 불러와 정리해 보여준다.

function digits(p: string | null): string | null { if (!p) return null; const d = p.replace(/[^0-9]/g, ""); return d.length >= 9 ? d : null; }

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 py-1.5">
      <span className="shrink-0 text-[12px] font-bold text-gray-400">{label}</span>
      <span className="text-right text-[13px] font-semibold text-gray-800 dark:text-gray-100">{value ?? "-"}</span>
    </div>
  );
}

function ContactRow({ label, phone }: { label: string; phone: string | null }) {
  const d = digits(phone);
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl border border-gray-200 px-3 py-2 dark:border-gray-700">
      <div><div className="text-[11px] font-bold text-gray-400">{label}</div><div className="text-[13px] font-bold text-gray-800 dark:text-gray-100">{phone || "미등록"}</div></div>
      {d && (
        <div className="flex gap-1.5">
          <a href={`tel:${d}`} className="rounded-lg bg-green-600 px-3 py-1.5 text-[12px] font-black text-white">전화</a>
          <a href={`sms:${d}`} className="rounded-lg bg-blue-600 px-3 py-1.5 text-[12px] font-black text-white">문자</a>
        </div>
      )}
    </div>
  );
}

export default function StudentDetailModal({ applicationId, onClose }: { applicationId: string; onClose: () => void }) {
  const [detail, setDetail] = useState<StudentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true); setErr(null);
    fetch(`/api/admin/seasonal/student-detail?applicationId=${encodeURIComponent(applicationId)}`, { cache: "no-store" })
      .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
      .then(({ ok, j }) => { if (!alive) return; if (!ok) throw new Error(j?.error || "실패"); setDetail(j.detail); })
      .catch((e) => { if (alive) setErr(e?.message || "실패"); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [applicationId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  const c = detail?.child;
  const sh = detail?.shuttle;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 sm:items-center sm:p-4" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="flex max-h-[94dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl dark:bg-gray-800 sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-center justify-between border-b border-gray-200 px-5 py-3.5 dark:border-gray-700">
          <div>
            <p className="text-[11px] font-bold text-brand-orange-500 dark:text-brand-neon-lime">수강생 상세</p>
            <h2 className="text-lg font-black text-gray-900 dark:text-white">{c?.name ?? "학생"} {c?.grade ? <span className="text-sm font-bold text-gray-400">· {c.grade}{c.gender ? ` · ${c.gender}` : ""}</span> : null}</h2>
          </div>
          <button onClick={onClose} aria-label="닫기" className="grid size-9 place-items-center rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700">✕</button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {loading && <div className="py-10 text-center text-sm text-gray-400">불러오는 중…</div>}
          {err && <div className="rounded-xl bg-red-50 px-3 py-2 text-sm font-bold text-red-600">⚠ {err}</div>}

          {detail && (
            <>
              <section className="rounded-2xl border border-gray-200 p-4 dark:border-gray-700">
                <h3 className="mb-1 text-[13px] font-black text-gray-900 dark:text-white">학생 정보</h3>
                <div className="divide-y divide-gray-100 dark:divide-gray-700/60">
                  <Field label="이름" value={c?.name} />
                  <Field label="학년 · 성별" value={[c?.grade, c?.gender].filter(Boolean).join(" · ") || "-"} />
                  <Field label="생년월일" value={c?.birthDate} />
                  <Field label="학교" value={c?.school} />
                </div>
              </section>

              <section className="rounded-2xl border border-gray-200 p-4 dark:border-gray-700">
                <h3 className="mb-2 text-[13px] font-black text-gray-900 dark:text-white">연락처</h3>
                <div className="space-y-2">
                  <ContactRow label={`보호자${detail.parent.name ? ` · ${detail.parent.name}${detail.parent.relation ? `(${detail.parent.relation})` : ""}` : ""}`} phone={detail.parent.phone} />
                  <ContactRow label="학생" phone={c?.phone ?? null} />
                </div>
              </section>

              <section className="rounded-2xl border border-gray-200 p-4 dark:border-gray-700">
                <h3 className="mb-2 text-[13px] font-black text-gray-900 dark:text-white">수강 수업</h3>
                {detail.classes.length === 0 ? <p className="text-[12px] text-gray-400">수강 수업 없음</p> : (
                  <ul className="space-y-1.5">
                    {detail.classes.map((cl, i) => (
                      <li key={i} className="flex items-center justify-between gap-2 rounded-xl bg-gray-50 px-3 py-2 dark:bg-gray-900/50">
                        <span className="text-[13px] font-bold text-gray-800 dark:text-gray-100">{cl.title}</span>
                        <span className="text-[12px] font-semibold text-gray-500">{[detail.application.weekdayLabel, cl.classStart && cl.classEnd ? `${cl.classStart}~${cl.classEnd}` : cl.classStart].filter(Boolean).join(" · ")}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {detail.application.applicantType && <p className="mt-2 text-[11px] text-gray-400">신청자 구분: {detail.application.applicantType === "EXISTING" ? "기존 회원" : detail.application.applicantType === "NEW" ? "신규 회원" : detail.application.applicantType}</p>}
              </section>

              <section className="rounded-2xl border border-gray-200 p-4 dark:border-gray-700">
                <h3 className="mb-2 text-[13px] font-black text-gray-900 dark:text-white">셔틀</h3>
                {!sh || !sh.ride ? <p className="text-[12px] text-gray-400">셔틀 미이용</p> : (
                  <div className="divide-y divide-gray-100 dark:divide-gray-700/60">
                    <Field label="등원(승차)" value={<span>{sh.pickupLocation || "미지정"} {sh.pickupPinned ? <span className="ml-1 rounded bg-green-100 px-1 text-[10px] font-black text-green-700">핀</span> : sh.pickupApprox ? <span className="ml-1 rounded bg-amber-100 px-1 text-[10px] font-black text-amber-700">추정</span> : null}</span>} />
                    <Field label="하원(하차)" value={sh.dropoffSameAsPickup ? "등원과 동일" : <span>{sh.dropoffLocation || "미지정"} {sh.dropoffPinned ? <span className="ml-1 rounded bg-green-100 px-1 text-[10px] font-black text-green-700">핀</span> : sh.dropoffApprox ? <span className="ml-1 rounded bg-amber-100 px-1 text-[10px] font-black text-amber-700">추정</span> : null}</span>} />
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
