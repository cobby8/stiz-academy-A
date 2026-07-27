"use client";

import { useState } from "react";
import { tmapNavigationCoordinateUrl } from "@/lib/maps/coordinate-links";
import DriverDateNav from "@/components/shuttle/DriverDateNav";
import GpsShareBar from "@/components/shuttle/GpsShareBar";
import { useGpsShare } from "@/hooks/useGpsShare";

// 정규 셔틀 기사님 운행 화면 — 로그인 없이 토큰으로 접근. 오늘 요일의 수업별 등원·하원 타임라인.
// ★ 기사님 연세를 고려해 항상 '라이트 모드' + 큰 글자·큰 버튼(dark: 미사용). 탭 한 번으로 즉시 저장.

export type DriverRow = { rowId: string; name: string; parentPhone: string | null; studentPhone: string | null; absent?: boolean };
export type DriverStop = { label: string; arriveTime: string | null; lat: number | null; lng: number | null; direction: "BOARD" | "ALIGHT"; rows: DriverRow[] };
export type DriverClass = { classTime: string; board: DriverStop[]; alight: DriverStop[] };
// SELF = 자차(부모 차) 등·하원. 셔틀 미탑승이지만 결석(사전 신고)과는 구분한다.
type Status = "BOARDED" | "NOSHOW" | "SELF";

function digits(p: string | null): string | null { if (!p) return null; const d = p.replace(/[^0-9]/g, ""); return d.length >= 9 ? d : null; }
function fmtDate(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  const dow = ["일", "월", "화", "수", "목", "금", "토"][new Date(`${iso}T12:00:00+09:00`).getUTCDay()] ?? "";
  return `${Number(m[2])}/${Number(m[3])}${dow ? ` (${dow})` : ""}`;
}

