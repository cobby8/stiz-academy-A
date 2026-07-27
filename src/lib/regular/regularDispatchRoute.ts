import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";
// reconcile/diff 는 의존성 없는 순수 공용 모듈이다(방학특강과 100% 공유).
// 유효 라이더 집합만 정규 명단(getRegularShuttleRiders)으로 바꿔 넘기면 그대로 동작한다.
import { reconcileSavedVehicles, diffSavedRoute } from "@/lib/seasonal/dispatchReconcile";
import type { SavedRouteChange } from "@/lib/seasonal/dispatchRoute";
import type { DispatchSuggestion } from "@/lib/seasonal/shuttle-optimize";
import { getRegularShuttleRiders } from "./shuttleRoster";
import { computeRegularDispatch } from "./shuttle-dispatch";

/**
 * 정규 셔틀 동적배차 — 저장 노선(RegularDispatchRoute) 읽기/쓰기 + 조회용 병합 (Phase 2b).
 *
 * 방학특강 dispatchRoute.ts / shuttle-optimize.getDispatchForView 를 **요일 기준**으로 이식한다.
 *   - 저장 단위: (요일 × 방향) 1행. ON CONFLICT("dayOfWeek","direction") DO UPDATE.
 *   - reconcile-on-read: 저장본을 읽을 때 그 요일 유효 라이더에 없는 학생을 자동 제거 + 라벨 자동갱신.
 *   - 유효 라이더 = getRegularShuttleRiders 의 studentId(= 배차 코어의 정차-학생 식별키) 집합.
 *
 * ⚠️ reconcileSavedVehicles·diffSavedRoute 는 방학특강과 같은 함수를 그대로 쓴다(중복 0).
 * ⚠️ 스키마 변경 없음(2a 테이블 소비). $queryRawUnsafe·PgBouncer 우회.
 */

// 무료탑승 거점 판정 — 방학특강 dispatchRoute.isFreeHubLabelLocal 과 같은 기준(정규는 거의 없지만 일관 유지).
function isFreeHubLabelLocal(label: string | null | undefined): boolean {
  return (label ?? "").replace(/\s/g, "").includes("무료탑승");
}

