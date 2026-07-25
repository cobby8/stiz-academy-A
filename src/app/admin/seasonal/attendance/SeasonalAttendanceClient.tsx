"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

type Offering = {
  id: string; seasonId: string; title: string; capacity: number | null;
  targetGrades: string | null; instructorName: string | null; dateCount: number; enrolledSlots: number;
};
type Season = { id: string; title: string; status: string };
type BoardDate = {
  sessionDateId: string; round: number; dateLabel: string; dayLabel: string; weekdayKey?: string;
  startTime: string; endTime: string;
  ymd: string; location: string | null; capacity: number | null; scheduled: number; makeup: number;
  present: number; late: number; absent: number; excused: number; unchecked: number; checked: number;
  state: "DONE" | "LIVE" | "PLANNED";
  // 그날 코트에 실제로 들어오는 전체 인원(같은 코트를 함께 쓰는 형제 반 합산) / 그 정원.
  // scheduled(이 반 인원)와 기준이 다르므로 화면에서 구분해 표시한다.
  courtOccupied?: number | null; courtCapacity?: number | null;
};
type RosterRow = {
  enrollmentDateId: string; kind: string; enrollmentStatus: string; attendanceStatus: string | null;
  arrivedAt: string | null; attendanceNote: string | null; itemId: string; childName: string;
  childGrade: string | null; childSchool: string | null; parentName: string; parentPhone: string; originAbsence: string | null;
  // 학생이 신청한 요일 (예: ["MON","WED"] / "월·수") — 날짜별 명단 인원 차이를 설명하기 위한 정보
  selectedWeekdays?: string[]; selectedWeekdayLabel?: string | null;
};

const ATT = [
  { key: "PRESENT", label: "출석", cls: "bg-green-600 text-white", soft: "text-green-700 bg-green-100 dark:text-green-300 dark:bg-green-950" },
  { key: "LATE", label: "지각", cls: "bg-amber-500 text-white", soft: "text-amber-700 bg-amber-100 dark:text-amber-300 dark:bg-amber-950" },
  { key: "ABSENT", label: "결석", cls: "bg-red-600 text-white", soft: "text-red-700 bg-red-100 dark:text-red-300 dark:bg-red-950" },
];

async function getJSON(url: string) {
  const r = await fetch(url, { cache: "no-store" });
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error || "요청 실패");
  return j;
}
async function postJSON(body: any) {
  const r = await fetch("/api/admin/seasonal/attendance", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error || "요청 실패");
  return j;
}

