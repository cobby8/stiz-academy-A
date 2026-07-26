import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";
// 저장 시점 이후의 수강상태 변동(결석·수강취소·폐강 등)을 "읽을 때" 반영하기 위해 유효 명단 게이트웨이를 쓴다.
// ⚠️ 순환 import 주의: shuttleRoster.ts는 dispatchRoute를 import하지 않으므로(단방향) 여기서 가져와도 안전하다.
//    shuttle-optimize.ts는 dispatchRoute를 import하므로, 반대로 여기서 shuttle-optimize를 import하면 순환이 된다.
//    그래서 Run/Stop 타입을 재사용하지 않고 이 파일 안에 최소 구조 타입을 직접 정의한다.
import { getConfirmedShuttleRosterForDate } from "./shuttleRoster";
// reconcile 로직은 의존성 없는 순수 모듈이 정본이다(shuttleRosterEdit.ts와 같은 이유 — 실제 실행 테스트 가능).
import { reconcileSavedVehicles, diffSavedRoute } from "./dispatchReconcile";
// 저장 payload에서 requestId별 확정 정차 라벨을 뽑는 순수 로직(학부모 마이페이지 확정시각 표시에 쓴다).
import { extractEtaByRequestId } from "./dispatchEtaLookup";

// 저장된 배차 노선(SeasonalDispatchRoute) 읽기/쓰기.
// 자동 제안을 손으로 조정한 결과를 (날짜 × 방향) 단위로 1행 저장한다. PgBouncer 때문에 $queryRawUnsafe 고정.

// 저장 노선 이후의 "추가/변경" 요약(Phase 2a). 저장본을 바꾸지 않고 화면 배너에만 쓰는 진단값이다.
// 화면에서 '추천 배정'·'좌표 자동 반영'을 하려면 좌표·라벨·학생정보까지 필요하므로 함께 실어 보낸다.
export type SavedRouteChange = {
  requestId: string; name: string;
  lat: number | null; lng: number | null; // 현재(변경 후) 좌표. isHub이거나 미확정이면 null.
  label: string; isHub: boolean;
  grade: string | null; parentPhone: string | null; childPhone: string | null; rosterId: string | null;
};

// 무료탑승 거점 학생 판정 — shuttle-optimize.isFreeHubLabel과 같은 기준(순환 import 회피 위해 여기 복제).
function isFreeHubLabelLocal(label: string | null | undefined): boolean {
  return (label ?? "").replace(/\s/g, "").includes("무료탑승");
}

export type SavedDispatchRoute = {
  vehicles: unknown[];
  classStart: string | null;
  classEnd: string | null;
  savedAt: string | null; // ISO
  /** 저장 노선에 없던 신규·복귀 대상자(그날 유효 명단 기준). 없으면 빈 배열. */
  added: SavedRouteChange[];
  /** 저장 노선에는 있으나 좌표가 바뀐 대상자. 없으면 빈 배열. */
  locationChanged: SavedRouteChange[];
};

function isoOrNull(v: unknown): string | null {
  if (v == null) return null;
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function normDate(v: unknown): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}
function normDir(v: unknown): "PICKUP" | "DROPOFF" | null {
  return v === "PICKUP" || v === "DROPOFF" ? v : null;
}

