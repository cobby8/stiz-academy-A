"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent, type InputHTMLAttributes, type ReactNode } from "react";
import AdminModal from "@/components/admin/AdminModal";
import LocationPickerModal, { type MapLocationData } from "@/components/maps/LocationPickerModal";
import FontFreeIcon from "@/components/ui/FontFreeIcon";
import { coordinateLinkSet } from "@/lib/maps/coordinate-links";

type Direction = "PICKUP" | "DROPOFF";
type RouteStatus = "DRAFT" | "CONFIRMED" | "COMPLETED" | "ARCHIVED";

interface Season { id: string; title: string; startsAt?: string | null; endsAt?: string | null }
interface Vehicle { id: string; name: string; plateNumber?: string | null; capacity: number; notes?: string | null; isActive?: boolean }
interface Driver { id: string; name: string; phone?: string | null; role?: string }
interface Passenger { id: string; shuttleRequestId: string; studentNameSnapshot?: string; parentNameSnapshot?: string | null; parentPhoneSnapshot?: string | null; rideStatus?: string | null }
interface Stop {
  id: string;
  name: string;
  address: string;
  roadAddress?: string | null;
  latitude: number | string;
  longitude: number | string;
  lat?: number | string;
  lng?: number | string;
  stopOrder: number;
  plannedAt?: string | null;
  note?: string | null;
  passengers?: Passenger[];
}
interface RoutePlan {
  id: string;
  name: string;
  direction: Direction;
  status: RouteStatus;
  version: number;
  serviceDate?: string | null;
  vehicleId?: string | null;
  vehicle?: Vehicle | null;
  driverUserId?: string | null;
  driver?: Driver | null;
  originName?: string;
  originAddress?: string;
  originLat?: number | string;
  originLng?: number | string;
  destinationName?: string;
  destinationAddress?: string;
  destinationLat?: number | string;
  destinationLng?: number | string;
  stops?: Stop[];
  passengerCount?: number;
}
interface ShuttleRequest {
  id: string;
  childName?: string;
  studentName?: string;
  parentName?: string | null;
  parentPhone?: string | null;
  pickup?: RequestLocation | null;
  dropoff?: RequestLocation | null;
  pickupTime?: string | null;
  note?: string | null;
}
interface RequestLocation { name?: string | null; address?: string | null; roadAddress?: string | null; latitude?: number | string | null; longitude?: number | string | null; lat?: number | string | null; lng?: number | string | null; placeId?: string | null; source?: MapLocationData["source"] | string | null; accuracyMeters?: number | string | null; confirmedAt?: string | null }
interface Payload { seasons: Season[]; selectedSeasonId?: string; vehicles: Vehicle[]; drivers: Driver[]; routes: RoutePlan[]; unassignedRequests: ShuttleRequest[] }
interface OptimizationPreview { provider: string; routeId: string; routeName: string; totalDistance?: number; totalTime?: number; stops: Array<{ id: string; previousOrder: number; recommendedOrder: number; name: string; address?: string | null; passengerCount: number }> }
type LocationPickerTarget = { request: ShuttleRequest; kind: "pickup" | "dropoff" };

function mapUrl(lat: number | string | null | undefined, lng: number | string | null | undefined, name: string) {
  return coordinateLinkSet({ latitude: lat, longitude: lng, name }).kakaoMap;
}

const EMPTY_PAYLOAD: Payload = { seasons: [], vehicles: [], drivers: [], routes: [], unassignedRequests: [] };
const STATUS_LABEL: Record<RouteStatus, string> = { DRAFT: "작성 중", CONFIRMED: "확정", COMPLETED: "운행완료", ARCHIVED: "보관" };

function formatDate(value?: string | null) {
  if (!value) return "날짜 미지정";
  return new Intl.DateTimeFormat("ko-KR", { month: "short", day: "numeric", weekday: "short" }).format(new Date(value));
}

async function request(body: unknown) {
  const response = await fetch("/api/admin/shuttle", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "셔틀 정보를 저장하지 못했습니다.");
  return result;
}

