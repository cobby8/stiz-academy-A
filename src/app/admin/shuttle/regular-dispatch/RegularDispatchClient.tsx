"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import RouteSection from "@/components/seasonal/RouteSection";
import type { DispatchSuggestion } from "@/lib/seasonal/shuttle-optimize";

// 정규 셔틀 동적배차 — 요일별로 관리한다. 요일 탭을 고르면 그 요일의 등원 → 하원 노선을 함께 보여준다.
// 방학특강 배차 화면(DispatchClient)과 동일 UX 를 재사용하되, 관리 단위가 "날짜"가 아니라 "요일"이다.
// RouteSection 에 apiBase="/api/admin/regular/dispatch" 를 주입해 정규 저장/불러오기/재계산 엔드포인트를 태운다.
// 명단 편집(무료탑승 드래그·학생 상세 모달)은 방학특강 전용이라 rosterEditable=false 로 끈다.

const REGULAR_API = "/api/admin/regular/dispatch";
const DOW_LABEL: Record<string, string> = {
  Mon: "월요일", Tue: "화요일", Wed: "수요일", Thu: "목요일", Fri: "금요일", Sat: "토요일", Sun: "일요일",
};

export default function RegularDispatchClient({ weekdays, initialDay, initialPickup, initialDropoff, serviceMonth, months, classTimeMismatches }: {
  weekdays: string[];            // 셔틀 학생이 있는 요일 목록("Mon" 등, 월→일 정렬)
  initialDay: string;            // 최초 표시 요일
  initialPickup: DispatchSuggestion;
  initialDropoff: DispatchSuggestion;
  serviceMonth: string;
  months: string[];
  classTimeMismatches: { dayOfWeek: string; studentName: string; pickupClassTime: string | null; dropoffClassTime: string | null }[];
}) {
  const router = useRouter();
  const [day, setDay] = useState<string>(initialDay);
  const [timelinePickup, setTimelinePickup] = useState<DispatchSuggestion>(initialPickup);
  const [timelineDropoff, setTimelineDropoff] = useState<DispatchSuggestion>(initialDropoff);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineError, setTimelineError] = useState<string | null>(null);
  const visibleMismatches = classTimeMismatches.filter((row) => row.dayOfWeek === day);
  const timelineRows = useMemo(() => buildTimelineRows(timelinePickup, timelineDropoff), [timelinePickup, timelineDropoff]);

  useEffect(() => {
    if (day === initialDay) {
      setTimelinePickup(initialPickup);
      setTimelineDropoff(initialDropoff);
      return;
    }
    let cancelled = false;
    async function load(direction: "PICKUP" | "DROPOFF") {
      const response = await fetch(REGULAR_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ direction, date: day, serviceMonth }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error || "노선을 불러오지 못했습니다.");
      return json as DispatchSuggestion;
    }
    setTimelineLoading(true);
    setTimelineError(null);
    Promise.all([load("PICKUP"), load("DROPOFF")])
      .then(([pickup, dropoff]) => {
        if (cancelled) return;
        setTimelinePickup(pickup);
        setTimelineDropoff(dropoff);
      })
      .catch((error: unknown) => {
        if (!cancelled) setTimelineError(error instanceof Error ? error.message : "노선을 불러오지 못했습니다.");
      })
      .finally(() => {
        if (!cancelled) setTimelineLoading(false);
      });
    return () => { cancelled = true; };
  }, [day, initialDay, initialPickup, initialDropoff, serviceMonth]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-4">
      <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h3 className="text-base font-black text-gray-900 dark:text-white">정규 셔틀 배차 · 하루 타임라인</h3>
          <label className="flex flex-col gap-1 text-[11px] font-bold text-gray-500">배차 월
            <select value={serviceMonth} onChange={(event) => router.push(`/admin/shuttle/regular-dispatch?month=${encodeURIComponent(event.target.value)}`)} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-bold dark:border-gray-600 dark:bg-gray-900">
              {months.map((month) => <option key={month} value={month}>{month}</option>)}
            </select>
          </label>
        </div>
        {/* 조작 설명은 뺐다. 좌표의 출처(학생 신청서)는 데이터 출처 정보라 반드시 남긴다. */}
        <p className="mt-0.5 text-[12.5px] text-gray-500 dark:text-gray-400">
          좌표는 <b>학생 신청서</b>에서 자동으로 가져옵니다.
        </p>

        {/* 요일 탭 — 노선 관리 단위 */}
        <div className="mt-3 flex flex-wrap items-center gap-1 rounded-xl bg-gray-100 p-1 dark:bg-gray-900">
          {weekdays.length === 0 && <span className="px-2 py-1 text-sm font-bold text-gray-400">셔틀 이용 학생이 있는 요일이 없습니다.</span>}
          {weekdays.map((w) => (
            <button key={w} onClick={() => setDay(w)}
              className={`min-h-9 rounded-lg px-4 text-sm font-black ${day === w ? "bg-white text-brand-navy-900 shadow dark:bg-gray-700 dark:text-white" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"}`}>
              {DOW_LABEL[w] ?? w}
            </button>
          ))}
        </div>

        {visibleMismatches.length > 0 && <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-100"><p className="font-black">⚠ 등원·하원 수업시간이 다른 학생 {visibleMismatches.length}명</p><ul className="mt-1 space-y-1">{visibleMismatches.map((row) => <li key={`${row.studentName}-${row.pickupClassTime}-${row.dropoffClassTime}`}><b>{row.studentName}</b> · 등원 {row.pickupClassTime} / 하원 {row.dropoffClassTime}</li>)}</ul><p className="mt-1 font-bold">자동으로 고치지 않았습니다. 차량 시트의 수업시간을 확인해 주세요.</p></div>}

        <p className="mt-3 text-[12.5px] font-black text-gray-700 dark:text-gray-200">📅 {DOW_LABEL[day] ?? day} 시간순 노선</p>
        <div className="mt-2 overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between bg-brand-navy-900 px-4 py-2.5 text-white">
            <span className="font-black">🚐 하루 운행 흐름</span>
            <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-bold">{timelineRows.length}개 정차</span>
          </div>
          {timelineLoading && <p className="px-4 py-3 text-sm font-bold text-gray-500 dark:text-gray-300">노선을 다시 계산 중입니다…</p>}
          {timelineError && <p className="px-4 py-3 text-sm font-bold text-red-500">⚠ {timelineError}</p>}
          {!timelineLoading && !timelineError && timelineRows.length === 0 && (
            <p className="px-4 py-6 text-center text-sm font-bold text-gray-400">이 요일에 표시할 셔틀 정차가 없습니다.</p>
          )}
          {timelineRows.length > 0 && (
            <ol className="divide-y divide-gray-100 dark:divide-gray-700">
              {timelineRows.map((row, index) => (
                <li key={`${row.direction}-${row.vehicle}-${row.time}-${row.label}-${index}`} className="flex items-start gap-2.5 px-3 py-2.5">
                  <span className={`mt-0.5 rounded-full px-2 py-0.5 text-[11px] font-black ${row.direction === "PICKUP" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200" : "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-200"}`}>
                    {row.direction === "PICKUP" ? "승차" : "하차"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="text-sm font-black text-gray-900 dark:text-white">{row.time}</span>
                      <span className="truncate text-sm font-bold text-gray-700 dark:text-gray-200">{row.label}</span>
                      {row.isHub && <span className="rounded bg-green-600 px-1.5 text-[10px] font-black text-white">무료탑승</span>}
                    </div>
                    <p className="mt-0.5 text-[11.5px] font-bold text-gray-500">{row.vehicle}{row.trip ? ` · ${row.trip}` : ""} · {row.students.join(", ")}</p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>

        <details className="mt-3 rounded-2xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/40">
          <summary className="cursor-pointer text-sm font-black text-gray-800 dark:text-gray-100">방향별 세부 조정 열기</summary>
          <p className="mt-1 text-[12px] text-gray-500 dark:text-gray-400">자동 제안, 저장, 경로 재계산은 아직 등원/하원 저장본을 나눠 관리합니다. 위 시간순 노선은 실제 운행 흐름 확인용입니다.</p>
          <div className="mt-3 space-y-3">
            <RouteSection initial={initialPickup} date={day} refreshKey={0} apiBase={REGULAR_API} rosterEditable={false} serviceMonth={serviceMonth} />
            <RouteSection initial={initialDropoff} date={day} refreshKey={0} apiBase={REGULAR_API} rosterEditable={false} serviceMonth={serviceMonth} />
          </div>
        </details>
      </div>
    </div>
  );
}

function etaToMinutes(value: string | undefined | null, fallback: number | undefined | null): number {
  if (typeof fallback === "number" && Number.isFinite(fallback)) return fallback;
  const match = String(value ?? "").match(/(\d{1,2}):(\d{2})/);
  if (!match) return 9999;
  return Number(match[1]) * 60 + Number(match[2]);
}

function buildTimelineRows(pickup: DispatchSuggestion, dropoff: DispatchSuggestion) {
  const toRows = (suggestion: DispatchSuggestion, direction: "PICKUP" | "DROPOFF") => suggestion.vehicles.flatMap((vehicle) =>
    vehicle.stops.map((stop) => ({
      direction,
      time: stop.etaLabel?.match(/(\d{1,2}:\d{2})/)?.[1] ?? "--:--",
      minutes: etaToMinutes(stop.etaLabel, stop.etaManual ?? stop.etaMinutes),
      label: stop.label,
      isHub: Boolean(stop.isHub),
      vehicle: vehicle.vehicleName,
      trip: vehicle.tripLabel,
      students: stop.students.map((student) => student.grade ? `${student.name}·${student.grade}` : student.name),
    })),
  );
  return [...toRows(pickup, "PICKUP"), ...toRows(dropoff, "DROPOFF")]
    .sort((a, b) => a.minutes - b.minutes || (a.direction === "PICKUP" ? -1 : 1));
}
