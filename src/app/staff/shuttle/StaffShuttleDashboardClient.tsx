"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import ShuttleRideStatusButtons from "./ShuttleRideStatusButtons";

type Direction = "PICKUP" | "DROPOFF";
type RideStatus = "PENDING" | "BOARDED" | "DROPPED_OFF" | "NO_SHOW";

type Passenger = {
  id: string;
  studentNameSnapshot?: string | null;
  rideStatus?: string | null;
};

type Stop = {
  id: string;
  name: string;
  address?: string | null;
  roadAddress?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  passengers: Passenger[];
};

type Route = {
  id: string;
  name: string;
  direction: Direction;
  serviceDate?: string | Date | null;
  passengerCount: number;
  vehicle?: { name?: string | null } | null;
  stops: Stop[];
};

type Dashboard = {
  routes: Route[];
};

const DONE_STATUSES = new Set<RideStatus>(["BOARDED", "DROPPED_OFF"]);

export default function StaffShuttleDashboardClient({
  dashboard,
  canManageShuttle,
}: {
  dashboard: Dashboard;
  canManageShuttle: boolean;
}) {
  const [rideStatuses, setRideStatuses] = useState<Record<string, RideStatus>>(() => initialRideStatuses(dashboard.routes));
  const routeCount = dashboard.routes.length;
  const passengerCount = dashboard.routes.reduce((sum, route) => sum + route.passengerCount, 0);
  const statusSummary = useMemo(() => summarizeRideStatuses(dashboard.routes, rideStatuses), [dashboard.routes, rideStatuses]);

  function handleStatusChange(passengerId: string, status: RideStatus) {
    setRideStatuses((current) => ({ ...current, [passengerId]: status }));
  }

  return (
    <main className="mx-auto min-h-[calc(100dvh-9rem)] max-w-lg px-4 py-5">
      <section className="rounded-3xl bg-brand-navy-900 p-5 text-white shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-white/65">셔틀 기사 앱</p>
            <h1 className="mt-1 text-2xl font-black">오늘 운행</h1>
            <p className="mt-2 text-sm leading-6 text-white/75">
              확정된 셔틀 노선과 정류장 순서를 확인하고 학생별 탑승 상태를 체크합니다.
            </p>
          </div>
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[var(--brand-accent)] text-[var(--brand-accent-contrast)]">
            <span className="material-symbols-outlined" aria-hidden="true">airport_shuttle</span>
          </span>
        </div>
      </section>

      <section className="mt-4 grid grid-cols-2 gap-3">
        <StatusCard label="운행 상태" value={routeCount ? "확정" : "대기"} />
        <StatusCard label="오늘 노선" value={`${routeCount}개 · ${passengerCount}명`} />
      </section>

      <section className="mt-3 grid grid-cols-3 gap-2">
        <StatusCard label="체크 대기" value={`${statusSummary.pending}명`} tone={statusSummary.pending ? "warning" : "neutral"} compact />
        <StatusCard label="체크 완료" value={`${statusSummary.done}명`} tone="success" compact />
        <StatusCard label="미탑승" value={`${statusSummary.noShow}명`} tone={statusSummary.noShow ? "danger" : "neutral"} compact />
      </section>

      <section className="mt-4 space-y-3">
        {dashboard.routes.length ? dashboard.routes.map((route) => (
          <article key={route.id} className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black text-[var(--brand-accent)]">
                  {route.direction === "PICKUP" ? "등원" : "하원"} · {formatRouteDate(route.serviceDate)}
                </p>
                <h2 className="mt-1 text-lg font-black text-gray-900 dark:text-white">{route.name}</h2>
                <p className="mt-1 text-xs font-bold text-gray-500 dark:text-gray-400">
                  {route.vehicle?.name || "차량 미지정"} · {route.passengerCount}명
                </p>
              </div>
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200">
                <span className="material-symbols-outlined" aria-hidden="true">route</span>
              </span>
            </div>
            <ol className="mt-4 space-y-3">
              {route.stops.map((stop, index) => {
                const url = mapUrl(stop.latitude, stop.longitude, stop.name);
                return (
                  <li key={stop.id} className="rounded-2xl bg-gray-50 p-3 dark:bg-gray-950">
                    <div className="flex items-start gap-3">
                      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-gray-950 text-sm font-black text-white dark:bg-white dark:text-gray-950">{index + 1}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h3 className="break-words text-sm font-black text-gray-900 dark:text-white">{stop.name}</h3>
                            <p className="mt-1 break-words text-xs leading-5 text-gray-500 dark:text-gray-400">{stop.roadAddress || stop.address}</p>
                          </div>
                          {url && (
                            <a href={url} target="_blank" rel="noreferrer" aria-label={`${stop.name} 지도에서 열기`} className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-gray-700 shadow-sm dark:bg-gray-800 dark:text-gray-200">
                              <span className="material-symbols-outlined" aria-hidden="true">map</span>
                            </a>
                          )}
                        </div>
                        <div className="mt-2 space-y-2">
                          {stop.passengers.map((passenger) => {
                            const rideStatus = rideStatuses[passenger.id] ?? normalizeRideStatus(passenger.rideStatus);
                            return (
                              <div key={passenger.id} className="rounded-2xl bg-white p-2 dark:bg-gray-900">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="min-w-0 truncate text-sm font-black text-gray-800 dark:text-gray-100">
                                    {passenger.studentNameSnapshot || "학생"}
                                  </span>
                                  <RideStatusPill status={rideStatus} />
                                </div>
                                <ShuttleRideStatusButtons
                                  routeId={route.id}
                                  passengerId={passenger.id}
                                  direction={route.direction}
                                  status={rideStatus}
                                  onStatusChange={(status) => handleStatusChange(passenger.id, status)}
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </article>
        )) : (
          <div className="rounded-3xl border border-dashed border-gray-300 bg-white p-8 text-center shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <span className="material-symbols-outlined text-4xl text-gray-400" aria-hidden="true">event_busy</span>
            <h2 className="mt-3 font-black text-gray-900 dark:text-white">확정된 운행이 없습니다</h2>
            <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">
              관리자가 노선을 만들고 기사를 배정한 뒤 확정하면 여기에 표시됩니다.
            </p>
          </div>
        )}
      </section>

      {canManageShuttle && (
        <Link
          href="/admin/shuttle"
          className="mt-4 flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[var(--brand-accent)] px-4 text-sm font-black text-[var(--brand-accent-contrast)] shadow-sm"
        >
          <span className="material-symbols-outlined" aria-hidden="true">settings</span>
          관리자 셔틀 설정으로 이동
        </Link>
      )}
    </main>
  );
}

function initialRideStatuses(routes: Route[]) {
  const statuses: Record<string, RideStatus> = {};
  for (const route of routes) {
    for (const stop of route.stops) {
      for (const passenger of stop.passengers) {
        statuses[passenger.id] = normalizeRideStatus(passenger.rideStatus);
      }
    }
  }
  return statuses;
}

function summarizeRideStatuses(routes: Route[], statuses: Record<string, RideStatus>) {
  const summary = { pending: 0, done: 0, noShow: 0 };
  for (const route of routes) {
    for (const stop of route.stops) {
      for (const passenger of stop.passengers) {
        const status = statuses[passenger.id] ?? normalizeRideStatus(passenger.rideStatus);
        if (status === "NO_SHOW") summary.noShow += 1;
        else if (DONE_STATUSES.has(status)) summary.done += 1;
        else summary.pending += 1;
      }
    }
  }
  return summary;
}

function normalizeRideStatus(status?: string | null): RideStatus {
  return status === "BOARDED" || status === "DROPPED_OFF" || status === "NO_SHOW" ? status : "PENDING";
}

function formatRouteDate(value?: string | Date | null) {
  if (!value) return "정기";
  return new Intl.DateTimeFormat("ko-KR", { month: "short", day: "numeric", weekday: "short" }).format(new Date(value));
}

function mapUrl(lat: number | string | null | undefined, lng: number | string | null | undefined, name: string) {
  if (lat == null || lng == null) return null;
  return `https://map.kakao.com/link/map/${encodeURIComponent(name)},${lat},${lng}`;
}

function RideStatusPill({ status }: { status: RideStatus }) {
  const label = status === "BOARDED" ? "탑승" : status === "DROPPED_OFF" ? "하차" : status === "NO_SHOW" ? "미탑승" : "대기";
  const color = status === "BOARDED" || status === "DROPPED_OFF"
    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
    : status === "NO_SHOW"
      ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-200"
      : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300";

  return <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-black ${color}`}>{label}</span>;
}

function StatusCard({
  label,
  value,
  tone = "neutral",
  compact = false,
}: {
  label: string;
  value: string;
  tone?: "neutral" | "success" | "warning" | "danger";
  compact?: boolean;
}) {
  const toneClass =
    tone === "success"
      ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
      : tone === "warning"
        ? "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200"
        : tone === "danger"
          ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-200"
          : "bg-white text-gray-900 dark:bg-gray-900 dark:text-white";

  return (
    <div className={`rounded-2xl p-4 shadow-sm ${toneClass}`}>
      <p className={`font-bold opacity-70 ${compact ? "text-[11px]" : "text-xs"}`}>{label}</p>
      <p className={`mt-2 font-black ${compact ? "text-base" : "text-lg"}`}>{value}</p>
    </div>
  );
}