// Class.dayOfWeek 유효값만 통과시킨다(SQL 주입·오타 방어).
const VALID_DOW = new Set(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
function normDow(v: unknown): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  return VALID_DOW.has(s) ? s : null;
}
function normDir(v: unknown): "PICKUP" | "DROPOFF" | null {
  return v === "PICKUP" || v === "DROPOFF" ? v : null;
}
function isoOrNull(v: unknown): string | null {
  if (v == null) return null;
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export type SavedRegularDispatchRoute = {
  vehicles: unknown[];
  classStart: string | null;
  classEnd: string | null;
  savedAt: string | null;
  added: SavedRouteChange[];
  locationChanged: SavedRouteChange[];
};

/** 그 요일·방향의 저장된 정규 노선. 없으면 null. (reconcile-on-read 적용) */
export async function getSavedRegularDispatchRoute(
  dayOfWeek: string,
  direction: string,
): Promise<SavedRegularDispatchRoute | null> {
  const dow = normDow(dayOfWeek), dir = normDir(direction);
  if (!dow || !dir) return null;
  try {
    const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT "payload", "classStart", "classEnd", "updatedAt"
         FROM "RegularDispatchRoute"
        WHERE "dayOfWeek" = $1 AND "direction" = $2
        LIMIT 1`,
      dow, dir,
    );
    const r = rows[0];
    if (!r) return null;
    const payload = r.payload as { vehicles?: unknown[] } | null;
    const savedVehicles = Array.isArray(payload?.vehicles) ? payload!.vehicles! : [];

    let vehicles = savedVehicles;
    let added: SavedRouteChange[] = [];
    let locationChanged: SavedRouteChange[] = [];
    try {
      // 유효 라이더 = 그 요일 × 방향 정규 명단. 좌표 없는 이용자(unassigned)도 "유효 재적"으로 쳐서
      // reconcile 이 살려 두게 한다(좌표만 나중에 채우면 자연 복귀). 식별키 = studentId(= shuttleRequestId 대입).
      const roster = await getRegularShuttleRiders({ direction: dir, dayOfWeek: dow });
      const allRiders = [...roster.riders, ...roster.unassigned];
      const validIds = new Set(allRiders.map((rider) => rider.studentId));
      // studentId → 현재 명단 라벨(저장본의 얼어붙은 정차 라벨을 텍스트만 자동갱신).
      const labelByRequestId = new Map(allRiders.map((rider) => [rider.studentId, rider.placeLabel]));
      vehicles = reconcileSavedVehicles(savedVehicles, validIds, labelByRequestId);

      // 변동 감지(추가/위치변경) — diff 는 rider.shuttleRequestId/place 를 읽으므로 정규 라이더를 그 계약으로 어댑트한다.
      const diffRiders = allRiders.map((rider) => ({
        shuttleRequestId: rider.studentId,
        studentName: rider.studentName,
        place: { latitude: rider.place.latitude, longitude: rider.place.longitude },
      }));
      const diff = diffSavedRoute(vehicles, diffRiders);
      const byId = new Map(allRiders.map((rider) => [rider.studentId, rider]));
      const enrich = (c: { requestId: string; name: string }): SavedRouteChange => {
        const rider = byId.get(c.requestId);
        const isHub = isFreeHubLabelLocal(rider?.placeLabel);
        return {
          requestId: c.requestId, name: c.name,
          lat: rider && !isHub ? (rider.place.latitude ?? null) : null,
          lng: rider && !isHub ? (rider.place.longitude ?? null) : null,
          label: rider?.placeLabel ?? "", isHub,
          grade: rider?.childGrade ?? null, parentPhone: rider?.parentPhone ?? null,
          childPhone: rider?.childPhone ?? null, rosterId: null,
        };
      };
      added = diff.added.map(enrich);
      locationChanged = diff.locationChanged.map(enrich);
    } catch {
      // 명단 조회 실패 시 저장본을 그대로 보여 준다(화면이 비는 것보다 안전).
      vehicles = savedVehicles;
      added = [];
      locationChanged = [];
    }

    return {
      vehicles,
      classStart: (r.classStart as string | null) ?? null,
      classEnd: (r.classEnd as string | null) ?? null,
      savedAt: isoOrNull(r.updatedAt),
      added,
      locationChanged,
    };
  } catch {
    // 테이블이 아직 없는 환경 → 저장 없음으로 취급(화면은 자동 제안 그대로).
    return null;
  }
}

/** 조정된 정규 노선을 저장(덮어쓰기). 원장/관리자만. */
export async function saveRegularDispatchRoute(input: {
  dayOfWeek: string; direction: string; vehicles: unknown[];
  classStart?: string | null; classEnd?: string | null;
}): Promise<{ savedAt: string | null }> {
  const admin = await requireAdmin();
  const dow = normDow(input.dayOfWeek), dir = normDir(input.direction);
  if (!dow || !dir) throw new Error("요일 또는 방향이 올바르지 않습니다.");
  const vehicles = Array.isArray(input.vehicles) ? input.vehicles : [];
  const payloadJson = JSON.stringify({ vehicles });
  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `INSERT INTO "RegularDispatchRoute" ("dayOfWeek","direction","payload","classStart","classEnd","savedByUserId","updatedAt")
     VALUES ($1, $2, $3::jsonb, $4, $5, $6, now())
     ON CONFLICT ("dayOfWeek","direction") DO UPDATE SET
       "payload" = EXCLUDED."payload",
       "classStart" = EXCLUDED."classStart",
       "classEnd" = EXCLUDED."classEnd",
       "savedByUserId" = EXCLUDED."savedByUserId",
       "updatedAt" = now()
     RETURNING "updatedAt"`,
    dow, dir, payloadJson,
    input.classStart ?? null, input.classEnd ?? null, admin.appUserId ?? null,
  );
  return { savedAt: isoOrNull(rows[0]?.updatedAt) };
}

/**
 * 조회용 노선(요일 × 방향) — 방학특강 getDispatchForView 의 정규판.
 *   1) 저장본이 있으면 그대로(reconcile 반영) 쓴다(T맵 0회).
 *   2) 없으면 allowTmap=true 면 T맵으로 새로 계산(관리자 첫 진입), false 면 직선 추정(base).
 */
export async function getRegularDispatchForView(
  dayOfWeek: string,
  direction: "PICKUP" | "DROPOFF",
  allowTmap: boolean,
): Promise<DispatchSuggestion> {
  const dow = normDow(dayOfWeek) ?? "Mon";
  // 먼저 T맵 없이 기준정보를 얻는다(직선 추정 base).
  const base = await computeRegularDispatch({ direction, dayOfWeek: dow, localOnly: true });
  const saved = await getSavedRegularDispatchRoute(dow, direction);
  if (saved && Array.isArray(saved.vehicles) && saved.vehicles.length) {
    return {
      ...base,
      vehicles: saved.vehicles as DispatchSuggestion["vehicles"],
      classStart: saved.classStart ?? base.classStart,
      classEnd: saved.classEnd ?? base.classEnd,
      routingProvider: "TMAP",
      added: saved.added as DispatchSuggestion["added"],
      locationChanged: saved.locationChanged as DispatchSuggestion["locationChanged"],
    };
  }
  // 저장본이 없을 때만: 관리자 첫 진입은 T맵으로 계산, 그 외는 직선 추정 base.
  return allowTmap ? computeRegularDispatch({ direction, dayOfWeek: dow, localOnly: false }) : base;
}
