"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ParentMakeupOverview, ParentCredit, MakeupOption } from "@/lib/makeup/parent-makeup";
import { fetchMakeupOptions, bookMakeupAction, cancelMakeupAction } from "@/app/actions/parent-makeup";

const DOW_KO: Record<string, string> = {
  Mon: "월", Tue: "화", Wed: "수", Thu: "목", Fri: "금", Sat: "토", Sun: "일",
};

/** 상태 뱃지 — 학부모가 한눈에 "쓸 수 있나"를 알아야 한다. */
function statusBadge(c: ParentCredit, expired: boolean) {
  if (expired) return { label: "기간 만료", cls: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400" };
  switch (c.status) {
    case "AVAILABLE": return { label: "사용 가능", cls: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200" };
    case "RESERVED":  return { label: "예약 완료", cls: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200" };
    case "USED":      return { label: "보강 완료", cls: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300" };
    case "NO_SHOW":   return { label: "무단 불참", cls: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" };
    case "REVOKED":   return { label: "출결 정정", cls: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400" };
    default:          return { label: "기간 만료", cls: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400" };
  }
}

export default function MakeupClient({ initial }: { initial: ParentMakeupOverview }) {
  const router = useRouter();
  const [openId, setOpenId] = useState("");            // 반 선택이 열린 보강권
  const [options, setOptions] = useState<MakeupOption[]>([]);
  const [pick, setPick] = useState<{ classId: string; ymd: string } | null>(null);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  const today = new Date().toISOString().slice(0, 10);

  // 보강권을 펼치면서 그 학생이 갈 수 있는 반을 불러온다.
  const open = useCallback(async (credit: ParentCredit) => {
    if (openId === credit.id) { setOpenId(""); return; }
    setErr(""); setMsg(""); setPick(null); setOptions([]);
    setOpenId(credit.id);
    setBusy(credit.id);
    try {
      const r = await fetchMakeupOptions(credit.id);
      if (!r.ok) { setErr(r.message || "불러오지 못했습니다."); setOpenId(""); return; }
      setOptions(r.options || []);
    } catch {
      setErr("불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
      setOpenId("");
    } finally {
      setBusy("");
    }
  }, [openId]);

  const book = useCallback(async (creditId: string) => {
    if (!pick) { setErr("보강받을 수업과 날짜를 골라 주세요."); return; }
    setErr(""); setMsg(""); setBusy(creditId);
    try {
      const r = await bookMakeupAction({ creditId, classId: pick.classId, dateYmd: pick.ymd });
      if (!r.ok) { setErr(r.message); return; }
      setMsg(r.message);
      setOpenId(""); setPick(null);
      router.refresh();
    } finally {
      setBusy("");
    }
  }, [pick, router]);

  const cancel = useCallback(async (creditId: string) => {
    setErr(""); setMsg(""); setBusy(creditId);
    try {
      const r = await cancelMakeupAction(creditId);
      if (!r.ok) { setErr(r.message); return; }
      setMsg(r.message);
      router.refresh();
    } finally {
      setBusy("");
    }
  }, [router]);

  const { counts, credits } = initial;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      {/* 헤더 */}
      <div className="mb-2 flex items-center gap-2">
        <Link href="/mypage" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
          <span className="material-symbols-outlined">arrow_back</span>
        </Link>
        <h1 className="flex items-center gap-2 text-lg font-black text-brand-navy-900 dark:text-white">
          <span className="material-symbols-outlined text-brand-orange-500 dark:text-brand-neon-lime">event_repeat</span>
          보강 예약
        </h1>
      </div>
      <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">
        결석 1회당 보강권 1장이 발급됩니다. <strong>결석일로부터 2개월</strong> 안에 사용해 주세요.
        기간이 지나면 자동으로 소멸합니다.
      </p>

      {/* 잔여 집계 */}
      <div className="mb-4 grid grid-cols-4 gap-2">
        {[
          { label: "사용 가능", v: counts.available, cls: "text-green-600 dark:text-green-400" },
          { label: "예약 중", v: counts.reserved, cls: "text-blue-600 dark:text-blue-400" },
          { label: "사용 완료", v: counts.used, cls: "text-gray-600 dark:text-gray-300" },
          { label: "만료", v: counts.expired, cls: "text-gray-400 dark:text-gray-500" },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-gray-100 bg-white px-2 py-3 text-center shadow-sm dark:border-gray-800 dark:bg-gray-800">
            <div className={`text-xl font-black ${s.cls}`}>{s.v}</div>
            <div className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">{s.label}</div>
          </div>
        ))}
      </div>

      {msg && (
        <div className="mb-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-bold text-green-700 dark:border-green-900 dark:bg-green-950 dark:text-green-300">
          {msg}
        </div>
      )}
      {err && (
        <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {err}
        </div>
      )}

      {credits.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">
          발급된 보강권이 없습니다.
        </div>
      ) : (
        <div className="space-y-3">
          {credits.map((c) => {
            const expired = c.expiresYmd < today && (c.status === "AVAILABLE" || c.status === "RESERVED");
            const badge = statusBadge(c, expired);
            const canBook = c.status === "AVAILABLE" && !expired;
            return (
              <div key={c.id} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-800">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm">
                    <span className="font-black text-gray-900 dark:text-gray-100">{c.studentName}</span>
                    <span className="ml-2 text-gray-500 dark:text-gray-400">
                      {c.sourceLabel} · {c.absenceLabel} 결석
                    </span>
                  </div>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-black ${badge.cls}`}>
                    {badge.label}
                  </span>
                </div>
                <div className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">
                  사용 기한 {c.expiresLabel}까지
                </div>

                {/* 예약 완료 상태 */}
                {c.booking && c.status === "RESERVED" && (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-blue-50 px-3 py-2 dark:bg-blue-950/40">
                    <div className="text-sm font-bold text-blue-800 dark:text-blue-200">
                      {c.booking.className} · {c.booking.dateLabel}
                    </div>
                    <button
                      type="button"
                      onClick={() => cancel(c.id)}
                      disabled={busy === c.id}
                      className="rounded-lg border border-blue-200 px-3 py-1 text-xs font-black text-blue-700 disabled:opacity-50 dark:border-blue-800 dark:text-blue-300"
                    >
                      예약 취소
                    </button>
                  </div>
                )}

                {/* 예약하기 */}
                {canBook && (
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={() => open(c)}
                      disabled={busy === c.id}
                      className="w-full rounded-xl bg-brand-navy-900 px-4 py-2.5 text-sm font-black text-white disabled:opacity-50 dark:bg-brand-neon-lime dark:text-gray-900"
                    >
                      {openId === c.id ? "닫기" : "보강 예약하기"}
                    </button>

                    {openId === c.id && (
                      <div className="mt-3 space-y-2">
                        {busy === c.id && options.length === 0 && (
                          <p className="text-xs text-gray-500 dark:text-gray-400">수업을 불러오는 중…</p>
                        )}
                        {busy !== c.id && options.length === 0 && (
                          <p className="rounded-xl bg-gray-50 px-3 py-4 text-center text-xs text-gray-500 dark:bg-gray-900 dark:text-gray-400">
                            지금 예약할 수 있는 수업이 없습니다. 학원으로 문의해 주세요.
                          </p>
                        )}
                        {options.map((o) => (
                          <div key={o.classId} className="rounded-xl border border-gray-100 p-3 dark:border-gray-700">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="text-sm font-black text-gray-900 dark:text-gray-100">
                                {o.className}
                                <span className="ml-2 text-xs font-bold text-gray-500 dark:text-gray-400">
                                  {DOW_KO[o.dayOfWeek] ?? o.dayOfWeek} {o.startTime}
                                  {o.endTime ? `~${o.endTime}` : ""}
                                </span>
                              </div>
                              <span className="text-[11px] font-black text-gray-500 dark:text-gray-400">
                                {o.remaining}자리 남음
                              </span>
                            </div>
                            <div className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">
                              대상 학년 {o.grades.join("·")}
                            </div>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {o.dates.map((d) => {
                                const on = pick?.classId === o.classId && pick?.ymd === d.ymd;
                                return (
                                  <button
                                    key={d.ymd}
                                    type="button"
                                    onClick={() => setPick({ classId: o.classId, ymd: d.ymd })}
                                    className={`rounded-lg border px-2.5 py-1 text-xs font-black ${
                                      on
                                        ? "border-brand-navy-900 bg-brand-navy-900 text-white dark:border-brand-neon-lime dark:bg-brand-neon-lime dark:text-gray-900"
                                        : "border-gray-200 text-gray-600 dark:border-gray-700 dark:text-gray-300"
                                    }`}
                                  >
                                    {d.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                        {options.length > 0 && (
                          <button
                            type="button"
                            onClick={() => book(c.id)}
                            disabled={busy === c.id || !pick}
                            className="w-full rounded-xl bg-brand-orange-500 px-4 py-2.5 text-sm font-black text-white disabled:opacity-40"
                          >
                            이 날짜로 예약
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-5 text-[11px] leading-relaxed text-gray-400 dark:text-gray-500">
        · 보강은 학년이 맞는 다른 수업으로만 예약할 수 있습니다.<br />
        · 예약을 미리 취소하면 보강권은 그대로 유지됩니다.<br />
        · 예약 후 알리지 않고 오지 않으면 보강권을 사용한 것으로 처리됩니다.
      </p>
    </div>
  );
}
