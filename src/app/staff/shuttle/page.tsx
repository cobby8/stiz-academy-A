import Link from "next/link";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth-guard";
import { getStaffShuttleDashboard } from "@/lib/shuttle/service";
import ShuttleRideStatusButtons from "./ShuttleRideStatusButtons";

export const dynamic = "force-dynamic";

export default async function StaffShuttlePage() {
  const staff = await requireStaff();
  const canUseShuttle =
    staff.appUserRole === "DRIVER" ||
    staff.appUserRole === "ADMIN" ||
    staff.appUserRole === "VICE_ADMIN";

  if (!canUseShuttle) redirect("/staff");
  const dashboard = await getStaffShuttleDashboard(staff);
  const routeCount = dashboard.routes.length;
  const passengerCount = dashboard.routes.reduce((sum, route) => sum + route.passengerCount, 0);

  return (
    <main className="mx-auto min-h-[calc(100dvh-9rem)] max-w-lg px-4 py-5">
      <section className="rounded-3xl bg-brand-navy-900 p-5 text-white shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-white/65">셔틀 기사 앱</p>
            <h1 className="mt-1 text-2xl font-black">오늘 운행</h1>
            <p className="mt-2 text-sm leading-6 text-white/75">확정된 셔틀 노선과 정류장 순서를 확인합니다.</p>
          </div>
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[var(--brand-accent)] text-[var(--brand-accent-contrast)]">
            <span className="material-symbols-outlined" aria-hidden="true">airport_shuttle</span>
          </span>
        </div>
      </section>

      <section className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-gray-900">
          <p className="text-xs font-bold text-gray-500 dark:text-gray-400">운행 상태</p>
          <p className="mt-2 text-lg font-black text-gray-900 dark:text-white">{routeCount ? "확정" : "대기"}</p>
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-gray-900">
          <p className="text-xs font-bold text-gray-500 dark:text-gray-400">오늘 노선</p>
          <p className="mt-2 text-lg font-black text-gray-900 dark:text-white">{routeCount}개 · {passengerCount}명</p>
        </div>
      </section>

      <section className="mt-4 space-y-3">
        {dashboard.routes.length ? dashboard.routes.map((route) => (
          <article key={route.id} className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black text-[var(--brand-accent)]">{route.direction === "PICKUP" ? "등원" : "하원"} · {formatRouteDate(route.serviceDate)}</p>
                <h2 className="mt-1 text-lg font-black text-gray-900 dark:text-white">{route.name}</h2>
                <p className="mt-1 text-xs font-bold text-gray-500 dark:text-gray-400">{route.vehicle?.name || "차량 미지정"} · {route.passengerCount}명</p>
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
                          {stop.passengers.map((passenger) => (
                            <div key={passenger.id} className="rounded-2xl bg-white p-2 dark:bg-gray-900">
                              <div className="flex items-center justify-between gap-2">
                                <span className="min-w-0 truncate text-sm font-black text-gray-800 dark:text-gray-100">
                                  {passenger.studentNameSnapshot || "학생"}
                                </span>
                                <RideStatusPill status={passenger.rideStatus} />
                              </div>
                              <ShuttleRideStatusButtons
                                routeId={route.id}
                                passengerId={passenger.id}
                                direction={route.direction}
                                initialStatus={passenger.rideStatus as "PENDING" | "BOARDED" | "DROPPED_OFF" | "NO_SHOW"}
                              />
                            </div>
                          ))}
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
            <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">관리자가 노선에 기사를 배정하고 확정하면 이곳에 표시됩니다.</p>
          </div>
        )}
      </section>

      {(staff.appUserRole === "ADMIN" || staff.appUserRole === "VICE_ADMIN") && (
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

function formatRouteDate(value?: string | Date | null) {
  if (!value) return "정기";
  return new Intl.DateTimeFormat("ko-KR", { month: "short", day: "numeric", weekday: "short" }).format(new Date(value));
}

function mapUrl(lat: number | string | null | undefined, lng: number | string | null | undefined, name: string) {
  if (lat == null || lng == null) return null;
  return `https://map.kakao.com/link/map/${encodeURIComponent(name)},${lat},${lng}`;
}

function RideStatusPill({ status }: { status: string }) {
  const label = status === "BOARDED" ? "탑승" : status === "DROPPED_OFF" ? "하차" : status === "NO_SHOW" ? "미탑승" : "대기";
  const color = status === "BOARDED" || status === "DROPPED_OFF"
    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
    : status === "NO_SHOW"
      ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-200"
      : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300";

  return <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-black ${color}`}>{label}</span>;
}