export default function ShuttleRouteAdminClient() {
  const [data, setData] = useState<Payload>(EMPTY_PAYLOAD);
  const [seasonId, setSeasonId] = useState("");
  const [direction, setDirection] = useState<Direction>("PICKUP");
  const [serviceDate, setServiceDate] = useState("");
  const [selectedRouteId, setSelectedRouteId] = useState("");
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [modal, setModal] = useState<"vehicle" | "route" | "assign" | "confirm" | null>(null);
  const [assignRequest, setAssignRequest] = useState<ShuttleRequest | null>(null);
  const [locationPicker, setLocationPicker] = useState<LocationPickerTarget | null>(null);
  const [optimizationPreview, setOptimizationPreview] = useState<OptimizationPreview | null>(null);

  const load = useCallback(async (requestedSeasonId?: string, requestedDirection: Direction = direction, requestedServiceDate: string = serviceDate) => {
    setLoading(true); setError("");
    try {
      const query = new URLSearchParams({ direction: requestedDirection });
      if (requestedSeasonId) query.set("seasonId", requestedSeasonId);
      if (requestedServiceDate) query.set("serviceDate", requestedServiceDate);
      const response = await fetch(`/api/admin/shuttle?${query.toString()}`, { cache: "no-store" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "셔틀 노선 정보를 불러오지 못했습니다.");
      const payload: Payload = { seasons: body.seasons ?? [], vehicles: body.vehicles ?? [], drivers: body.drivers ?? [], routes: body.routes ?? [], unassignedRequests: body.unassignedRequests ?? [], selectedSeasonId: body.selectedSeasonId };
      setData(payload);
      const nextSeasonId = requestedSeasonId || payload.selectedSeasonId || payload.seasons[0]?.id || "";
      setSeasonId(nextSeasonId);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "셔틀 노선 정보를 불러오지 못했습니다."); }
    finally { setLoading(false); }
  }, [direction, serviceDate]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!autoRefresh || pending || modal || locationPicker) return;
    const timer = window.setInterval(() => { void load(seasonId, direction, serviceDate); }, 30000);
    return () => window.clearInterval(timer);
  }, [autoRefresh, direction, load, locationPicker, modal, pending, seasonId, serviceDate]);

  const availableDates = useMemo(() => Array.from(new Set(data.routes
    .filter((route) => route.direction === direction && route.serviceDate)
    .map((route) => route.serviceDate!.slice(0, 10)))).sort(), [data.routes, direction]);
  const routes = useMemo(() => data.routes.filter((route) => route.direction === direction
    && (serviceDate ? route.serviceDate?.slice(0, 10) === serviceDate : !route.serviceDate)), [data.routes, direction, serviceDate]);
  const selectedRoute = routes.find((route) => route.id === selectedRouteId) ?? routes[0] ?? null;
  const stops = useMemo(() => [...(selectedRoute?.stops ?? [])].sort((a, b) => a.stopOrder - b.stopOrder), [selectedRoute]);
  const passengerCount = selectedRoute?.passengerCount ?? stops.reduce((sum, stop) => sum + (stop.passengers?.length ?? 0), 0);
  const capacity = selectedRoute?.vehicle?.capacity ?? data.vehicles.find((vehicle) => vehicle.id === selectedRoute?.vehicleId)?.capacity ?? 0;
  const rideSummary = useMemo(() => summarizeRideStatuses(stops), [stops]);

  useEffect(() => { if (routes.length && !routes.some((route) => route.id === selectedRouteId)) setSelectedRouteId(routes[0].id); }, [routes, selectedRouteId]);
  useEffect(() => { setOptimizationPreview(null); }, [selectedRouteId]);

  async function mutate(body: unknown, success: string) {
    setPending(true); setError(""); setNotice("");
    try { await request(body); setNotice(success); setModal(null); setAssignRequest(null); setLocationPicker(null); await load(seasonId, direction, serviceDate); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "요청을 처리하지 못했습니다."); }
    finally { setPending(false); }
  }

  async function saveRequestLocation(target: LocationPickerTarget, value: MapLocationData) {
    await mutate({
      resource: "shuttleRequest",
      id: target.request.id,
      action: "confirmLocation",
      data: {
        kind: target.kind,
        name: value.roadAddress || value.address,
        address: value.address,
        roadAddress: value.roadAddress,
        latitude: value.latitude,
        longitude: value.longitude,
        placeId: value.placeId,
        source: value.source,
        accuracyMeters: value.accuracyMeters,
      },
    }, `${target.request.childName || target.request.studentName || "학생"} ${target.kind === "pickup" ? "탑승" : "하차"} 위치를 저장했습니다.`);
  }

  async function createResource(event: FormEvent<HTMLFormElement>, resource: "vehicle" | "route") {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const body = resource === "vehicle"
      ? { resource, data: { name: values.name, plateNumber: values.plateNumber || undefined, capacity: Number(values.capacity), notes: values.notes || undefined } }
      : { resource, data: { seasonId, name: values.name, direction, serviceDate: values.serviceDate || undefined, vehicleId: values.vehicleId || undefined, driverUserId: values.driverUserId || undefined,
          originName: values.originName, originAddress: values.originAddress, originLatitude: Number(values.originLatitude), originLongitude: Number(values.originLongitude),
          destinationName: values.destinationName, destinationAddress: values.destinationAddress, destinationLatitude: Number(values.destinationLatitude), destinationLongitude: Number(values.destinationLongitude) } };
    setPending(true); setError("");
    try {
      const response = await fetch("/api/admin/shuttle", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "등록하지 못했습니다.");
      const nextServiceDate = resource === "route" && typeof values.serviceDate === "string" ? values.serviceDate : serviceDate;
      if (resource === "route") setServiceDate(nextServiceDate);
      setNotice(resource === "vehicle" ? "차량을 등록했습니다." : "노선 초안을 만들었습니다."); setModal(null); await load(seasonId, direction, nextServiceDate);
      if (result.route?.id) setSelectedRouteId(result.route.id);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "등록하지 못했습니다."); }
    finally { setPending(false); }
  }

  function moveStop(index: number, offset: -1 | 1) {
    if (!selectedRoute) return;
    const next = [...stops]; const target = index + offset;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    void mutate({ resource: "route", id: selectedRoute.id, action: "reorder", data: { stops: next.map((stop, stopOrder) => ({ id: stop.id, stopOrder: stopOrder + 1, plannedAt: stop.plannedAt })) } }, "정류장 순서를 변경했습니다.");
  }

  async function previewOptimizedStops() {
    if (!selectedRoute) return;
    setPending(true); setError(""); setNotice(""); setOptimizationPreview(null);
    try {
      const result = await request({ resource: "route", id: selectedRoute.id, action: "optimizePreview", data: {} });
      setOptimizationPreview(result.preview as OptimizationPreview);
      setNotice("T맵 추천 순서를 불러왔습니다. 확인 후 적용해 주세요.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "T맵 추천 순서를 불러오지 못했습니다.");
    } finally {
      setPending(false);
    }
  }

  async function applyOptimizedStops() {
    if (!selectedRoute || !optimizationPreview) return;
    const plannedAtByStopId = new Map(stops.map((stop) => [stop.id, stop.plannedAt]));
    await mutate({
      resource: "route",
      id: selectedRoute.id,
      action: "reorder",
      data: {
        stops: optimizationPreview.stops.map((stop) => ({
          id: stop.id,
          stopOrder: stop.recommendedOrder,
          plannedAt: plannedAtByStopId.get(stop.id),
        })),
      },
    }, "T맵 추천 순서를 노선에 적용했습니다.");
    setOptimizationPreview(null);
  }

  function openAssign(item: ShuttleRequest) { setAssignRequest(item); setModal("assign"); setError(""); }

  const chosenLocation = (item: ShuttleRequest) => direction === "PICKUP"
    ? { name: item.pickup?.name || item.pickup?.address || "승차 위치", address: item.pickup?.address || "", roadAddress: item.pickup?.roadAddress, latitude: item.pickup?.latitude ?? item.pickup?.lat, longitude: item.pickup?.longitude ?? item.pickup?.lng, lat: item.pickup?.latitude ?? item.pickup?.lat, lng: item.pickup?.longitude ?? item.pickup?.lng, confirmedAt: item.pickup?.confirmedAt, note: item.note, source: item.pickup?.source, placeId: item.pickup?.placeId, accuracyMeters: item.pickup?.accuracyMeters }
    : { name: item.dropoff?.name || item.dropoff?.address || "하차 위치", address: item.dropoff?.address || "", roadAddress: item.dropoff?.roadAddress, latitude: item.dropoff?.latitude ?? item.dropoff?.lat, longitude: item.dropoff?.longitude ?? item.dropoff?.lng, lat: item.dropoff?.latitude ?? item.dropoff?.lat, lng: item.dropoff?.longitude ?? item.dropoff?.lng, confirmedAt: item.dropoff?.confirmedAt, note: item.note, source: item.dropoff?.source, placeId: item.dropoff?.placeId, accuracyMeters: item.dropoff?.accuracyMeters };
  const pickerInitialValue = locationPicker ? mapLocationData(locationPicker.kind === "pickup" ? locationPicker.request.pickup : locationPicker.request.dropoff) : undefined;

  return <main className="min-w-0 space-y-5 p-4 sm:p-6 lg:p-8">
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-sm font-bold text-[var(--brand-accent)]">방학특강 운영</p><h1 className="text-2xl font-black text-gray-950 dark:text-white">셔틀 노선 관리</h1><p className="mt-1 text-sm text-gray-600 dark:text-gray-300">신청 위치를 확인하고 차량별 운행 순서를 확정합니다.</p></div>
      <div className="flex gap-2"><button type="button" onClick={() => setModal("vehicle")} className="min-h-11 rounded-xl border border-gray-300 bg-white px-4 text-sm font-black dark:border-gray-700 dark:bg-gray-800">차량 등록</button><button type="button" onClick={() => setModal("route")} disabled={!seasonId || !data.vehicles.length || !data.drivers.length} className="min-h-11 rounded-xl bg-[var(--brand-accent)] px-4 text-sm font-black text-[var(--brand-accent-contrast)] disabled:opacity-50">노선 만들기</button></div>
    </header>

    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700 dark:bg-red-950/30 dark:text-red-200">{error}</p>}
    {notice && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">{notice}</p>}

    <section aria-label="새로고침 설정" className="flex flex-col gap-2 rounded-2xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm font-bold text-gray-600 dark:text-gray-300">기사 앱 체크 현황은 30초마다 자동으로 반영됩니다.</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => void load(seasonId, direction, serviceDate)} disabled={loading || pending} className="min-h-10 rounded-lg border border-gray-300 px-4 text-sm font-black disabled:opacity-40 dark:border-gray-600">새 상태 불러오기</button>
        <label className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-gray-100 px-3 text-sm font-black dark:bg-gray-900">
          <input type="checkbox" checked={autoRefresh} onChange={(event) => setAutoRefresh(event.target.checked)} className="h-4 w-4" />
          30초 자동 새로고침
        </label>
      </div>
    </section>

    <section aria-label="조회 조건" className="grid gap-3 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800 sm:grid-cols-3">
      <label className="text-sm font-bold">특강 시즌<select value={seasonId} onChange={(event) => void load(event.target.value, direction, serviceDate)} className="mt-1 min-h-11 w-full rounded-xl border border-gray-300 bg-white px-3 dark:border-gray-600 dark:bg-gray-900">{data.seasons.map((season) => <option key={season.id} value={season.id}>{season.title}</option>)}</select></label>
      <fieldset><legend className="text-sm font-bold">운행 방향</legend><div className="mt-1 grid grid-cols-2 rounded-xl bg-gray-100 p-1 dark:bg-gray-900">{(["PICKUP", "DROPOFF"] as Direction[]).map((value) => <button key={value} type="button" onClick={() => { setServiceDate(""); setDirection(value); }} className={`min-h-9 rounded-lg text-sm font-black ${direction === value ? "bg-white shadow dark:bg-gray-700" : "text-gray-500"}`}>{value === "PICKUP" ? "등원" : "하원"}</button>)}</div></fieldset>
      <label className="text-sm font-bold">운행일<select value={serviceDate} onChange={(event) => setServiceDate(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-gray-300 bg-white px-3 dark:border-gray-600 dark:bg-gray-900"><option value="">정기 노선 (날짜 없음)</option>{availableDates.map((date) => <option key={date} value={date}>{formatDate(date)}</option>)}</select></label>
    </section>

    {loading ? <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center text-gray-500 dark:border-gray-700 dark:bg-gray-800">노선 정보를 불러오는 중입니다…</div> : !data.seasons.length ? <Empty title="운영 중인 특강 시즌이 없습니다" description="방학특강 시즌을 먼저 등록한 뒤 노선을 만들어 주세요." /> : <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(260px,0.72fr)_minmax(0,1.28fr)]">
      <aside className="min-w-0 space-y-4">
        <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"><div className="mb-3 flex items-center justify-between"><h2 className="font-black">노선 초안</h2><span className="text-xs font-bold text-gray-500">{routes.length}개</span></div>{routes.length ? <div className="space-y-2">{routes.map((route) => <button key={route.id} type="button" onClick={() => setSelectedRouteId(route.id)} className={`w-full rounded-xl border p-3 text-left ${selectedRoute?.id === route.id ? "border-[var(--brand-accent)] bg-amber-50 dark:bg-amber-950/20" : "border-gray-200 dark:border-gray-700"}`}><span className="flex items-start justify-between gap-2"><strong className="break-words">{route.name}</strong><StatusBadge status={route.status} /></span><span className="mt-2 block text-xs text-gray-500">v{route.version} · {formatDate(route.serviceDate)} · {route.vehicle?.name || "차량 미지정"} · {route.driver?.name || "기사 미배정"}</span></button>)}</div> : <p className="rounded-xl bg-gray-50 p-4 text-sm text-gray-500 dark:bg-gray-900">이 방향의 노선이 없습니다.</p>}</section>
        <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="mb-3 flex items-center justify-between"><h2 className="font-black">미배정 학생</h2><span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-black dark:bg-gray-700">{data.unassignedRequests.length}명</span></div>
          <div className="max-h-[32rem] space-y-2 overflow-y-auto">{data.unassignedRequests.length ? data.unassignedRequests.map((item) => {
            const location = chosenLocation(item);
            const links = coordinateLinkSet({ latitude: location.lat, longitude: location.lng, name: location.name });
            const canAssign = Boolean(selectedRoute && selectedRoute.status === "DRAFT" && location.lat != null && location.lng != null && location.confirmedAt);
            return <article key={item.id} className="rounded-xl border border-gray-200 p-3 dark:border-gray-700">
              <div className="flex justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-black">{item.childName || item.studentName || "이름 미확인"}</h3>
                  <p className="mt-1 break-words text-xs text-gray-600 dark:text-gray-300">{location.roadAddress || location.address || "위치 확인 필요"}</p>
                  {location.confirmedAt && <p className="mt-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">관리자 위치 확인 완료</p>}
                </div>
                {links.kakaoMap && <a href={links.kakaoMap} target="_blank" rel="noreferrer" aria-label={`${item.childName || "학생"} 카카오맵에서 좌표 확인`} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700"><FontFreeIcon name="map" size={19} /></a>}
              </div>
              {links.point && <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] font-black">
                <a href={links.kakaoNavigation ?? links.kakaoMap ?? "#"} target="_blank" rel="noreferrer" className="inline-flex min-h-9 items-center justify-center rounded-lg border border-gray-200 bg-white px-2 text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200">카카오 길안내</a>
                <a href={links.tmapNavigation ?? "#"} className="inline-flex min-h-9 items-center justify-center rounded-lg border border-orange-200 bg-orange-50 px-2 text-orange-800 dark:border-orange-900 dark:bg-orange-950/30 dark:text-orange-200">T맵 길안내</a>
              </div>}
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setLocationPicker({ request: item, kind: direction === "PICKUP" ? "pickup" : "dropoff" })} disabled={pending} className="min-h-10 rounded-lg border border-blue-200 bg-blue-50 text-sm font-black text-blue-800 disabled:opacity-40 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-200">위치 찍기</button>
                <button type="button" onClick={() => openAssign(item)} disabled={!canAssign} className="min-h-10 rounded-lg bg-gray-950 text-sm font-black text-white disabled:bg-gray-300 dark:bg-white dark:text-gray-950 dark:disabled:bg-gray-700">{canAssign ? "선택 노선에 배정" : "좌표 확인 필요"}</button>
              </div>
            </article>;
          }) : <p className="py-6 text-center text-sm text-gray-500">미배정 신청이 없습니다.</p>}</div>
        </section>
      </aside>

      <section className="min-w-0 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800 sm:p-5">{selectedRoute ? <>
        <div className="flex flex-col gap-3 border-b border-gray-200 pb-4 dark:border-gray-700 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="break-words text-xl font-black">{selectedRoute.name}</h2><StatusBadge status={selectedRoute.status} /></div><p className="mt-1 text-sm text-gray-500">버전 {selectedRoute.version} · {selectedRoute.vehicle?.name || "차량 미지정"} · {selectedRoute.driver?.name || "기사 미배정"}</p></div><div className="flex flex-wrap gap-2">{selectedRoute.status === "DRAFT" && <button type="button" onClick={() => void previewOptimizedStops()} disabled={pending || stops.length < 2} className="min-h-10 rounded-lg border border-orange-200 bg-orange-50 px-4 text-sm font-black text-orange-800 disabled:opacity-40 dark:border-orange-900 dark:bg-orange-950/30 dark:text-orange-200">T맵 순서 추천</button>}{selectedRoute.status === "DRAFT" && <button type="button" onClick={() => setModal("confirm")} disabled={!stops.length || !selectedRoute.vehicleId || !selectedRoute.driverUserId || passengerCount > capacity} className="min-h-10 rounded-lg bg-[var(--brand-accent)] px-4 text-sm font-black text-[var(--brand-accent-contrast)] disabled:opacity-40">노선 확정</button>}{selectedRoute.status === "CONFIRMED" && <button type="button" onClick={() => void mutate({ resource: "route", id: selectedRoute.id, action: "complete", data: {} }, "운행을 완료했습니다.")} disabled={rideSummary.pending > 0 || pending} className="min-h-10 rounded-lg bg-blue-600 px-4 text-sm font-black text-white disabled:opacity-40">운행 완료</button>}{selectedRoute.status === "CONFIRMED" && <button type="button" onClick={() => void mutate({ resource: "route", id: selectedRoute.id, action: "revise", data: {} }, "새 수정 버전을 만들었습니다.")} className="min-h-10 rounded-lg border border-gray-300 px-4 text-sm font-black dark:border-gray-600">수정본 만들기</button>}<button type="button" onClick={() => void mutate({ resource: "route", id: selectedRoute.id, action: "archive", data: {} }, "노선을 보관했습니다.")} disabled={selectedRoute.status === "ARCHIVED"} className="min-h-10 rounded-lg border border-gray-300 px-4 text-sm font-black disabled:opacity-40 dark:border-gray-600">보관</button></div></div>
        {selectedRoute.status === "DRAFT" && <label className="mt-4 block text-sm font-bold">담당 기사<select value={selectedRoute.driverUserId || ""} onChange={(event) => void mutate({ resource: "route", id: selectedRoute.id, action: "update", data: { driverUserId: event.target.value || null } }, "담당 기사를 변경했습니다.")} disabled={pending} className="mt-1 min-h-11 w-full rounded-xl border border-gray-300 bg-white px-3 dark:border-gray-600 dark:bg-gray-900"><option value="">기사 선택</option>{data.drivers.map((driver) => <option key={driver.id} value={driver.id}>{driver.name}{driver.phone ? ` (${driver.phone})` : ""}</option>)}</select></label>}
        <div className="my-4 grid grid-cols-2 gap-2 sm:grid-cols-5"><Metric label="탑승 학생" value={`${passengerCount}명`} /><Metric label="차량 정원" value={capacity ? `${capacity}명` : "미지정"} danger={capacity > 0 && passengerCount > capacity} /><Metric label="담당 기사" value={selectedRoute.driver?.name || "미배정"} danger={!selectedRoute.driverUserId} /><Metric label="정류장" value={`${stops.length}곳`} /><Metric label="운행일" value={formatDate(selectedRoute.serviceDate)} /></div>
        <div className="mb-2 grid grid-cols-3 gap-2 rounded-2xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900"><Metric label="체크 대기" value={`${rideSummary.pending}명`} danger={selectedRoute.status === "CONFIRMED" && rideSummary.pending > 0} /><Metric label="완료" value={`${rideSummary.done}명`} /><Metric label="미탑승" value={`${rideSummary.noShow}명`} danger={rideSummary.noShow > 0} /></div>
        {selectedRoute.status === "CONFIRMED" && rideSummary.pending > 0 && <p className="mb-4 rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">체크 대기 학생을 모두 탑승, 하차, 미탑승 중 하나로 처리해야 운행 완료를 누를 수 있습니다.</p>}
        {selectedRoute.status === "CONFIRMED" && rideSummary.noShow > 0 && <p className="mb-4 rounded-xl bg-blue-50 p-3 text-sm font-bold text-blue-800 dark:bg-blue-950/30 dark:text-blue-200">미탑승 학부모 알림은 솔라피 발신 설정 후 이 화면에서 바로 연결할 수 있도록 준비 중입니다.</p>}
        {capacity > 0 && passengerCount > capacity && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700 dark:bg-red-950/30 dark:text-red-200">차량 정원을 초과했습니다. 학생을 다른 노선으로 이동해야 확정할 수 있습니다.</p>}
        {optimizationPreview?.routeId === selectedRoute.id && <section className="mb-4 rounded-2xl border border-orange-200 bg-orange-50 p-4 dark:border-orange-900 dark:bg-orange-950/20">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="font-black text-orange-900 dark:text-orange-100">T맵 추천 순서</h3>
              <p className="mt-1 text-xs font-bold text-orange-700 dark:text-orange-200">{optimizationPreview.totalDistance ? `예상 거리 ${Math.round(optimizationPreview.totalDistance / 100) / 10}km` : "거리 정보 없음"} · {optimizationPreview.totalTime ? `예상 시간 ${Math.round(optimizationPreview.totalTime / 60)}분` : "시간 정보 없음"}</p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setOptimizationPreview(null)} className="min-h-10 rounded-lg border border-orange-200 bg-white px-3 text-xs font-black text-orange-800 dark:border-orange-800 dark:bg-gray-900 dark:text-orange-200">닫기</button>
              <button type="button" onClick={() => void applyOptimizedStops()} disabled={pending} className="min-h-10 rounded-lg bg-orange-500 px-3 text-xs font-black text-white disabled:opacity-40">추천 순서 적용</button>
            </div>
          </div>
          <ol className="mt-3 grid gap-2 sm:grid-cols-2">
            {optimizationPreview.stops.map((stop) => <li key={stop.id} className="rounded-xl bg-white p-3 text-sm dark:bg-gray-900"><span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-orange-500 text-xs font-black text-white">{stop.recommendedOrder}</span><strong>{stop.name}</strong><span className="ml-2 text-xs font-bold text-gray-500">기존 {stop.previousOrder}번 · {stop.passengerCount}명</span></li>)}
          </ol>
        </section>}
        <ol className="space-y-3">{stops.map((stop, index) => { const url = mapUrl(stop.lat, stop.lng, stop.name); return <li key={stop.id} className="rounded-xl border border-gray-200 p-3 dark:border-gray-700"><div className="flex items-start gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-950 text-sm font-black text-white dark:bg-white dark:text-gray-950">{index + 1}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="break-words font-black">{stop.name}</h3><p className="break-words text-xs text-gray-500">{stop.roadAddress || stop.address}</p></div><div className="flex gap-1">{url && <a href={url} target="_blank" rel="noreferrer" aria-label={`${stop.name} 지도에서 열기`} className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700"><FontFreeIcon name="map" size={18} /></a>}{selectedRoute.status === "DRAFT" && <><button type="button" onClick={() => moveStop(index, -1)} disabled={index === 0 || pending} aria-label={`${stop.name} 순서를 위로 이동`} className="h-9 w-9 rounded-lg bg-gray-100 font-black disabled:opacity-30 dark:bg-gray-700">↑</button><button type="button" onClick={() => moveStop(index, 1)} disabled={index === stops.length - 1 || pending} aria-label={`${stop.name} 순서를 아래로 이동`} className="h-9 w-9 rounded-lg bg-gray-100 font-black disabled:opacity-30 dark:bg-gray-700">↓</button></>}</div></div><label className="mt-2 block text-xs font-bold text-gray-500">예상 도착시간<input type="time" value={stop.plannedAt?.slice(11, 16) ?? stop.plannedAt ?? ""} disabled={selectedRoute.status !== "DRAFT" || pending} onChange={(event) => void mutate({ resource: "route", id: selectedRoute.id, action: "reorder", data: { stops: stops.map((item, itemIndex) => ({ id: item.id, stopOrder: itemIndex + 1, plannedAt: item.id === stop.id ? event.target.value : item.plannedAt })) } }, "예상시간을 변경했습니다.")} className="ml-2 min-h-9 rounded-lg border border-gray-300 bg-white px-2 dark:border-gray-600 dark:bg-gray-900" /></label><div className="mt-2 flex flex-wrap gap-2">{stop.passengers?.map((passenger) => <span key={passenger.id} className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-xs font-bold dark:bg-gray-700">{passenger.studentNameSnapshot || "학생"}<span className={`rounded-full px-1.5 py-0.5 text-[10px] ${rideStatusClass(passenger.rideStatus)}`}>{rideStatusLabel(passenger.rideStatus)}</span>{selectedRoute.status === "DRAFT" && <button type="button" onClick={() => void mutate({ resource: "route", id: selectedRoute.id, action: "unassign", data: { shuttleRequestId: passenger.shuttleRequestId } }, "학생 배정을 해제했습니다.")} aria-label={`${passenger.studentNameSnapshot || "학생"} 배정 해제`} className="ml-1 text-base leading-none">×</button>}</span>)}</div></div></div></li> })}</ol>
        {!stops.length && <p className="rounded-xl bg-gray-50 p-8 text-center text-sm text-gray-500 dark:bg-gray-900">왼쪽 미배정 학생을 선택해 첫 정류장을 추가하세요.</p>}
      </> : <Empty title="노선을 선택해 주세요" description="노선을 만들거나 왼쪽 목록에서 편집할 노선을 선택해 주세요." />}</section>
    </div>}

    {modal === "vehicle" && <SimpleModal title="차량 등록" onClose={() => setModal(null)}><form onSubmit={(event) => void createResource(event, "vehicle")} className="space-y-4"><Input name="name" label="차량명" required placeholder="예: 스타리아 1호차" autoFocus /><Input name="plateNumber" label="차량번호" placeholder="예: 12가 3456" /><Input name="capacity" label="승차 정원" type="number" min="1" required /><Input name="notes" label="메모" /><ModalActions pending={pending} onClose={() => setModal(null)} /></form></SimpleModal>}
    {modal === "route" && <SimpleModal title={`${direction === "PICKUP" ? "등원" : "하원"} 노선 만들기`} onClose={() => setModal(null)}><form onSubmit={(event) => void createResource(event, "route")} className="space-y-4"><Input name="name" label="노선명" required placeholder="예: 여름특강 등원 A노선" autoFocus /><label className="block text-sm font-bold">차량<select name="vehicleId" required className="mt-1 min-h-11 w-full rounded-xl border border-gray-300 bg-white px-3 dark:border-gray-600 dark:bg-gray-900"><option value="">선택</option>{data.vehicles.filter((vehicle) => vehicle.isActive !== false).map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.name} ({vehicle.capacity}명)</option>)}</select></label><label className="block text-sm font-bold">담당 기사<select name="driverUserId" required className="mt-1 min-h-11 w-full rounded-xl border border-gray-300 bg-white px-3 dark:border-gray-600 dark:bg-gray-900"><option value="">기사 선택</option>{data.drivers.map((driver) => <option key={driver.id} value={driver.id}>{driver.name}{driver.phone ? ` (${driver.phone})` : ""}</option>)}</select></label><Input name="serviceDate" label="운행일" type="date" /><EndpointFields prefix="origin" label="출발지" /><EndpointFields prefix="destination" label="도착지" /><p className="text-xs text-gray-500">현재는 출발·도착 좌표를 직접 입력합니다. 다음 자동 경로 단계에서 지도 선택으로 교체됩니다.</p><ModalActions pending={pending} onClose={() => setModal(null)} /></form></SimpleModal>}
    {modal === "assign" && assignRequest && selectedRoute && (() => { const location = chosenLocation(assignRequest); return <SimpleModal title="학생 배정" onClose={() => setModal(null)}><form onSubmit={(event) => { event.preventDefault(); const values = Object.fromEntries(new FormData(event.currentTarget)); void mutate({ resource: "route", id: selectedRoute.id, action: "assign", data: { shuttleRequestId: assignRequest.id, stop: { name: values.name, address: location.address, roadAddress: location.roadAddress, lat: Number(location.lat), lng: Number(location.lng), plannedAt: values.plannedAt || undefined, note: location.note } } }, "학생을 노선에 배정했습니다."); }} className="space-y-4"><p className="rounded-xl bg-gray-50 p-3 text-sm dark:bg-gray-900"><strong>{assignRequest.childName || assignRequest.studentName}</strong><br />{location.address}</p><Input name="name" label="정류장 이름" required defaultValue={location.name} autoFocus /><Input name="plannedAt" label="예상 도착시간" type="time" /><ModalActions pending={pending} onClose={() => setModal(null)} submitLabel="배정" /></form></SimpleModal>; })()}
    {modal === "confirm" && selectedRoute && <SimpleModal title="노선을 확정하시겠습니까?" onClose={() => setModal(null)}><p className="text-sm leading-6 text-gray-600 dark:text-gray-300">확정 후에는 정류장 순서와 학생 배정을 직접 바꿀 수 없습니다. 변경하려면 새 수정 버전을 만들어야 합니다.</p><dl className="mt-4 grid grid-cols-2 gap-2"><Metric label="학생" value={`${passengerCount}명`} /><Metric label="정류장" value={`${stops.length}곳`} /></dl><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setModal(null)} className="min-h-11 rounded-xl border border-gray-300 px-4 font-bold dark:border-gray-600">취소</button><button type="button" disabled={pending} onClick={() => void mutate({ resource: "route", id: selectedRoute.id, action: "confirm", data: {} }, "노선을 확정했습니다.")} className="min-h-11 rounded-xl bg-[var(--brand-accent)] px-5 font-black text-[var(--brand-accent-contrast)] disabled:opacity-50">{pending ? "확정 중…" : "확정"}</button></div></SimpleModal>}
    {locationPicker && <LocationPickerModal title={`${locationPicker.request.childName || locationPicker.request.studentName || "학생"} ${locationPicker.kind === "pickup" ? "탑승" : "하차"} 위치 찍기`} initialValue={pickerInitialValue} confirmPending={pending} onClose={() => setLocationPicker(null)} onConfirm={(value) => void saveRequestLocation(locationPicker, value)} />}
  </main>;
}

