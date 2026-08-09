"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { tmapNavigationCoordinateUrl } from "@/lib/maps/coordinate-links";
import DriverDateNav from "@/components/shuttle/DriverDateNav";
import GpsShareBar from "@/components/shuttle/GpsShareBar";
import { useGpsShare } from "@/hooks/useGpsShare";
import DriverRequestModal from "@/components/shuttle/DriverRequestModal";
import { countProgress, type UnifiedRider, type UnifiedRow } from "@/lib/shuttle/unifiedDriverRunLogic";

// 기사님 통합 운행 화면 — 그날 방학특강·정규를 **가리지 않고 출발 시각 순서대로 한 줄씩** 나열한다.
// 기사님은 위에서부터 순서대로 다니면 된다.
// ★ 기사님 연세·운전 중 한 손 조작을 고려해 라이트 모드 고정 + 큰 글자·큰 버튼(dark: 미사용).
// ⚠️ 탑승 체크는 행이 들고 있는 종류(kind)대로 **기존 API·기존 파라미터** 그대로 저장한다.

// PWA 설치 이벤트 타입 (브라우저 전용, 표준 미포함)
interface BeforeInstallPromptEvent extends Event { prompt(): Promise<void> }

// SELF = 자차(부모 차) 등·하원. 셔틀엔 안 탔지만 결석(안 옴)과는 구분한다.
type Status = "BOARDED" | "NOSHOW" | "SELF";
type ReqModal = { targetId?: string; targetName?: string; defaultType?: "REMOVE" | "LOCATION" | "ORDER" | "OTHER"; orderPayload?: unknown };
/** 순서 편집 중에만 쓰는 정렬 덮어쓰기(원본 rows 는 건드리지 않는다). */
type SortKey = { minutes: number | null; seq: number };

function digits(p: string | null): string | null { if (!p) return null; const d = p.replace(/[^0-9]/g, ""); return d.length >= 9 ? d : null; }
function fmtDate(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  const dow = ["일", "월", "화", "수", "목", "금", "토"][new Date(`${iso}T12:00:00+09:00`).getUTCDay()] ?? "";
  return `${Number(m[2])}/${Number(m[3])}${dow ? ` (${dow})` : ""}`;
}