function StopList({ stops, token, boarding, setStatus }: {
  stops: DriverStop[]; token: string; boarding: Record<string, Status>;
  setStatus: (rowId: string, name: string, next: Status) => void;
}) {
  // '미탑승'을 누르면 그 행에만 사유 선택(결석/자차)이 펼쳐진다. 열린 행의 rowId를 보관.
  const [menuKey, setMenuKey] = useState<string | null>(null);
  return (
    <ol className="space-y-2.5">
      {stops.map((s, si) => {
        const isPickup = s.direction === "BOARD";
        const url = tmapNavigationCoordinateUrl({ latitude: s.lat, longitude: s.lng, name: s.label });
        return (
          <li key={si} className="rounded-2xl border-2 border-gray-200 bg-white p-3.5">
            <div className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-orange-500 text-[15px] font-black text-white">{si + 1}</span>
              <span className="min-w-0 flex-1 text-[18px] font-black leading-tight text-gray-900">{s.label}</span>
              {s.arriveTime && <span className="shrink-0 text-[16px] font-black text-blue-600">{s.arriveTime}</span>}
            </div>
            {url && <a href={url} className="mt-2 flex h-12 items-center justify-center gap-1.5 rounded-xl bg-blue-600 text-[16px] font-black text-white active:bg-blue-700">🧭 T맵 길안내</a>}
            <div className="mt-2.5 space-y-2.5">
              {s.rows.map((st) => {
                const status = boarding[st.rowId] ?? null;
                const parent = digits(st.parentPhone), child = digits(st.studentPhone);
                const selfLabel = isPickup ? "자차등원" : "자차하원"; // 방향에 따라 자차 라벨 결정
                return (
                  <div key={st.rowId} className={`rounded-xl p-2.5 ${st.absent ? "bg-red-50 dark:bg-red-950/30" : "bg-gray-50"}`}>
                    <div className="flex items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <span className={`text-[19px] font-black ${st.absent ? "text-gray-400 line-through" : "text-gray-900"}`}>{st.name}</span>
                        {/* 사전 결석 신고 배지(당일 기사 체크와 별개) */}
                        {st.absent && <span className="ml-2 rounded-md bg-red-500 px-2 py-0.5 text-[13px] font-black text-white align-middle">오늘 결석</span>}
                        {/* 기사 체크 상태 배지 */}
                        {!st.absent && status === "NOSHOW" && <span className="ml-2 rounded-md bg-red-500 px-2 py-0.5 text-[13px] font-black text-white align-middle">결석</span>}
                        {!st.absent && status === "SELF" && <span className="ml-2 rounded-md bg-violet-600 px-2 py-0.5 text-[13px] font-black text-white align-middle">{selfLabel}</span>}
                        {!st.absent && (
                          <div className="mt-1 flex gap-3">
                            {parent && <a href={`tel:${parent}`} className="text-[15px] font-black text-blue-600">📞 학부모</a>}
                            {child && <a href={`tel:${child}`} className="text-[15px] font-black text-green-600">📞 학생</a>}
                          </div>
                        )}
                      </div>
                      {st.absent ? (
                        // 사전 결석 신고된 학생 — 태우지 않는다. 탑승 체크 버튼 대신 안내만 표시.
                        <span className="rounded-xl border-2 border-red-300 px-3 py-2 text-[15px] font-black text-red-500">미{isPickup ? "탑승" : "하차"}(결석)</span>
                      ) : (
                        <>
                          <button type="button" onClick={() => { setMenuKey(null); setStatus(st.rowId, st.name, "BOARDED"); }}
                            className={`h-14 min-w-[68px] rounded-xl text-[16px] font-black ${status === "BOARDED" ? "bg-green-600 text-white" : "border-2 border-green-400 text-green-700"}`}>{isPickup ? "탑승" : "하차"}</button>
                          <button type="button" onClick={() => setMenuKey(menuKey === st.rowId ? null : st.rowId)}
                            className={`h-14 min-w-[68px] rounded-xl text-[16px] font-black ${status === "NOSHOW" || status === "SELF" ? "bg-gray-700 text-white" : "border-2 border-gray-300 text-gray-600"}`}>미{isPickup ? "탑승" : "하차"}</button>
                        </>
                      )}
                    </div>
                    {!st.absent && menuKey === st.rowId && (
                      // 사유 선택 — 같은 항목을 다시 누르면 setStatus가 대기로 되돌린다
                      <div className="mt-2 flex gap-2">
                        <button type="button" onClick={() => { setStatus(st.rowId, st.name, "NOSHOW"); setMenuKey(null); }}
                          className={`flex-1 rounded-xl py-3 text-[16px] font-black ${status === "NOSHOW" ? "bg-red-500 text-white" : "border-2 border-red-300 text-red-600"}`}>❌ 결석(안 옴)</button>
                        <button type="button" onClick={() => { setStatus(st.rowId, st.name, "SELF"); setMenuKey(null); }}
                          className={`flex-1 rounded-xl py-3 text-[16px] font-black ${status === "SELF" ? "bg-violet-600 text-white" : "border-2 border-violet-300 text-violet-700"}`}>🚗 {selfLabel}</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export default function RegularDriverClient({ token, date, classes, initialBoarding, prevDate, nextDate, today }: {
  token: string; date: string; classes: DriverClass[]; initialBoarding: Record<string, Status>;
  prevDate: string; nextDate: string; today: string; // 정규는 달력일 ±1(항상 이동 가능)
}) {
  const [boarding, setBoarding] = useState<Record<string, Status>>(initialBoarding);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [runState, setRunState] = useState<"idle" | "running" | "ended">("idle");

  const { state: gpsState, lastSentAt, accuracy, start: gpsStart, stop: gpsStop } = useGpsShare(token, "정규 셔틀 기사님");

  function handleRunStart() { setRunState("running"); gpsStart(); }
  async function handleRunEnd() { await gpsStop(); setRunState("ended"); }

  async function setStatus(rowId: string, name: string, next: Status) {
    if (busy[rowId]) return;
    const cur = boarding[rowId] ?? null;
    const target: Status | null = cur === next ? null : next;
    setBoarding((b) => { const n = { ...b }; if (target) n[rowId] = target; else delete n[rowId]; return n; });
    setBusy((x) => ({ ...x, [rowId]: true }));
    try {
      const r = await fetch("/api/shuttle/regular-boarding", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, rowId, status: target, studentName: name }),
      });
      if (!r.ok) throw new Error();
    } catch {
      setBoarding((b) => { const n = { ...b }; if (cur) n[rowId] = cur; else delete n[rowId]; return n; });
    } finally {
      setBusy((x) => ({ ...x, [rowId]: false }));
    }
  }

  const allRows = classes.flatMap((c) => [...c.board, ...c.alight].flatMap((s) => s.rows));
  const boarded = allRows.filter((r) => boarding[r.rowId] === "BOARDED").length;

  return (
    <div className="mx-auto max-w-lg px-3 pb-28 text-gray-900" style={{ colorScheme: "light" }}>
      <header className="sticky top-0 z-10 -mx-3 mb-3 border-b border-gray-200 bg-white px-4 py-4">
        <p className="text-[20px] font-black text-gray-900">🚌 스티즈 정규 셔틀</p>
        <p className="mt-0.5 text-[15px] font-bold text-gray-600">{fmtDate(date)} · 체크 {boarded}/{allRows.length}</p>
      </header>

      {/* 운행 시작 전 */}
      {runState === "idle" && (
        <div className="mb-4 rounded-2xl border-2 border-yellow-400 bg-yellow-50 p-5 text-center">
          <p className="mb-3 text-[15px] font-bold text-gray-700">운행을 시작하면 위치가 관리자에게 공유됩니다</p>
          <button type="button" onClick={handleRunStart}
            className="h-16 w-full rounded-2xl bg-green-600 text-[20px] font-black text-white active:bg-green-700">
            🚦 운행 시작
          </button>
        </div>
      )}

      {/* 운행 중 */}
      {runState === "running" && (
        <div className="mb-3">
          <GpsShareBar gpsState={gpsState} lastSentAt={lastSentAt} accuracy={accuracy} />
          <button type="button" onClick={handleRunEnd}
            className="mt-2 h-13 w-full rounded-2xl border-2 border-red-300 bg-white py-3 text-[17px] font-black text-red-600 active:bg-red-50">
            🏁 운행 종료
          </button>
        </div>
      )}

      {/* 운행 종료 후 */}
      {runState === "ended" && (
        <div className="mb-4 rounded-2xl bg-gray-100 px-4 py-5 text-center">
          <p className="text-[17px] font-black text-gray-600">✅ 운행이 종료되었습니다</p>
        </div>
      )}

      {/* 날짜 이동 네비 — 달력일 ±1(상시 운행이라 항상 이동 가능) */}
      <DriverDateNav date={date} prevDate={prevDate} nextDate={nextDate} today={today} />

      {classes.length === 0 && <p className="rounded-2xl bg-gray-50 px-4 py-6 text-center text-[16px] font-bold text-gray-400">이 날은 운행이 없습니다.</p>}

      {classes.map((c) => (
        <section key={c.classTime} className="mb-6">
          <div className="sticky top-[68px] z-[5] -mx-1 mb-3 rounded-2xl bg-brand-navy-900 px-4 py-3 text-[18px] font-black text-white">🕒 {c.classTime} 수업</div>
          {c.board.length > 0 && (
            <div className="mb-3">
              <p className="mb-1.5 flex items-center gap-1.5 text-[16px] font-black text-blue-700">⬆ 등원(승차)</p>
              <StopList stops={c.board} token={token} boarding={boarding} setStatus={setStatus} />
            </div>
          )}
          {c.alight.length > 0 && (
            <div>
              <p className="mb-1.5 flex items-center gap-1.5 text-[16px] font-black text-orange-700">⬇ 하원(하차)</p>
              <StopList stops={c.alight} token={token} boarding={boarding} setStatus={setStatus} />
            </div>
          )}
        </section>
      ))}
      <p className="mt-3 text-center text-[14px] font-semibold text-gray-400">탭 한 번으로 저장됩니다 · 다시 누르면 대기로 돌아갑니다</p>
    </div>
  );
}
