import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";
import { isRidingShuttleStatus, seasonalShuttleEligibilitySql } from "./shuttleEligibility";

// 방학특강 셔틀 통합 명단(학생 단위) — 기사님과 공유하던 시트를 앱으로 옮긴 편집형 뷰의 서버 로직.
// 한 학생(신청서)당 셔틀 신청 1건을 한 줄로 본다. 모든 쿼리는 PgBouncer 트랜잭션 모드 호환을 위해 $queryRawUnsafe.

export type ShuttleRosterRow = {
  requestId: string;
  ride: boolean; // 탑승 여부 (셔틀 신청 상태가 CANCELLED/REJECTED가 아님)
  childName: string; childGrade: string | null; childGender: string | null;
  childPhone: string | null; parentName: string | null; parentPhone: string | null;
  offeringTitle: string | null; classStart: string | null; classEnd: string | null;
  weekdayLabel: string | null;
  pickupLocation: string | null; pickupTime: string | null;
  pickupLat: number | null; pickupLng: number | null; pickupPinned: boolean; pickupApprox: boolean;
  dropoffLocation: string | null;
  dropoffLat: number | null; dropoffLng: number | null; dropoffPinned: boolean; dropoffApprox: boolean;
  dropoffSameAsPickup: boolean;
};

const WD_KO: Record<string, string> = { MON: "월", TUE: "화", WED: "수", THU: "목", FRI: "금", SAT: "토", SUN: "일" };
function weekdayLabel(arr: unknown): string | null {
  if (!Array.isArray(arr) || arr.length === 0) return null;
  return arr.map((k) => WD_KO[String(k)] ?? "").filter(Boolean).join("·") || null;
}
function num(v: unknown): number | null { return v == null ? null : Number(v); }

// 정밀 핀(MAP_PIN/CURRENT_LOCATION) vs 자동추정(SEARCH) 구분용
function pinned(src: unknown): boolean { return src === "MAP_PIN" || src === "CURRENT_LOCATION"; }
function approx(src: unknown, lat: unknown): boolean { return lat != null && src === "SEARCH"; }

/**
 * 셔틀 통합 명단 조회.
 *
 * 시즌 범위:
 * - `seasonId`를 주면 그 시즌만 본다.
 * - 안 주면 "보관(ARCHIVED)되지 않은 시즌"만 본다. (countPendingMakeups와 같은 기준)
 *   '가장 최근 시즌 1개'로 좁히지 않는 이유: 다음 방학 시즌을 미리 만들어 두는 순간
 *   운영 중인 이번 시즌 명단이 기사님 화면에서 통째로 사라진다. 그게 더 큰 사고다.
 */