/** 그 날짜·방향의 저장된 노선. 없으면 null. */
export async function getSavedDispatchRoute(date: string | null, direction: string): Promise<SavedDispatchRoute | null> {
  const d = normDate(date), dir = normDir(direction);
  if (!d || !dir) return null;
  try {
    const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT "payload", "classStart", "classEnd", "updatedAt"
         FROM "SeasonalDispatchRoute"
        WHERE "serviceDate" = $1 AND "direction" = $2
        LIMIT 1`,
      d, dir,
    );
    const r = rows[0];
    if (!r) return null;
    const payload = r.payload as { vehicles?: unknown[] } | null;
    const savedVehicles = Array.isArray(payload?.vehicles) ? payload!.vehicles! : [];

    // reconcile-on-read: d(날짜)가 있을 때만 그날 유효 명단으로 필터한다.
    // date가 null이면 애초에 위에서 return null이라 여기 오지 않지만, 방어적으로 스킵 조건을 둔다.
    // ★ DB는 절대 건드리지 않는다(읽기 필터만). 학생이 다시 유효해지면 자동으로 다시 나타난다(자가치유).
    let vehicles = savedVehicles;
    // 변동 감지 결과(Phase 2a). 명단 조회가 안 되면 빈 배열로 둔다(배너가 안 뜰 뿐, 저장본은 그대로 보인다).
    let added: SavedRouteChange[] = [];
    let locationChanged: SavedRouteChange[] = [];
    if (d) {
      try {
        const plan = await getConfirmedShuttleRosterForDate(d, dir);
        const validIds = new Set(plan.riders.map((rider) => rider.shuttleRequestId));
        vehicles = reconcileSavedVehicles(savedVehicles, validIds);
        // reconcile 후(= 실제로 화면에 보이는) 노선과 그날 명단을 비교해 추가/변경만 뽑는다.
        // ★ 저장 payload는 절대 바꾸지 않는다 — diff는 순수 읽기 진단이다.
        const diff = diffSavedRoute(vehicles, plan.riders);
        // 좌표·라벨·학생정보로 살찌운다(화면의 추천 배정·좌표 자동 반영용). 명단에서 그 학생을 되짚어 채운다.
        const byId = new Map(plan.riders.map((rider) => [rider.shuttleRequestId, rider]));
        const enrich = (c: { requestId: string; name: string }): SavedRouteChange => {
          const r = byId.get(c.requestId);
          const isHub = isFreeHubLabelLocal(r?.placeLabel);
          return {
            requestId: c.requestId, name: c.name,
            lat: r && !isHub ? (r.place.latitude ?? null) : null,
            lng: r && !isHub ? (r.place.longitude ?? null) : null,
            label: r?.placeLabel ?? "", isHub,
            grade: r?.childGrade ?? null, parentPhone: r?.parentPhone ?? null,
            childPhone: r?.childPhone ?? null, rosterId: r?.rosterId ?? null,
          };
        };
        added = diff.added.map(enrich);
        locationChanged = diff.locationChanged.map(enrich);
      } catch {
        // 유효 명단 조회가 실패하면(테이블 없음 등) 저장본을 그대로 보여 준다 — 화면이 비는 것보다 안전하다.
        vehicles = savedVehicles;
        added = [];
        locationChanged = [];
      }
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

/** 한 학생의 확정 승/하차 시각 라벨. 없으면 null. */
export type ConfirmedDispatchEta = { pickupEtaLabel: string | null; dropoffEtaLabel: string | null };

/**
 * 셔틀 신청 id들에 대해 "확정 승/하차 시각"을 저장된 배차 노선에서 찾아 돌려준다(학부모 마이페이지 T3).
 *
 * 왜 이렇게 조회하나:
 *   방학특강 셔틀의 확정 시각은 정규반처럼 ShuttleRoutePassenger.stop에 있지 않고,
 *   (날짜 × 방향) 단위로 저장된 SeasonalDispatchRoute.payload의 각 정차 etaLabel에 들어 있다.
 *   노선은 날짜별로 여러 건이지만 시각은 대체로 일정하므로 방향별 **대표 1건**만 쓴다.
 *   → 최근 저장분(updatedAt DESC)부터 훑어 그 학생이 처음 나타난 정차의 라벨을 채운다.
 *
 * 권한: 조회 함수는 인증하지 않는다(게이트웨이 조회 함수와 동일 원칙). 호출부(parent.ts)가
 *   이미 본인 자녀의 shuttleRequestId만 넘기므로 여기서 학생을 다시 필터하지 않는다(IDOR 안전).
 *   requestId 목록에 없는 학생 것은 애초에 결과에 담기지 않는다.
 */
export async function getConfirmedDispatchEtas(
  requestIds: string[],
): Promise<Map<string, ConfirmedDispatchEta>> {
  const result = new Map<string, ConfirmedDispatchEta>();
  const ids = [...new Set((requestIds ?? []).filter((x): x is string => typeof x === "string" && x !== ""))];
  if (ids.length === 0) return result;
  const want = new Set(ids);
  for (const id of ids) result.set(id, { pickupEtaLabel: null, dropoffEtaLabel: null });

  try {
    // 저장 노선은 시즌당 (운행일 × 2방향) 수십 행 수준이라 전체를 훑어도 가볍다.
    // 최근 저장분을 먼저 만나도록 정렬 → 아래에서 "아직 비어 있을 때만" 채워 대표 1건을 고른다.
    const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT "direction", "payload" FROM "SeasonalDispatchRoute" ORDER BY "updatedAt" DESC`,
    );
    for (const r of rows) {
      const dir = normDir(r.direction);
      if (!dir) continue;
      const payload = r.payload as { vehicles?: unknown } | null;
      const byId = extractEtaByRequestId(payload?.vehicles, dir);
      if (byId.size === 0) continue;
      for (const id of want) {
        const label = byId.get(id);
        if (!label) continue;
        const cur = result.get(id)!;
        if (dir === "PICKUP" && cur.pickupEtaLabel == null) cur.pickupEtaLabel = label;
        if (dir === "DROPOFF" && cur.dropoffEtaLabel == null) cur.dropoffEtaLabel = label;
      }
    }
  } catch {
    // 테이블이 없는 구버전 DB 등 → 시각 없음으로 둔다(학부모 화면은 종전과 동일하게 보인다).
  }
  return result;
}

/** 조정된 노선을 저장(덮어쓰기). 원장/관리자만. */
export async function saveDispatchRoute(input: {
  date: string; direction: string; vehicles: unknown[]; classStart?: string | null; classEnd?: string | null;
}): Promise<{ savedAt: string | null }> {
  const admin = await requireAdmin();
  const d = normDate(input.date), dir = normDir(input.direction);
  if (!d || !dir) throw new Error("날짜 또는 방향이 올바르지 않습니다.");
  const vehicles = Array.isArray(input.vehicles) ? input.vehicles : [];
  const payloadJson = JSON.stringify({ vehicles });
  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `INSERT INTO "SeasonalDispatchRoute" ("serviceDate","direction","payload","classStart","classEnd","savedByUserId","updatedAt")
     VALUES ($1, $2, $3::jsonb, $4, $5, $6, now())
     ON CONFLICT ("serviceDate","direction") DO UPDATE SET
       "payload" = EXCLUDED."payload",
       "classStart" = EXCLUDED."classStart",
       "classEnd" = EXCLUDED."classEnd",
       "savedByUserId" = EXCLUDED."savedByUserId",
       "updatedAt" = now()
     RETURNING "updatedAt"`,
    d, dir, payloadJson,
    input.classStart ?? null, input.classEnd ?? null, admin.appUserId ?? null,
  );
  return { savedAt: isoOrNull(rows[0]?.updatedAt) };
}
