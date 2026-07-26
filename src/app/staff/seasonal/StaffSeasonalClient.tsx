"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { startClassSession } from "@/app/actions/staff-sessions";

// 특강 회차 1건(카드 1장). page.tsx가 내려주는 dates 배열의 원소와 동일한 형태.
type SeasonalDate = {
  sessionDateId: string;
  offeringTitle: string;
  dateLabel: string;
  dayLabel: string;
  startTime: string;
  endTime: string;
  capacity: number | null;
  instructorName: string | null;
  scheduled: number;
  unchecked: number;
  linkedClassId: string | null;
  sessionId: string | null;
  sessionStatus: "PLANNED" | "IN_PROGRESS" | "COMPLETED" | null;
};

async function getJSON(url: string) {
  const r = await fetch(url, { cache: "no-store" });
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error || "요청 실패");
  return j;
}

export default function StaffSeasonalClient({ initial }: { initial: { ymd: string; dates: SeasonalDate[] } }) {
  const router = useRouter();
  const [ymd, setYmd] = useState<string>(initial.ymd);
  const [dates, setDates] = useState<SeasonalDate[]>(initial.dates || []);
  const [err, setErr] = useState("");
  // 어떤 카드에서 "수업 시작"이 진행 중인지(중복 클릭·로딩 표시용)
  const [startingId, setStartingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // 날짜 이동 시 그 날짜의 특강 회차 목록을 다시 불러온다(상태·sessionId 포함).
  const loadDay = useCallback(async (d: string) => {
    setErr("");
    try {
      const data = await getJSON(`/api/staff/seasonal?date=${d}`);
      setDates(data.dates || []);
      setYmd(data.ymd);
    } catch (e) {
      setErr((e as Error).message);
    }
  }, []);

  function shiftDay(delta: number) {
    const d = new Date(ymd + "T00:00:00+09:00");
    d.setDate(d.getDate() + delta);
    const next = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
    void loadDay(next);
  }

  // 정규 수업 시작과 완전히 동일한 흐름:
  // startClassSession(정규 서버액션) 호출 → 반환된 sessionId로 통합 진행화면 이동.
  // 이미 다른 수업이 진행 중이면 ACTIVE_SESSION 코드로 그 세션으로 라우팅한다(홈 startLesson과 동일).
  function startLesson(row: SeasonalDate) {
    if (!row.linkedClassId) {
      setErr("이 특강은 연결된 수업 정보가 없어 시작할 수 없습니다. 관리자에게 문의해 주세요.");
      return;
    }
    setErr("");
    setStartingId(row.sessionDateId);
    startTransition(async () => {
      const result = await startClassSession({
        classId: row.linkedClassId as string,
        date: ymd,
        sessionDateId: row.sessionDateId,
      });
      if (!result.ok) {
        if (result.code === "ACTIVE_SESSION" && result.activeSessionId) {
          router.push(`/staff/sessions/${result.activeSessionId}`);
          return;
        }
        setErr(result.message);
        setStartingId(null);
        return;
      }
      router.push(`/staff/sessions/${result.sessionId}?view=attendance`);
    });
  }

  return (
    <div className="mx-auto max-w-lg p-4">
      <h1 className="mb-3 text-lg font-black dark:text-white">🏀 특강 수업</h1>

      {/* 날짜 네비(정규와 동일하게 유지, 오늘 기본) */}
      <div className="mb-3 flex items-center justify-between rounded-xl border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-800">
        <button onClick={() => shiftDay(-1)} className="min-h-9 px-3 font-black text-gray-500">‹</button>
        <span className="text-sm font-black dark:text-white">{ymd}</span>
        <button onClick={() => shiftDay(1)} className="min-h-9 px-3 font-black text-gray-500">›</button>
      </div>

      {err && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-bold text-red-700 dark:bg-red-950 dark:text-red-300">{err}</div>}

      <div className="space-y-3">
        {dates.map((d) => {
          const status = d.sessionStatus;
          const busy = pending && startingId === d.sessionDateId;
          return (
            <article key={d.sessionDateId} className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-black dark:text-white">{d.offeringTitle}</div>
                  <div className="mt-0.5 text-xs font-bold text-gray-500">{d.startTime}~{d.endTime} · 학생 {d.scheduled}명</div>
                </div>
                <StatusBadge status={status} />
              </div>

              <div className="mt-3">
                {status === "IN_PROGRESS" && d.sessionId ? (
                  // 진행 중: 통합 진행화면으로 바로 이어하기
                  <button
                    type="button"
                    onClick={() => router.push(`/staff/sessions/${d.sessionId}`)}
                    className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand-accent)] px-4 font-black text-[var(--brand-accent-contrast)]"
                  >
                    <span className="material-symbols-outlined">arrow_forward</span>
                    수업 이어하기
                  </button>
                ) : status === "COMPLETED" ? (
                  // 완료: 배지 + (세션 있으면) 기록 보기
                  d.sessionId ? (
                    <button
                      type="button"
                      onClick={() => router.push(`/staff/sessions/${d.sessionId}`)}
                      className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 font-bold text-gray-600 dark:border-gray-600 dark:text-gray-300"
                    >
                      <span className="material-symbols-outlined text-lg">history</span>
                      기록 보기
                    </button>
                  ) : null
                ) : (
                  // 시작 전(PLANNED 또는 세션 미생성): 수업 시작
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => startLesson(d)}
                    className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand-accent)] px-4 font-black text-[var(--brand-accent-contrast)] disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined">play_arrow</span>
                    {busy ? "시작 중…" : "수업 시작"}
                  </button>
                )}
              </div>
            </article>
          );
        })}

        {dates.length === 0 && (
          <div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-400 dark:border-gray-700">
            이 날짜에 특강 수업이 없습니다.
          </div>
        )}
      </div>
    </div>
  );
}

// 회차 상태 배지(정규 홈의 StatusBadge와 동일한 문구 체계)
function StatusBadge({ status }: { status: SeasonalDate["sessionStatus"] }) {
  const text = status === "COMPLETED" ? "완료" : status === "IN_PROGRESS" ? "수업 중" : "시작 전";
  const tone =
    status === "IN_PROGRESS"
      ? "bg-[var(--brand-accent)] text-[var(--brand-accent-contrast)]"
      : status === "COMPLETED"
        ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"
        : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300";
  return <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-black ${tone}`}>{text}</span>;
}