export async function getSeasonalShuttleRoster(seasonId?: string | null): Promise<ShuttleRosterRow[]> {
  await requireAdmin();
  const params: unknown[] = [];
  let seasonWhere = `s.status <> 'ARCHIVED'`;
  if (seasonId) {
    params.push(seasonId);
    seasonWhere = `a."seasonId" = $1`;
  }
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT r.id AS "requestId", r.status,
            r."pickupLocation", r."pickupTime", r."pickupLatitude" AS "pLat", r."pickupLongitude" AS "pLng", r."pickupLocationSource" AS "pSrc",
            r."dropoffLocation", r."dropoffLatitude" AS "dLat", r."dropoffLongitude" AS "dLng", r."dropoffLocationSource" AS "dSrc",
            COALESCE(r."dropoffSameAsPickup", false) AS "same",
            a."childName", a."childGrade", a."childGender", a."childPhone", a."parentName", a."parentPhone", a."selectedWeekdays",
            o.title AS "offeringTitle",
            (SELECT to_char(min(sd."startsAt") AT TIME ZONE 'Asia/Seoul','HH24:MI') FROM "SpecialProgramSessionDate" sd WHERE sd."offeringId" = o.id) AS "classStart",
            (SELECT to_char(min(sd."endsAt")   AT TIME ZONE 'Asia/Seoul','HH24:MI') FROM "SpecialProgramSessionDate" sd WHERE sd."offeringId" = o.id) AS "classEnd"
       FROM "SpecialProgramShuttleRequest" r
       JOIN "SpecialProgramApplication" a ON a.id = r."applicationId"
       JOIN "SpecialProgramSeason" s ON s.id = a."seasonId"
       LEFT JOIN "SpecialProgramApplicationItem" it ON it.id = r."applicationItemId"
       LEFT JOIN "SpecialProgramOffering" o ON o.id = it."offeringId"
      -- 신청 취소·거절, 개설 취소된 반의 학생은 명단에서 완전히 뺀다(기사님이 태우면 안 되는 사람).
      -- 반면 셔틀 상태(r.status)는 여기서 거르지 않는다. '미탑승'으로 눌러둔 학생도 행은 남겨야
      -- 나중에 "역시 태워주세요" 연락이 왔을 때 화면에서 다시 탑승으로 되돌릴 수 있다.
      WHERE ${seasonWhere}
        AND ${seasonalShuttleEligibilitySql({ application: "a", item: "it", offering: "o" })}
      ORDER BY (r.status NOT IN ('CANCELLED','REJECTED')) DESC, "classStart" NULLS LAST, a."childName" ASC`,
    ...params,
  );
  return rows.map((r) => ({
    requestId: r.requestId,
    // REJECTED(거절)도 미탑승이다. `!== 'CANCELLED'`로만 보면 거절 건이 탑승으로 새어
    // 자동 배차(shuttle-optimize.ts)에까지 실린다.
    ride: isRidingShuttleStatus(r.status),
    childName: r.childName, childGrade: r.childGrade ?? null, childGender: r.childGender ?? null,
    childPhone: r.childPhone ?? null, parentName: r.parentName ?? null, parentPhone: r.parentPhone ?? null,
    offeringTitle: r.offeringTitle ?? null, classStart: r.classStart ?? null, classEnd: r.classEnd ?? null,
    weekdayLabel: weekdayLabel(r.selectedWeekdays),
    pickupLocation: r.pickupLocation ?? null, pickupTime: r.pickupTime ?? null,
    pickupLat: num(r.pLat), pickupLng: num(r.pLng), pickupPinned: pinned(r.pSrc), pickupApprox: approx(r.pSrc, r.pLat),
    dropoffLocation: r.dropoffLocation ?? null,
    dropoffLat: num(r.dLat), dropoffLng: num(r.dLng), dropoffPinned: pinned(r.dSrc), dropoffApprox: approx(r.dSrc, r.dLat),
    dropoffSameAsPickup: r.same === true,
  }));
}

function clean(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
}

export type ShuttleRosterPatch = {
  pickupLocation?: string; pickupTime?: string; dropoffLocation?: string;
  ride?: boolean; dropoffSameAsPickup?: boolean;
};

// 인라인 편집 저장. 지도 좌표(정밀 핀)는 여기서 바꾸지 않고, '등원과 동일'이 켜지면 등원 좌표를 하원으로 복제한다.
export async function updateShuttleRosterRow(requestId: string, patch: ShuttleRosterPatch) {
  await requireAdmin();
  if (!requestId) throw new Error("requestId required");

  // 스칼라(텍스트/시간/탑승여부) 필드 먼저 반영
  const sets: string[] = [];
  const args: unknown[] = [requestId];
  const push = (col: string, val: unknown) => { args.push(val); sets.push(`"${col}" = $${args.length}`); };
  if (patch.pickupLocation !== undefined) push("pickupLocation", clean(patch.pickupLocation, 200));
  if (patch.pickupTime !== undefined) push("pickupTime", clean(patch.pickupTime, 30));
  if (patch.dropoffLocation !== undefined) push("dropoffLocation", clean(patch.dropoffLocation, 200));
  if (patch.ride !== undefined) push("status", patch.ride ? "REQUESTED" : "CANCELLED");
  if (patch.dropoffSameAsPickup !== undefined) push("dropoffSameAsPickup", patch.dropoffSameAsPickup);
  if (sets.length > 0) {
    await prisma.$executeRawUnsafe(
      `UPDATE "SpecialProgramShuttleRequest" SET ${sets.join(", ")}, "updatedAt" = now() WHERE id = $1`,
      ...args,
    );
  }

  // '등원과 동일' 유효 상태 확인 후, 켜져 있으면 등원 좌표·주소를 하원으로 복제한다.
  const cur = await prisma.$queryRawUnsafe<any[]>(
    `SELECT COALESCE("dropoffSameAsPickup", false) AS same, "pickupLatitude" AS lat FROM "SpecialProgramShuttleRequest" WHERE id = $1`,
    requestId,
  );
  const same = cur[0]?.same === true;
  if (same) {
    // 등원에 좌표가 있으면 하원도 같은 좌표(제약조건 충족: 주소·source·confirmedAt·consent). 좌표 없으면 텍스트만 맞춘다.
    await prisma.$executeRawUnsafe(
      `UPDATE "SpecialProgramShuttleRequest"
          SET "dropoffLocation" = "pickupLocation",
              "dropoffAddress" = "pickupAddress",
              "dropoffRoadAddress" = "pickupRoadAddress",
              "dropoffLatitude" = "pickupLatitude",
              "dropoffLongitude" = "pickupLongitude",
              "dropoffPlaceId" = "pickupPlaceId",
              "dropoffLocationSource" = CASE WHEN "pickupLatitude" IS NOT NULL THEN COALESCE("pickupLocationSource", 'SEARCH') ELSE "dropoffLocationSource" END,
              "dropoffAccuracyMeters" = "pickupAccuracyMeters",
              "dropoffConfirmedAt" = CASE WHEN "pickupLatitude" IS NOT NULL THEN COALESCE("pickupConfirmedAt", now()) ELSE "dropoffConfirmedAt" END,
              "locationConsentVersion" = COALESCE("locationConsentVersion", '2026-07-21'),
              "updatedAt" = now()
        WHERE id = $1`,
      requestId,
    );
  }
  return { ok: true };
}