function finiteCoordinate(value?: number | string | null) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function mapLocationSource(value?: string | null): MapLocationData["source"] {
  return value === "SEARCH" || value === "CURRENT_LOCATION" ? value : "MAP_PIN";
}

function mapLocationData(location?: RequestLocation | null): MapLocationData | undefined {
  const latitude = finiteCoordinate(location?.latitude ?? location?.lat);
  const longitude = finiteCoordinate(location?.longitude ?? location?.lng);
  if (latitude === null || longitude === null) return undefined;
  const accuracyMeters = finiteCoordinate(location?.accuracyMeters);
  return {
    address: location?.address || location?.roadAddress || location?.name || "지도에서 선택한 위치",
    roadAddress: location?.roadAddress || undefined,
    latitude,
    longitude,
    placeId: location?.placeId || undefined,
    source: mapLocationSource(location?.source),
    accuracyMeters: accuracyMeters ?? undefined,
  };
}

function Empty({ title, description }: { title: string; description: string }) { return <div className="rounded-2xl border border-dashed border-gray-300 p-10 text-center dark:border-gray-700"><h2 className="font-black">{title}</h2><p className="mt-2 text-sm text-gray-500">{description}</p></div>; }
function StatusBadge({ status }: { status: RouteStatus }) { const color = status === "CONFIRMED" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200" : status === "COMPLETED" ? "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-200" : status === "ARCHIVED" ? "bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-200" : "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200"; return <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-black ${color}`}>{STATUS_LABEL[status]}</span>; }
function summarizeRideStatuses(stops: Stop[]) { return stops.reduce((summary, stop) => { for (const passenger of stop.passengers ?? []) { if (passenger.rideStatus === "NO_SHOW") summary.noShow += 1; else if (passenger.rideStatus === "BOARDED" || passenger.rideStatus === "DROPPED_OFF") summary.done += 1; else summary.pending += 1; } return summary; }, { pending: 0, done: 0, noShow: 0 }); }
function rideStatusLabel(status?: string | null) { return status === "BOARDED" ? "탑승" : status === "DROPPED_OFF" ? "하차" : status === "NO_SHOW" ? "미탑승" : "대기"; }
function rideStatusClass(status?: string | null) { return status === "BOARDED" || status === "DROPPED_OFF" ? "bg-emerald-200 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100" : status === "NO_SHOW" ? "bg-red-200 text-red-900 dark:bg-red-900 dark:text-red-100" : "bg-gray-200 text-gray-600 dark:bg-gray-600 dark:text-gray-200"; }
function Metric({ label, value, danger }: { label: string; value: string; danger?: boolean }) { return <div className={`rounded-xl p-3 ${danger ? "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-200" : "bg-gray-50 dark:bg-gray-900"}`}><dt className="text-[11px] font-bold text-gray-500">{label}</dt><dd className="mt-1 break-words text-sm font-black">{value}</dd></div>; }
function SimpleModal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) { const id = `shuttle-modal-${title.replace(/\s/g, "-")}`; return <AdminModal titleId={id} onClose={onClose}><div className="p-5 sm:p-6"><header className="mb-5 flex items-center justify-between gap-3"><h2 id={id} className="text-xl font-black">{title}</h2><button type="button" onClick={onClose} aria-label="닫기" className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700"><FontFreeIcon name="close" size={20} /></button></header>{children}</div></AdminModal>; }
function Input({ label, autoFocus, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; autoFocus?: boolean }) { return <label className="block text-sm font-bold">{label}<input {...props} data-admin-modal-initial-focus={autoFocus ? "true" : undefined} className="mt-1 min-h-11 w-full rounded-xl border border-gray-300 bg-white px-3 text-gray-950 dark:border-gray-600 dark:bg-gray-900 dark:text-white" /></label>; }
function EndpointFields({ prefix, label }: { prefix: "origin" | "destination"; label: string }) { return <fieldset className="rounded-xl border border-gray-200 p-3 dark:border-gray-700"><legend className="px-1 text-sm font-black">{label}</legend><div className="grid gap-3 sm:grid-cols-2"><Input name={`${prefix}Name`} label="장소명" required /><Input name={`${prefix}Address`} label="주소" required /><Input name={`${prefix}Latitude`} label="위도" type="number" step="any" required /><Input name={`${prefix}Longitude`} label="경도" type="number" step="any" required /></div></fieldset>; }
function ModalActions({ pending, onClose, submitLabel = "저장" }: { pending: boolean; onClose: () => void; submitLabel?: string }) { return <div className="flex justify-end gap-2 pt-2"><button type="button" onClick={onClose} disabled={pending} className="min-h-11 rounded-xl border border-gray-300 px-4 font-bold dark:border-gray-600">취소</button><button disabled={pending} className="min-h-11 rounded-xl bg-[var(--brand-accent)] px-5 font-black text-[var(--brand-accent-contrast)] disabled:opacity-50">{pending ? "처리 중…" : submitLabel}</button></div>; }