export default function SeasonalAttendanceClient({ initial }: { initial: { seasons: Season[]; offerings: Offering[] } }) {
  // router.refresh()는 서버 컴포넌트(상단 탭의 보강 대기 뱃지)를 다시 그리게 한다. 화면 상태는 유지된다.
  const router = useRouter();
  const [tab, setTab] = useState<"attendance" | "makeup">("attendance");
  useEffect(() => {
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("view") === "makeup") setTab("makeup");
  }, []);
  const [seasonId, setSeasonId] = useState<string>(initial.seasons[0]?.id ?? "");
  const offeringsInSeason = useMemo(
    () => initial.offerings.filter((o) => !seasonId || o.seasonId === seasonId),
    [initial.offerings, seasonId],
  );
  const [offeringId, setOfferingId] = useState<string>(offeringsInSeason[0]?.id ?? "");
  const offering = useMemo(() => initial.offerings.find((o) => o.id === offeringId) ?? null, [initial.offerings, offeringId]);

  const [board, setBoard] = useState<BoardDate[]>([]);
  const [selDate, setSelDate] = useState<string>("");
  const [roster, setRoster] = useState<RosterRow[]>([]);
  const [rosterMeta, setRosterMeta] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const [makeups, setMakeups] = useState<any>({ pending: [], assigned: [], stats: {} });
  const [modal, setModal] = useState<any>(null); // makeup-options payload

  const loadBoard = useCallback(async (oid: string) => {
    if (!oid) return;
    setErr(""); setBusy(true);
    try {
      const data = await getJSON(`/api/admin/seasonal/attendance?view=board&offeringId=${oid}`);
      setBoard(data.dates || []);
      const live = (data.dates || []).find((d: BoardDate) => d.state === "LIVE");
      const next = live?.sessionDateId || (data.dates || [])[0]?.sessionDateId || "";
      setSelDate(next);
    } catch (e) { setErr((e as Error).message); setBoard([]); } finally { setBusy(false); }
  }, []);

  const loadRoster = useCallback(async (sid: string) => {
    if (!sid) { setRoster([]); setRosterMeta(null); return; }
    setBusy(true);
    try {
      const data = await getJSON(`/api/admin/seasonal/attendance?view=roster&sessionDateId=${sid}`);
      setRoster(data.rows || []); setRosterMeta(data.date || null);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }, []);

  const loadMakeups = useCallback(async () => {
    try { setMakeups(await getJSON(`/api/admin/seasonal/attendance?view=makeups&seasonId=${seasonId}`)); }
    catch (e) { setErr((e as Error).message); }
  }, [seasonId]);

  useEffect(() => { if (offeringId) void loadBoard(offeringId); }, [offeringId, loadBoard]);
  useEffect(() => { if (selDate) void loadRoster(selDate); }, [selDate, loadRoster]);
  useEffect(() => { if (tab === "makeup") void loadMakeups(); }, [tab, loadMakeups]);
  useEffect(() => { setOfferingId(offeringsInSeason[0]?.id ?? ""); }, [seasonId]); // eslint-disable-line

  const selBoard = board.find((d) => d.sessionDateId === selDate) || null;

  async function mark(row: RosterRow, status: string) {
    const next = row.attendanceStatus === status ? null : status;
    try {
      await postJSON({ action: "attendance", enrollmentDateId: row.enrollmentDateId, status: next });
      setRoster((prev) => prev.map((r) => r.enrollmentDateId === row.enrollmentDateId ? { ...r, attendanceStatus: next } : r));
      void loadBoard(offeringId);
    } catch (e) { setErr((e as Error).message); }
  }

  async function openMakeup(row: RosterRow) {
    try { setModal(await getJSON(`/api/admin/seasonal/attendance?view=makeup-options&enrollmentDateId=${row.enrollmentDateId}`)); }
    catch (e) { setErr((e as Error).message); }
  }

  async function assignSeasonal(sessionDateId: string) {
    if (!modal) return;
    try {
      await postJSON({ action: "makeup-create", enrollmentDateId: modal.absence.enrollmentDateId, targetType: "SEASONAL", targetSessionDateId: sessionDateId });
      setModal(null); void loadBoard(offeringId); void loadRoster(selDate);
    } catch (e) { setErr((e as Error).message); }
  }
  async function assignRegular(c: any) {
    if (!modal) return;
    try {
      await postJSON({ action: "makeup-create", enrollmentDateId: modal.absence.enrollmentDateId, targetType: "REGULAR", targetClassId: c.classId, targetDate: c.nextDate });
      setModal(null); void loadRoster(selDate);
    } catch (e) { setErr((e as Error).message); }
  }
  async function decide(id: string, decision: string) {
    try {
      await postJSON({ action: "makeup-decide", makeupId: id, decision });
      void loadMakeups(); void loadBoard(offeringId);
      // 승인·거절하면 대기 건수가 줄어드므로 상단 탭 뱃지도 즉시 갱신한다.
      router.refresh();
    }
    catch (e) { setErr((e as Error).message); }
  }

  const capOf = (d: BoardDate) => d.courtCapacity ?? d.capacity ?? offering?.capacity ?? 12;
  // 정원과 직접 비교해야 하는 값은 "코트 전체 인원"이다. 서버가 값을 못 주면(구버전 응답 등)
  // 예전처럼 이 반 인원으로 대체해 화면이 깨지지 않게 한다.
  const courtOf = (d: BoardDate) => (typeof d.courtOccupied === "number" ? d.courtOccupied : null);
  const gaugeOf = (d: BoardDate) => courtOf(d) ?? d.scheduled;
  const barColor = (d: BoardDate) => {
    const cap = capOf(d); const pct = cap ? gaugeOf(d) / cap : 0;
    return pct >= 1 ? "bg-red-500" : pct >= 0.83 ? "bg-amber-500" : "bg-[var(--brand-accent)]";
  };
  // 선택한 날짜의 코트 인원/정원 — 상단 KPI와 명단 헤더에서 함께 쓴다.
  const selCourt = selBoard ? courtOf(selBoard) : null;
  const selCourtCap = selBoard ? capOf(selBoard) : null;
  const selCourtOver = selCourt != null && selCourtCap != null && selCourt > selCourtCap;

  return (
    <div className="mx-auto max-w-6xl p-4">
      {/* 페이지 제목은 상위 서버 페이지의 공통 SeasonalHeader가 담당한다(중복 방지).
          여기서는 시즌·특강 선택 드롭다운만 우측에 배치한다. */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex-1" />
        <select value={seasonId} onChange={(e) => setSeasonId(e.target.value)}
          className="min-h-10 rounded-lg border border-gray-200 bg-white px-2 text-sm font-bold dark:border-gray-700 dark:bg-gray-800">
          {initial.seasons.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
        </select>
        <select value={offeringId} onChange={(e) => setOfferingId(e.target.value)}
          className="min-h-10 rounded-lg border border-gray-200 bg-white px-2 text-sm font-bold dark:border-gray-700 dark:bg-gray-800">
          {offeringsInSeason.map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}
        </select>
      </div>

      {err && <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">{err}</div>}

      {tab === "attendance" && (
        <>
          {offering && (
            <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-800">
              <span className="text-base font-black">{offering.title}</span>
              <span className="text-xs font-bold text-gray-500">{offering.targetGrades || ""} · 운영 {offering.dateCount}일 · 담당 {offering.instructorName || "-"}</span>
              <div className="flex-1" />
              {/* 정원은 "반 1개"가 아니라 같은 코트를 함께 쓰는 반을 합친 하루 기준이라는 점을 라벨에 명시 */}
              <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-black text-orange-600 dark:bg-orange-950">코트 정원: 하루 {offering.capacity ?? 12}명</span>
            </div>
          )}

          {selBoard && (
            <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
              {/* 정원과 비교되는 숫자는 "코트 전체 인원"이다. 이 반 인원은 보조 설명으로 함께 보여준다. */}
              {selCourt != null
                ? <Kpi n={`${selCourt}/${selCourtCap}`} l={selCourtOver ? "이 날 코트 인원 · 정원 초과" : "이 날 코트 인원 · 정원"}
                    c={selCourtOver ? "text-red-600 dark:text-red-400" : ""} sub={`이 반 ${selBoard.scheduled}명`} />
                : <Kpi n={`${selBoard.scheduled}${selBoard.capacity ? "/" + selBoard.capacity : ""}`} l="이 날짜 인원" />}
              <Kpi n={selBoard.present} l="출석" c="text-green-600" />
              <Kpi n={selBoard.late} l="지각" c="text-amber-600" />
              <Kpi n={selBoard.absent} l="결석" c="text-red-600" />
              <Kpi n={selBoard.makeup} l="보강생" c="text-blue-600" />
            </div>
          )}

          <div className="mb-1 text-sm font-black">회차(날짜)별 현황 <span className="font-bold text-gray-500">· 총 {board.length}일</span></div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {board.map((d) => {
              const cap = capOf(d);
              const court = courtOf(d);          // 그날 코트 전체 인원(형제 반 합산) — 없으면 null
              const over = court != null && court > cap; // 정원 초과 여부
              return (
                <button key={d.sessionDateId} onClick={() => setSelDate(d.sessionDateId)}
                  className={`rounded-xl border bg-white p-3 text-left dark:bg-gray-800 ${selDate === d.sessionDateId ? "border-[var(--brand-accent)] ring-1 ring-[var(--brand-accent)]" : "border-gray-200 dark:border-gray-700"}`}>
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm font-black">{d.dateLabel} ({d.dayLabel})</span>
                    <span className="text-[11px] font-bold text-gray-400">{d.round}일차</span>
                  </div>
                  <div className="mt-0.5 text-[11px] font-bold text-gray-500">{d.startTime}~{d.endTime}</div>
                  {/* 두 숫자를 나눠서 보여준다: "이 반"은 이 반에서 그날 나오는 인원, "코트 전체"는 정원과 비교되는 값 */}
                  <div className="mt-2 flex justify-between text-[11px] font-black">
                    <span className="text-gray-500 dark:text-gray-400">이 반</span><span>{d.scheduled}명</span>
                  </div>
                  {court != null && (
                    <div className="mt-0.5 flex justify-between text-[11px] font-black">
                      <span className="text-gray-500 dark:text-gray-400">코트 전체</span>
                      <span className={over ? "text-red-600 dark:text-red-400" : ""}>
                        {court}/{cap}{over && <span className="ml-1">⚠ 초과</span>}
                      </span>
                    </div>
                  )}
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                    <div className={`h-full rounded-full ${barColor(d)}`} style={{ width: `${Math.min(100, cap ? (gaugeOf(d) / cap) * 100 : 0)}%` }} />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1 text-[11px] font-bold">
                    <StateBadge state={d.state} />
                    {d.present > 0 && <Pill c="green">출{d.present}</Pill>}
                    {d.late > 0 && <Pill c="amber">지{d.late}</Pill>}
                    {d.absent > 0 && <Pill c="red">결{d.absent}</Pill>}
                    {d.makeup > 0 && <Pill c="blue">보{d.makeup}</Pill>}
                    {d.unchecked > 0 && d.state !== "PLANNED" && <Pill c="gray">미확인{d.unchecked}</Pill>}
                  </div>
                </button>
              );
            })}
          </div>
          {/* 두 숫자가 서로 다른 기준임을 분명히 알린다 — 13명 > 정원 12 같은 모순으로 보이지 않도록 */}
          <p className="mt-2 px-1 text-[11px] font-bold text-gray-500">※ <b>이 반</b> = 이 반에서 그 날짜에 나오는 인원(정규+보강생)입니다.</p>
          <p className="mt-0.5 px-1 text-[11px] font-bold text-gray-500">※ <b>코트 전체</b> = 같은 시간·같은 코트를 함께 쓰는 반(주2회·주3회 등)을 모두 합쳐 그 요일에 나오는 인원이며, 뒤의 숫자가 정원입니다. 정원을 넘으면 빨간색으로 표시됩니다.</p>
          {/* 날짜별 인원이 반 전체보다 적은 이유를 안내 — 누락으로 오해하지 않도록 */}
          <p className="mt-0.5 px-1 text-[11px] font-bold text-gray-500">※ 학생마다 신청한 요일이 달라 날짜별 인원이 다를 수 있습니다.</p>

          {rosterMeta && (
            <div className="mt-4 overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
              <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 px-4 py-3 dark:border-gray-700">
                <span className="text-sm font-black">{rosterMeta.dateLabel} ({rosterMeta.dayLabel}) 명단</span>
                <span className="text-xs font-bold text-gray-500">
                  · {rosterMeta.startTime}~{rosterMeta.endTime}
                  {/* 반 명부(요일 무관)와 이 날 수강 인원을 함께 표시해 "학생 누락" 오해를 방지한다 */}
                  {typeof rosterMeta.totalApprovedStudents === "number"
                    ? ` · 반 명부 ${rosterMeta.totalApprovedStudents}명(요일 무관) · 이 날(${rosterMeta.dayLabel}) 이 반 ${roster.length}명`
                    : ` · ${roster.length}명`}
                </span>
                {/* 정원과 비교되는 값은 반 명부가 아니라 "그날 코트 전체 인원"이다 — 기준이 다름을 문구로 분리해 보여준다 */}
                {typeof rosterMeta.courtOccupied === "number" && (
                  <span className={`text-xs font-bold ${
                    rosterMeta.courtOccupied > (rosterMeta.courtCapacity ?? rosterMeta.capacity ?? 12)
                      ? "text-red-600 dark:text-red-400" : "text-gray-500"}`}>
                    · 이 날 코트 전체 {rosterMeta.courtOccupied}/{rosterMeta.courtCapacity ?? rosterMeta.capacity ?? 12}
                    {rosterMeta.courtOccupied > (rosterMeta.courtCapacity ?? rosterMeta.capacity ?? 12) ? " ⚠ 정원 초과" : ""}
                  </span>
                )}
              </div>
              <table className="w-full text-sm">
                <thead><tr className="text-[11px] uppercase text-gray-500">
                  <th className="p-2">학생</th><th className="p-2">학년</th><th className="p-2">비고</th><th className="p-2">출결</th><th className="p-2">보강</th>
                </tr></thead>
                <tbody>
                  {roster.map((r) => {
                    const cur = ATT.find((a) => a.key === r.attendanceStatus);
                    return (
                      <tr key={r.enrollmentDateId} className={`border-t border-gray-100 dark:border-gray-700 ${r.kind === "MAKEUP" ? "bg-violet-50 dark:bg-violet-950/40" : r.attendanceStatus === "ABSENT" ? "bg-red-50 dark:bg-red-950/40" : ""}`}>
                        <td className="p-2 text-center font-bold">
                          {r.childName}{r.kind === "MAKEUP" && <span className="ml-1 rounded bg-violet-100 px-1 text-[10px] font-black text-violet-700 dark:bg-violet-900 dark:text-violet-200">보강생</span>}
                          {/* 학생이 신청한 요일 뱃지 — 왜 이 학생이 특정 날짜에만 보이는지 알 수 있게 한다 */}
                          {r.selectedWeekdayLabel && (
                            <div className="mt-0.5">
                              <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-black text-gray-600 dark:bg-gray-700 dark:text-gray-200">
                                신청 {r.selectedWeekdayLabel}
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="p-2 text-center text-gray-600 dark:text-gray-300">{r.childGrade || "-"}</td>
                        <td className="p-2 text-center text-xs text-gray-500">{r.kind === "MAKEUP" && r.originAbsence ? `← ${r.originAbsence} 결석분` : "-"}</td>
                        <td className="p-2">
                          <div className="flex justify-center gap-1">
                            {ATT.map((a) => (
                              <button key={a.key} onClick={() => mark(r, a.key)}
                                className={`min-h-8 rounded-lg px-2 text-xs font-black ${r.attendanceStatus === a.key ? a.cls : "border border-gray-200 text-gray-500 dark:border-gray-600"}`}>{a.label}</button>
                            ))}
                          </div>
                        </td>
                        <td className="p-2 text-center">
                          {r.kind === "REGULAR" && r.attendanceStatus === "ABSENT"
                            ? <button onClick={() => openMakeup(r)} className="min-h-8 rounded-lg bg-[var(--brand-accent)] px-2 text-xs font-black text-[var(--brand-accent-contrast)]">보강 배정</button>
                            : <span className="text-xs text-gray-400">{cur ? cur.label : "-"}</span>}
                        </td>
                      </tr>
                    );
                  })}
                  {roster.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-sm text-gray-400">이 날짜에 배정된 학생이 없습니다.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab === "makeup" && (
        <MakeupTab makeups={makeups} onDecide={decide} />
      )}

      {modal && <MakeupModal modal={modal} onClose={() => setModal(null)} onSeasonal={assignSeasonal} onRegular={assignRegular} />}
    </div>
  );
}

// sub: 보조 설명 한 줄(예: "이 반 6명") — 기준이 다른 두 숫자를 한 카드에 같이 보여줄 때 쓴다.
function Kpi({ n, l, c, sub }: { n: any; l: string; c?: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 dark:border-gray-700 dark:bg-gray-800">
      <div className={`text-xl font-black ${c || ""}`}>{n}</div>
      <div className="mt-1 text-[11px] font-bold text-gray-500">{l}</div>
      {sub && <div className="mt-0.5 text-[11px] font-bold text-gray-400 dark:text-gray-500">{sub}</div>}
    </div>
  );
}
function Pill({ c, children }: { c: string; children: any }) {
  const m: Record<string, string> = {
    green: "text-green-700 bg-green-100 dark:text-green-300 dark:bg-green-950",
    amber: "text-amber-700 bg-amber-100 dark:text-amber-300 dark:bg-amber-950",
    red: "text-red-700 bg-red-100 dark:text-red-300 dark:bg-red-950",
    blue: "text-blue-700 bg-blue-100 dark:text-blue-300 dark:bg-blue-950",
    gray: "text-gray-600 bg-gray-100 dark:text-gray-300 dark:bg-gray-700",
  };
  return <span className={`rounded px-1.5 py-0.5 ${m[c]}`}>{children}</span>;
}
function StateBadge({ state }: { state: string }) {
  if (state === "DONE") return <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-black text-green-700 dark:bg-green-950 dark:text-green-300">완료</span>;
  if (state === "LIVE") return <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-black text-orange-600 dark:bg-orange-950">진행중</span>;
  return <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-black text-gray-500 dark:bg-gray-700">예정</span>;
}

function MakeupTab({ makeups, onDecide }: { makeups: any; onDecide: (id: string, d: string) => void }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <Kpi n={makeups.pending?.length ?? 0} l="승인 대기" c="text-red-600" />
        <Kpi n={makeups.stats?.scheduled ?? 0} l="보강 예정" c="text-blue-600" />
        <Kpi n={makeups.stats?.attended ?? 0} l="보강 완료" c="text-green-600" />
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <div className="border-b border-gray-200 px-4 py-3 text-sm font-black dark:border-gray-700">🔔 학부모 보강신청 · 승인 대기</div>
        {(makeups.pending || []).map((m: any) => (
          <div key={m.id} className="flex flex-wrap items-center gap-3 border-t border-gray-100 px-4 py-3 first:border-t-0 dark:border-gray-700">
            <div className="min-w-[180px] flex-1">
              <div className="font-black">{m.childName} <span className="text-xs font-bold text-gray-500">{m.childGrade || ""} · {m.offeringTitle}</span></div>
              <div className="mt-0.5 text-xs font-bold text-gray-500">{m.absentLabel} 결석 <span className="text-[var(--brand-accent)]">→</span> {m.targetLabel || "정규수업"}</div>
            </div>
            {m.targetFilled != null && <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-black text-green-700 dark:bg-green-950 dark:text-green-300">{m.targetFilled}/{m.targetCapacity} · 여유</span>}
            <div className="flex gap-1">
              <button onClick={() => onDecide(m.id, "REJECT")} className="min-h-9 rounded-lg border border-gray-200 px-3 text-xs font-black dark:border-gray-600">거절</button>
              <button onClick={() => onDecide(m.id, "APPROVE")} className="min-h-9 rounded-lg bg-[var(--brand-accent)] px-3 text-xs font-black text-[var(--brand-accent-contrast)]">승인</button>
            </div>
          </div>
        ))}
        {(makeups.pending || []).length === 0 && <div className="p-6 text-center text-sm text-gray-400">대기 중인 보강신청이 없습니다.</div>}
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <div className="border-b border-gray-200 px-4 py-3 text-sm font-black dark:border-gray-700">📅 배정된 보강</div>
        <table className="w-full text-sm">
          <thead><tr className="text-[11px] uppercase text-gray-500"><th className="p-2">학생</th><th className="p-2">원 결석</th><th className="p-2">보강</th><th className="p-2">유형</th><th className="p-2">상태</th><th className="p-2">작업</th></tr></thead>
          <tbody>
            {(makeups.assigned || []).map((m: any) => (
              <tr key={m.id} className="border-t border-gray-100 dark:border-gray-700">
                <td className="p-2 text-center font-bold">{m.childName}</td>
                <td className="p-2 text-center">{m.absentLabel}</td>
                <td className="p-2 text-center">{m.targetLabel}</td>
                <td className="p-2 text-center text-xs">{m.targetType === "SEASONAL" ? "특강" : "정규수업"}</td>
                <td className="p-2 text-center text-xs font-black">{({ SCHEDULED: "예정", ATTENDED: "완료", NO_SHOW: "미출석" } as any)[m.status] || m.status}</td>
                <td className="p-2 text-center">
                  <div className="flex justify-center gap-1">
                    {m.status === "SCHEDULED" && <button onClick={() => onDecide(m.id, "ATTENDED")} className="min-h-8 rounded-lg border border-gray-200 px-2 text-xs font-black dark:border-gray-600">출석확정</button>}
                    <button onClick={() => onDecide(m.id, "CANCEL")} className="min-h-8 rounded-lg border border-gray-200 px-2 text-xs font-bold text-red-600 dark:border-gray-600">취소</button>
                  </div>
                </td>
              </tr>
            ))}
            {(makeups.assigned || []).length === 0 && <tr><td colSpan={6} className="p-6 text-center text-sm text-gray-400">배정된 보강이 없습니다.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MakeupModal({ modal, onClose, onSeasonal, onRegular }: { modal: any; onClose: () => void; onSeasonal: (id: string) => void; onRegular: (c: any) => void }) {
  const a = modal.absence;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="max-h-[88vh] w-full max-w-lg overflow-auto rounded-2xl bg-white dark:bg-gray-800" onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 px-5 py-4 dark:border-gray-700">
          <span className="text-base font-black">🔄 보강 배정</span>
          <span className="text-xs font-bold text-gray-500">· {a.childName} ({a.childGrade || "-"}) · {a.absentLabel} 결석</span>
          <div className="flex-1" />
          <button onClick={onClose} className="text-gray-400">✕</button>
        </div>
        <div className="p-5">
          {modal.alreadyAssigned ? (
            <div className="rounded-xl bg-amber-50 p-4 text-sm font-bold text-amber-700 dark:bg-amber-950 dark:text-amber-200">이미 보강이 배정된 결석입니다.</div>
          ) : (
            <>
              <div className="mb-2 text-sm font-black">① 같은 특강의 다른 날짜 <span className="font-bold text-gray-500">· 정원 여유 있는 날만</span></div>
              {modal.seasonalCandidates.length === 0 && <div className="mb-3 rounded-lg bg-gray-50 p-3 text-xs font-bold text-gray-500 dark:bg-gray-900">2개월 이내 여유 날짜가 없습니다. 아래 정규수업으로 배정하세요.</div>}
              {modal.seasonalCandidates.map((s: any) => (
                <button key={s.sessionDateId} onClick={() => onSeasonal(s.sessionDateId)}
                  className="mb-2 flex w-full items-center gap-3 rounded-xl border border-gray-200 p-3 text-left hover:border-[var(--brand-accent)] dark:border-gray-700">
                  <div className="font-black">{s.label}</div>
                  <div className="flex-1" />
                  <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-black text-green-700 dark:bg-green-950 dark:text-green-300">{s.filled}/{s.capacity} · 여유 {s.remaining}</span>
                </button>
              ))}

              <div className="mb-2 mt-4 text-sm font-black">② 정규수업으로 보강 <span className="font-bold text-gray-500">· 학년 구성 비슷한 반 추천</span></div>
              {modal.regularCandidates.length === 0 && <div className="mb-2 rounded-lg bg-gray-50 p-3 text-xs font-bold text-gray-500 dark:bg-gray-900">추천 가능한 정규수업이 없습니다.</div>}
              {modal.regularCandidates.map((c: any) => (
                <button key={c.classId} onClick={() => onRegular(c)}
                  className="mb-2 flex w-full items-center gap-3 rounded-xl border border-gray-200 p-3 text-left hover:border-[var(--brand-accent)] dark:border-gray-700">
                  <div>
                    <div className="font-black">{c.nextLabel} · {c.name}{c.gradeDiff != null && <span className="ml-1 rounded bg-green-100 px-1 text-[10px] font-black text-green-700 dark:bg-green-950 dark:text-green-300">유사학년</span>}</div>
                    <div className="mt-0.5 text-xs font-bold text-gray-500">{c.schedule} · 담당 {c.instructor || "-"}</div>
                  </div>
                  <div className="flex-1" />
                  <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-black text-gray-600 dark:bg-gray-700 dark:text-gray-200">{c.enrolled}/{c.capacity ?? "-"}</span>
                </button>
              ))}

              <div className="mt-3 rounded-xl bg-gray-50 p-3 text-xs font-bold text-gray-500 dark:bg-gray-900">보강 규칙: 결석일로부터 2개월 이내(~{modal.windowEndLabel}) · 결석 1건당 보강 1건 · 정원 찬 날짜는 선택 불가.</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
