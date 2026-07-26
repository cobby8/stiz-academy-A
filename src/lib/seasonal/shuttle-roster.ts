import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";
import { getConfirmedShuttleRoster } from "./shuttleRoster";

// 방학특강 셔틀 통합 명단(학생 단위) — 기사님과 공유하던 시트를 앱으로 옮긴 편집형 뷰의 서버 로직.
// 한 학생(신청서)당 셔틀 신청 1건을 한 줄로 본다. 모든 쿼리는 PgBouncer 트랜잭션 모드 호환을 위해 $queryRawUnsafe.

export type ShuttleRosterRow = {
  requestId: string;
  applicationId: string;
  ride: boolean; // 탑승 여부 (status !== 'CANCELLED')
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

// 대상자 조회는 여기서 직접 짜지 않는다. 화면마다 SQL을 새로 쓰다가 취소 신청·폐강 반 필터가
// 빠지는 사고가 6번 반복됐다. 명단의 출처는 확정 명단 게이트웨이 하나로 고정한다.
export async function getSeasonalShuttleRoster(): Promise<ShuttleRosterRow[]> {
  await requireAdmin();
  const entries = await getConfirmedShuttleRoster();
  return entries.map((e) => ({
    requestId: e.shuttleRequestId,
    applicationId: e.applicationId ?? "",
    ride: e.ride,
    childName: e.studentName, childGrade: e.childGrade, childGender: e.childGender,
    childPhone: e.childPhone, parentName: e.parentName, parentPhone: e.parentPhone,
    offeringTitle: e.offeringTitle, classStart: e.classStart, classEnd: e.classEnd,
    weekdayLabel: weekdayLabel(e.weekdays),
    pickupLocation: e.pickup.location, pickupTime: e.pickupTime,
    pickupLat: e.pickup.latitude, pickupLng: e.pickup.longitude,
    pickupPinned: pinned(e.pickup.source), pickupApprox: approx(e.pickup.source, e.pickup.latitude),
    dropoffLocation: e.dropoff.location,
    dropoffLat: e.dropoff.latitude, dropoffLng: e.dropoff.longitude,
    dropoffPinned: pinned(e.dropoff.source), dropoffApprox: approx(e.dropoff.source, e.dropoff.latitude),
    dropoffSameAsPickup: e.dropoffSameAsPickup,
  }));
}

function clean(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
}

export type PinInput = {
  latitude: number; longitude: number; address?: string; roadAddress?: string;
  source?: string; placeId?: string; accuracyMeters?: number;
};
export type ShuttleRosterPatch = {
  pickupLocation?: string; pickupTime?: string; dropoffLocation?: string;
  ride?: boolean; dropoffSameAsPickup?: boolean;
  pickupPin?: PinInput; dropoffPin?: PinInput; // 지도 핀(정밀 좌표) 설정
};

const VALID_SOURCE = new Set(["MAP_PIN", "SEARCH", "CURRENT_LOCATION"]);

// 지도 핀 좌표를 등원/하원에 반영(제약조건 충족: 주소·source·confirmedAt·consent 필수)
async function applyPin(requestId: string, kind: "pickup" | "dropoff", pin: PinInput) {
  const lat = Number(pin.latitude), lng = Number(pin.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) return;
  const src = pin.source && VALID_SOURCE.has(pin.source) ? pin.source : "MAP_PIN";
  const address = clean(pin.address, 300) ?? clean(pin.roadAddress, 300) ?? "지도에서 선택한 위치";
  const roadAddress = clean(pin.roadAddress, 300);
  const placeId = clean(pin.placeId, 200);
  const acc = pin.accuracyMeters != null && Number.isFinite(Number(pin.accuracyMeters)) ? Math.max(0, Number(pin.accuracyMeters)) : null;
  await prisma.$executeRawUnsafe(
    `UPDATE "SpecialProgramShuttleRequest" SET
        "${kind}Latitude" = $2, "${kind}Longitude" = $3, "${kind}Address" = $4, "${kind}RoadAddress" = $5,
        "${kind}LocationSource" = $6, "${kind}PlaceId" = $7, "${kind}AccuracyMeters" = $8, "${kind}ConfirmedAt" = now(),
        -- 표시 라벨(건물/상호명)은 유지: 비어 있을 때만 주소로 채운다(핀이 이름을 덮어쓰지 않음)
        "${kind}Location" = COALESCE(NULLIF(btrim("${kind}Location"), ''), $4),
        "locationConsentVersion" = COALESCE("locationConsentVersion", '2026-07-21'),
        "updatedAt" = now()
      WHERE id = $1`,
    requestId, lat, lng, address, roadAddress, src, placeId, acc,
  );
}

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

  // 지도 핀 좌표 반영
  if (patch.pickupPin) await applyPin(requestId, "pickup", patch.pickupPin);
  if (patch.dropoffPin) await applyPin(requestId, "dropoff", patch.dropoffPin);

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