export default function UnifiedDriverClient({
  token, date, rows, initialBoarding, prevDate, nextDate, today, driverLabel,
}: {
  token: string;
  date: string;
  rows: UnifiedRow[];
  initialBoarding: Record<string, Status>;
  prevDate: string | null;
  nextDate: string | null;
  today: string;
  driverLabel: string;
}) {
  const [boarding, setBoarding] = useState<Record<string, Status>>(initialBoarding);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [menuKey, setMenuKey] = useState<string | null>(null);
  const [runState, setRunState] = useState<"idle" | "running" | "ended">("idle");
  const [reqModal, setReqModal] = useState<ReqModal | null>(null);

  // 순서 편집 — 같은 노선(그룹) 안에서 위/아래로 옮긴다. 옮기면 정렬키(시각)까지 서로 맞바꿔
  // 시각순 목록이 어긋나지 않게 한다. 서버에는 "순서 고정 요청"으로만 전달된다(즉시 저장 아님).
  const [editing, setEditing] = useState(false);
  const [sortOverride, setSortOverride] = useState<Record<string, SortKey>>({});

  const { state: gpsState, lastSentAt, accuracy, start: gpsStart, stop: gpsStop } = useGpsShare(token, driverLabel);
  function handleRunStart() { setRunState("running"); gpsStart(); }
  async function handleRunEnd() { await gpsStop(); setRunState("ended"); }

  // PWA 설치 배너
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      deferredPromptRef.current = e as BeforeInstallPromptEvent;
      setShowInstallBanner(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);
  async function installPwa() {
    if (!deferredPromptRef.current) return;
    await deferredPromptRef.current.prompt();
    setShowInstallBanner(false);
  }

  // 화면에 그릴 순서 = 서버가 준 시각순 + (편집했다면) 바뀐 정렬키.
  const ordered = useMemo(() => {
    const keyOf = (r: UnifiedRow): SortKey => sortOverride[r.key] ?? { minutes: r.minutes, seq: r.seq };
    return [...rows].sort((a, b) => {
      const ka = keyOf(a), kb = keyOf(b);
      if (ka.minutes == null && kb.minutes == null) return ka.seq - kb.seq;
      if (ka.minutes == null) return 1;   // 시간 미정은 언제나 맨 끝
      if (kb.minutes == null) return -1;
      return ka.minutes === kb.minutes ? ka.seq - kb.seq : ka.minutes - kb.minutes;
    });
  }, [rows, sortOverride]);

  function moveRow(row: UnifiedRow, dir: -1 | 1) {
    const sameGroup = ordered.filter((r) => r.groupKey === row.groupKey && !r.isTerminal);
    const idx = sameGroup.findIndex((r) => r.key === row.key);
    const other = sameGroup[idx + dir];
    if (!other) return;
    const keyOf = (r: UnifiedRow): SortKey => sortOverride[r.key] ?? { minutes: r.minutes, seq: r.seq };
    const a = keyOf(row), b = keyOf(other);
    setSortOverride((o) => ({ ...o, [row.key]: b, [other.key]: a }));
  }

  /** 순서 고정 요청에 실어 보낼 현재 순서(노선별 정차 목록). */
  function orderPayload() {
    const groups: Record<string, { group: string; kind: string; direction: string; stops: { label: string; time: string | null }[] }> = {};
    for (const r of ordered) {
      if (r.isTerminal) continue;
      const g = groups[r.groupKey] ?? (groups[r.groupKey] = {
        group: r.groupLabel ?? (r.kind === "SEASONAL" ? "방학특강" : "정규"),
        kind: r.kind, direction: r.direction, stops: [],
      });
      g.stops.push({ label: r.label, time: r.time });
    }
    return Object.values(groups);
  }

  async function setStatus(rider: UnifiedRider, next: Status) {
    const key = rider.key;
    if (busy[key]) return;
    const cur = boarding[key] ?? null;
    const target: Status | null = cur === next ? null : next; // 같은 버튼 다시 누르면 대기로
    setBoarding((b) => { const n = { ...b }; if (target) n[key] = target; else delete n[key]; return n; });
    setBusy((x) => ({ ...x, [key]: true }));
    try {
      // 🚨 저장 경로는 종류별로 예전 그대로. 파라미터 이름·저장 키를 바꾸면 과거 기록과 끊긴다.
      const url = rider.kind === "SEASONAL" ? "/api/shuttle/boarding" : "/api/shuttle/regular-boarding";
      const body = rider.kind === "SEASONAL"
        ? { token, direction: rider.direction, shuttleRequestId: rider.checkId, status: target, studentName: rider.name, date }
        : { token, rowId: rider.checkId, status: target, studentName: rider.name, date };
      const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!r.ok) throw new Error();
    } catch {
      setBoarding((b) => { const n = { ...b }; if (cur) n[key] = cur; else delete n[key]; return n; });
    } finally {
      setBusy((x) => ({ ...x, [key]: false }));
    }
  }

  const progress = countProgress(rows, boarding);
  const stopRows = ordered.filter((r) => !r.isTerminal);
  let seq = 0;

  return (
    <div className="mx-auto max-w-lg px-3 pb-28 text-gray-900" style={{ colorScheme: "light" }}>
      <header className="sticky top-0 z-10 -mx-3 mb-3 border-b border-gray-200 bg-white px-4 py-4">
        <p className="text-[20px] font-black text-gray-900">🚌 스티즈 셔틀 운행</p>
        <p className="mt-0.5 text-[15px] font-bold text-gray-600">
          {fmtDate(date)} · 체크 {progress.boarded}/{progress.total}
          {progress.noshow > 0 ? ` · 결석 ${progress.noshow}` : ""}
          {progress.self > 0 ? ` · 자차 ${progress.self}` : ""}
        </p>
      </header>

      {/* PWA 설치 배너 */}
      {showInstallBanner && (
        <div className="mb-3 flex items-center gap-3 rounded-2xl border-2 border-indigo-300 bg-indigo-50 px-4 py-3">
          <span className="text-[28px]">📲</span>
          <div className="flex-1">
            <p className="text-[15px] font-black text-indigo-900">홈 화면에 추가하세요</p>
            <p className="text-[12px] font-semibold text-indigo-700">앱처럼 빠르게 열 수 있어요</p>
          </div>
          <button type="button" onClick={installPwa}
            className="rounded-xl bg-indigo-600 px-4 py-2 text-[14px] font-black text-white active:bg-indigo-700">설치</button>
          <button type="button" onClick={() => setShowInstallBanner(false)} className="text-[20px] text-indigo-300">✕</button>
        </div>
      )}

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

      <DriverDateNav date={date} prevDate={prevDate} nextDate={nextDate} today={today} />

      {/* 순서 편집 */}
      {stopRows.length > 0 && (
        <div className="mb-2 flex items-center justify-end gap-2">
          {!editing ? (
            <button type="button" onClick={() => setEditing(true)}
              className="rounded-xl border-2 border-gray-300 px-3 py-1.5 text-[13px] font-black text-gray-600 active:bg-gray-100">
              ↕ 순서 편집
            </button>
          ) : (
            <>
              <button type="button" onClick={() => { setReqModal({ defaultType: "ORDER", targetName: "운행 순서", orderPayload: orderPayload() }); setEditing(false); }}
                className="rounded-xl bg-blue-600 px-3 py-1.5 text-[13px] font-black text-white active:bg-blue-700">
                📨 순서 고정 요청
              </button>
              <button type="button" onClick={() => { setEditing(false); setSortOverride({}); }}
                className="rounded-xl border-2 border-gray-300 px-3 py-1.5 text-[13px] font-black text-gray-600">취소</button>
            </>
          )}
        </div>
      )}
      {editing && <p className="mb-2 rounded-xl bg-blue-50 px-3 py-2 text-[13px] font-bold text-blue-700">↕ 버튼으로 순서를 바꾼 뒤 &quot;순서 고정 요청&quot;을 눌러주세요</p>}

      {stopRows.length === 0 && (
        <p className="rounded-2xl bg-gray-50 px-4 py-6 text-center text-[16px] font-bold text-gray-400">오늘은 운행이 없습니다.</p>
      )}

      <ol className="space-y-2.5">
        {ordered.map((row) => {
          // 차고지 출발·학원 도착 같은 안내 줄 — 얇은 회색 한 줄(탑승 체크 없음).
          if (row.isTerminal) {
            return (
              <li key={row.key} className="flex items-center gap-2 rounded-xl bg-gray-100 px-4 py-2.5 text-[15px] font-bold text-gray-700">
                <span className="shrink-0 text-[15px] font-black text-gray-500">{row.time}</span>
                <span className="min-w-0 flex-1">{row.label}</span>
                {row.subLabel && <span className="shrink-0 text-[13px] font-semibold text-gray-400">{row.subLabel}</span>}
              </li>
            );
          }
          seq += 1;
          const isPickup = row.direction === "PICKUP";
          const url = tmapNavigationCoordinateUrl({ latitude: row.lat, longitude: row.lng, name: row.label });
          return (
            <li key={row.key} className={`rounded-2xl border-2 p-3.5 ${
              editing ? "border-blue-200 bg-blue-50" : row.warn ? "border-amber-300 bg-amber-50" : row.isHub ? "border-green-300 bg-green-50" : "border-gray-200 bg-white"
            }`}>
              <div className="flex items-center gap-2.5">
                {editing ? (
                  <div className="flex shrink-0 flex-col gap-0.5">
                    <button type="button" onClick={() => moveRow(row, -1)}
                      className="h-7 w-7 rounded-lg border border-gray-300 text-[16px] font-black text-gray-600">▲</button>
                    <button type="button" onClick={() => moveRow(row, 1)}
                      className="h-7 w-7 rounded-lg border border-gray-300 text-[16px] font-black text-gray-600">▼</button>
                  </div>
                ) : (
                  <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-[15px] font-black text-white ${row.isHub ? "bg-green-600" : "bg-brand-orange-500"}`}>
                    {row.isHub ? "🆓" : seq}
                  </span>
                )}
                <span className="min-w-0 flex-1 text-[18px] font-black leading-tight text-gray-900">{row.label}</span>
                <span className={`shrink-0 text-[16px] font-black ${row.time ? "text-blue-600" : "text-gray-400"}`}>{row.time ?? "시간 미정"}</span>
              </div>

              {/* 종류·방향 배지 + 노선 이름 */}
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <span className={`rounded-md px-2 py-0.5 text-[13px] font-black text-white ${row.kind === "SEASONAL" ? "bg-indigo-600" : "bg-teal-600"}`}>
                  {row.kind === "SEASONAL" ? "특강" : "정규"}
                </span>
                <span className={`rounded-md px-2 py-0.5 text-[13px] font-black text-white ${isPickup ? "bg-blue-600" : "bg-orange-600"}`}>
                  {isPickup ? "⬆ 등원" : "⬇ 하원"}
                </span>
                {row.groupLabel && <span className="text-[13px] font-bold text-gray-500">{row.groupLabel}</span>}
                {/* 원장이 아직 노선을 확정하지 않은 요일 — 시트 명단 순서라는 걸 기사님께 알린다 */}
                {row.pending && <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[12px] font-black text-amber-700">임시 순서 · 확정 전</span>}
                {!editing && (
                  <button type="button" onClick={() => setReqModal({ targetName: row.label, defaultType: "LOCATION" })}
                    className="ml-auto rounded-lg border border-gray-300 px-2 py-1 text-[12px] font-black text-gray-500 active:bg-gray-100">
                    요청
                  </button>
                )}
              </div>

              {!editing && url && (
                <a href={url} className="mt-2 flex h-12 items-center justify-center gap-1.5 rounded-xl bg-blue-600 text-[16px] font-black text-white active:bg-blue-700">🧭 T맵 길안내</a>
              )}
              {row.isHub && row.riders.length === 0 && <p className="mt-1.5 text-[15px] font-bold text-green-700">무료 거점(워크인, 정원 별도)</p>}

              {row.riders.length > 0 && (
                <div className="mt-2.5 space-y-2.5">
                  {row.riders.map((rider) => {
                    const status = boarding[rider.key] ?? null;
                    const parent = digits(rider.parentPhone), child = digits(rider.studentPhone);
                    const isBusy = busy[rider.key];
                    const selfLabel = isPickup ? "자차등원" : "자차하원";
                    // 정규는 그날 결석 신고가 자동 매칭되면 아예 체크 대상에서 뺀다(종전 동작 그대로).
                    const lockedAbsent = rider.absent && rider.kind === "REGULAR";
                    const rowKey = `${row.key}:${rider.checkId}`;
                    return (
                      <div key={rowKey} className={`rounded-xl p-2.5 ${lockedAbsent ? "bg-red-50" : "bg-gray-50"}`}>
                        <div className="flex items-center gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-baseline gap-1.5">
                              <span className={`text-[19px] font-black ${lockedAbsent ? "text-gray-400 line-through" : "text-gray-900"}`}>{rider.name}</span>
                              {rider.grade && <span className="text-[14px] text-gray-500">{rider.grade}</span>}
                              {lockedAbsent && <span className="rounded-md bg-red-500 px-2 py-0.5 text-[13px] font-black text-white">오늘 결석</span>}
                              {rider.absent && !lockedAbsent && status !== "BOARDED" && status !== "SELF" && (
                                <span className="rounded-md bg-amber-400 px-2 py-0.5 text-[13px] font-black text-white">결석예정</span>
                              )}
                              {!lockedAbsent && status === "NOSHOW" && <span className="rounded-md bg-red-500 px-2 py-0.5 text-[13px] font-black text-white">결석</span>}
                              {!lockedAbsent && status === "SELF" && <span className="rounded-md bg-violet-600 px-2 py-0.5 text-[13px] font-black text-white">{selfLabel}</span>}
                              {/* "오늘만" 셔틀 변경. 결석과 다른 색으로 둔다 — 아이는 수업에 오고,
                                  기사님이 태우지 않거나 다른 곳으로 가야 한다는 뜻이다. */}
                              {rider.shuttleNote && <span className="rounded-md bg-blue-600 px-2 py-0.5 text-[13px] font-black text-white">{rider.shuttleNote}</span>}
                            </div>
                            {!lockedAbsent && (parent || child) && (
                              <div className="mt-1 flex gap-3">
                                {parent && <a href={`tel:${parent}`} className="text-[15px] font-black text-blue-600">📞 학부모</a>}
                                {child && <a href={`tel:${child}`} className="text-[15px] font-black text-green-600">📞 학생</a>}
                              </div>
                            )}
                          </div>
                          {lockedAbsent ? (
                            <span className="rounded-xl border-2 border-red-300 px-3 py-2 text-[15px] font-black text-red-500">미{isPickup ? "탑승" : "하차"}(결석)</span>
                          ) : (
                            <>
                              <button type="button" onClick={() => setReqModal({ targetId: rider.checkId, targetName: rider.name, defaultType: "REMOVE" })}
                                className="h-14 min-w-[48px] rounded-xl border-2 border-gray-200 text-[13px] font-black text-gray-500 active:bg-gray-100">
                                요청
                              </button>
                              <button type="button" disabled={isBusy} onClick={() => { setMenuKey(null); setStatus(rider, "BOARDED"); }}
                                className={`h-14 min-w-[68px] rounded-xl text-[16px] font-black ${status === "BOARDED" ? "bg-green-600 text-white" : "border-2 border-green-400 text-green-700"}`}>
                                {isPickup ? "탑승" : "하차"}
                              </button>
                              <button type="button" onClick={() => setMenuKey(menuKey === rowKey ? null : rowKey)}
                                className={`h-14 min-w-[68px] rounded-xl text-[16px] font-black ${status === "NOSHOW" || status === "SELF" ? "bg-gray-700 text-white" : "border-2 border-gray-300 text-gray-600"}`}>
                                미{isPickup ? "탑승" : "하차"}
                              </button>
                            </>
                          )}
                        </div>
                        {!lockedAbsent && menuKey === rowKey && (
                          <div className="mt-2 flex gap-2">
                            <button type="button" disabled={isBusy} onClick={() => { setStatus(rider, "NOSHOW"); setMenuKey(null); }}
                              className={`h-13 flex-1 rounded-xl py-3 text-[16px] font-black ${status === "NOSHOW" ? "bg-red-500 text-white" : "border-2 border-red-300 text-red-600"}`}>❌ 결석(안 옴)</button>
                            <button type="button" disabled={isBusy} onClick={() => { setStatus(rider, "SELF"); setMenuKey(null); }}
                              className={`h-13 flex-1 rounded-xl py-3 text-[16px] font-black ${status === "SELF" ? "bg-violet-600 text-white" : "border-2 border-violet-300 text-violet-700"}`}>🚗 {selfLabel}</button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      <p className="mt-3 text-center text-[14px] font-semibold text-gray-400">탭 한 번으로 저장됩니다 · 다시 누르면 대기로 돌아갑니다</p>

      {/* 관리자 요청 모달 */}
      {reqModal && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <DriverRequestModal
            token={token}
            serviceDate={date}
            targetId={reqModal.targetId}
            targetName={reqModal.targetName}
            defaultType={reqModal.defaultType}
            orderPayload={reqModal.orderPayload}
            onClose={() => setReqModal(null)}
          />
        </div>
      )}
    </div>
  );
}
