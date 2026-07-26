import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";
// 저장 시점 이후의 수강상태 변동(결석·수강취소·폐강 등)을 "읽을 때" 반영하기 위해 유효 명단 게이트웨이를 쓴다.
// ⚠️ 순환 import 주의: shuttleRoster.ts는 dispatchRoute를 import하지 않으므로(단방향) 여기서 가져와도 안전하다.
//    shuttle-optimize.ts는 dispatchRoute를 import하므로, 반대로 여기서 shuttle-optimize를 import하면 순환이 된다.
//    그래서 Run/Stop 타입을 재사용하지 않고 이 파일 안에 최소 구조 타입을 직접 정의한다.
import { getConfirmedShuttleRosterForDate } from "./shuttleRoster";
// reconcile 로직은 의존성 없는 순수 모듈이 정본이다(shuttleRosterEdit.ts와 같은 이유 — 실제 실행 테스트 가능).
import { reconcileSavedVehicles } from "./dispatchReconcile";

// 저장된 배차 노선(SeasonalDispatchRoute) 읽기/쓰기.
// 자동 제안을 손으로 조정한 결과를 (날짜 × 방향) 단위로 1행 저장한다. PgBouncer 때문에 $queryRawUnsafe 고정.

export type SavedDispatchRoute = {
  vehicles: unknown[];
  classStart: string | null;
  classEnd: string | null;
  savedAt: string | null; // ISO
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
    if (d) {
      try {
        const plan = await getConfirmedShuttleRosterForDate(d, dir);
        const validIds = new Set(plan.riders.map((rider) => rider.shuttleRequestId));
        vehicles = reconcileSavedVehicles(savedVehicles, validIds);
      } catch {
        // 유효 명단 조회가 실패하면(테이블 없음 등) 저장본을 그대로 보여 준다 — 화면이 비는 것보다 안전하다.
        vehicles = savedVehicles;
      }
    }

    return {
      vehicles,
      classStart: (r.classStart as string | null) ?? null,
      classEnd: (r.classEnd as string | null) ?? null,
      savedAt: isoOrNull(r.updatedAt),
    };
  } catch {
    // 테이블이 아직 없는 환경 → 저장 없음으로 취급(화면은 자동 제안 그대로).
    return null;
  }
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
