import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";
import { parseRegularShuttleSheet, type RegularShuttleStop } from "./regularSheet";

// 정규 셔틀 운행리스트: 구글 시트 → 앱 DB 월별 이관 + 조회. PgBouncer 때문에 $queryRawUnsafe/$executeRawUnsafe 고정.

export function normalizeServiceMonth(value: string | null | undefined): string {
  const month = String(value ?? "").trim();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error("적용 월은 YYYY-MM 형식이어야 합니다.");
  return month;
}

// 구글 시트 URL(편집/보기)을 CSV export URL로 바꾼다.
export function toCsvExportUrl(sheetUrl: string): string | null {
  const id = sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)?.[1];
  if (!id) return null;
  const gid = sheetUrl.match(/[#&?]gid=(\d+)/)?.[1] ?? "0";
  return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`;
}

/** 시트를 가져와 파싱한 뒤 해당 월의 RegularShuttleStop만 교체한다(원장 전용). */
type RosterIdentity = { id: string; name: string; studentPhone: string | null; parentPhones: string[]; monthStatus: string | null };
function phoneDigits(value: string | null | undefined): string { return String(value ?? "").replace(/\D/g, ""); }
function normalizedName(value: string | null | undefined): string { return String(value ?? "").replace(/\s/g, "").toLowerCase(); }

async function reconcileActiveStudents(stops: RegularShuttleStop[], serviceMonth: string): Promise<{ stops: RegularShuttleStop[]; excluded: string[]; held: string[] }> {
  const [targetYear, targetMonth] = serviceMonth.split("-").map(Number);
  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `WITH latest_batch AS (
       SELECT id FROM "StudentSheetImportBatch" WHERE status='COMPLETED' ORDER BY "createdAt" DESC LIMIT 1
     ), month_status AS (
       SELECT l."studentId",
              CASE WHEN BOOL_OR(l.status='ACTIVE') THEN 'ACTIVE'
                   WHEN BOOL_OR(l.status='PAUSED') THEN 'PAUSED'
                   WHEN BOOL_OR(l.status='WITHDRAWN') THEN 'WITHDRAWN'
                   ELSE 'WITHDRAWN' END AS status
         FROM "StudentRegistrationLedger" l
         JOIN latest_batch b ON b.id=l."batchId"
        WHERE l."studentId" IS NOT NULL
          AND NULLIF((regexp_match(COALESCE(l."registrationMonth",''), '(20\\d{2})'))[1], '')::int=$1
          AND NULLIF((regexp_match(COALESCE(l."registrationMonth",''), '(?:20\\d{2})[^0-9]+(1[0-2]|0?[1-9])'))[1], '')::int=$2
        GROUP BY l."studentId"
     )
     SELECT s."id", s."name", s."phone" AS "studentPhone", u."phone" AS "userPhone",
            COALESCE(array_agg(DISTINCT g."phone") FILTER (WHERE g."phone" IS NOT NULL), '{}') AS "guardianPhones",
            ms.status AS "monthStatus"
       FROM "Student" s
       LEFT JOIN "User" u ON u."id"=s."parentId"
       LEFT JOIN "Guardian" g ON g."studentId"=s."id"
       LEFT JOIN month_status ms ON ms."studentId"=s.id
      WHERE s."mergedIntoStudentId" IS NULL
      GROUP BY s."id",s."name",s."phone",u."phone",ms.status`,
    targetYear, targetMonth,
  );
  const identities: RosterIdentity[] = rows.map((row) => ({
    id: String(row.id), name: String(row.name ?? ""), studentPhone: row.studentPhone ? String(row.studentPhone) : null,
    parentPhones: [row.userPhone, ...(Array.isArray(row.guardianPhones) ? row.guardianPhones : [])].map((v) => String(v ?? "")).filter(Boolean),
    monthStatus: row.monthStatus ? String(row.monthStatus) : null,
  }));
  const byName = new Map<string, RosterIdentity[]>();
  for (const identity of identities) {
    const key = normalizedName(identity.name); byName.set(key, [...(byName.get(key) ?? []), identity]);
  }
  const excluded = new Set<string>(); const held = new Set<string>();
  const kept = stops.flatMap((stop) => {
    if (!stop.studentName || !["BOARD", "ALIGHT"].includes(stop.direction)) return [stop];
    const candidates = byName.get(normalizedName(stop.studentName)) ?? [];
    const parentPhone = phoneDigits(stop.parentPhone); const studentPhone = phoneDigits(stop.studentPhone);
    const matched = candidates.filter((identity) =>
      (parentPhone && identity.parentPhones.some((phone) => phoneDigits(phone) === parentPhone))
      || (studentPhone && phoneDigits(identity.studentPhone) === studentPhone),
    );
    const resolved = matched.length === 1 ? matched[0] : (!parentPhone && !studentPhone && candidates.length === 1 ? candidates[0] : null);
    // 확인보류 행은 기사 명단·배차에 섞지 않는다. 사용자가 신원을 확정한 뒤 다시 이관한다.
    if (!resolved) { held.add(stop.studentName); return []; }
    // 대상 월 원장이 없으면 현재 Enrollment를 추측값으로 사용하지 않고 확인보류한다.
    if (resolved.monthStatus == null) { held.add(stop.studentName); return []; }
    if (resolved.monthStatus !== "ACTIVE") { excluded.add(stop.studentName); return []; }
    return [{ ...stop, studentId: resolved.id }];
  });
  return { stops: kept, excluded: [...excluded].sort(), held: [...held].sort() };
}

export async function importRegularShuttleFromSheet(sheetUrl: string, serviceMonth: string): Promise<{ imported: number; title: string | null; serviceMonth: string; excluded: string[]; held: string[] }> {
  await requireAdmin();
  const month = normalizeServiceMonth(serviceMonth);
  const csvUrl = toCsvExportUrl(sheetUrl);
  if (!csvUrl) throw new Error("올바른 구글 시트 URL이 아닙니다.");
  const res = await fetch(csvUrl, { cache: "no-store", redirect: "follow" });
  if (!res.ok) throw new Error("시트를 불러오지 못했습니다. '링크 있는 모든 사용자' 공개인지 확인해주세요.");
  const csv = await res.text();
  if (/<html/i.test(csv.slice(0, 200))) throw new Error("시트가 공개되어 있지 않습니다(로그인 페이지 응답).");
  const parsed = parseRegularShuttleSheet(csv);
  if (parsed.stops.length === 0) throw new Error("시트에서 유효한 운행 정차를 찾지 못했습니다. 형식을 확인해주세요.");
  const reconciled = await reconcileActiveStudents(parsed.stops, month);
  const stops = reconciled.stops;
  const studentRows = parsed.stops.filter((stop) => stop.studentName && ["BOARD", "ALIGHT"].includes(stop.direction)).length;
  const heldLimit = Math.max(5, Math.ceil(studentRows * 0.1));
  if (reconciled.held.length >= heldLimit) {
    throw new Error(`확인보류 ${reconciled.held.length}명이 임계치(${heldLimit}명) 이상이라 차량표를 교체하지 않았습니다. 신원을 확인한 뒤 다시 가져오세요.`);
  }

  // 같은 정류장 좌표는 이전 스냅샷에서 승계한다. 해당 월만 교체하므로 과거 비교 원장은 보존된다.
  const coords = await prisma.$queryRawUnsafe<{ stopName: string; latitude: number; longitude: number }[]>(
    `SELECT DISTINCT ON ("stopName") "stopName","latitude","longitude"
       FROM "RegularShuttleStop"
      WHERE "latitude" IS NOT NULL AND "longitude" IS NOT NULL
      ORDER BY "stopName", "importedAt" DESC`,
  );
  const coordByName = new Map(coords.map((row) => [row.stopName, row]));
  // 월 스냅샷 교체는 한 트랜잭션으로 묶어, 한 행이라도 실패하면 기존 차량표를 온전히 보존한다.
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`DELETE FROM "RegularShuttleStop" WHERE "serviceMonth"=$1`, month);
    for (const s of stops) {
      const coord = coordByName.get(s.stopName);
      await tx.$executeRawUnsafe(
        `INSERT INTO "RegularShuttleStop"
          ("serviceMonth","weekday","classTime","arriveTime","stopName","direction","studentName","studentId","studentPhone","parentPhone","note","sortOrder","latitude","longitude")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        month,
        s.weekday, s.classTime, s.arriveTime, s.stopName, s.direction,
        s.studentName, s.studentId ?? null, s.studentPhone, s.parentPhone, s.note, s.sortOrder,
        coord?.latitude ?? null, coord?.longitude ?? null,
      );
    }
  });
  return { imported: stops.length, title: parsed.title, serviceMonth: month, excluded: reconciled.excluded, held: reconciled.held };
}

/** 저장된 월 목록. 최신 월부터 표시한다. */
export async function getRegularShuttleMonths(): Promise<string[]> {
  try {
    const rows = await prisma.$queryRawUnsafe<{ serviceMonth: string }[]>(
      `SELECT DISTINCT "serviceMonth" FROM "RegularShuttleStop" ORDER BY "serviceMonth" DESC`,
    );
    return rows.map((row) => String(row.serviceMonth)).filter((month) => /^\d{4}-\d{2}$/.test(month));
  } catch { return []; }
}

/** 좌표(latitude)가 아직 없는 '고유 정류장 이름' 목록을 돌려준다(빈 이름 제외). 1회용 좌표 채우기 화면용. */
export async function getRegularStopsWithoutCoords(serviceMonth?: string): Promise<string[]> {
  try {
    // latitude 가 null 인 행들의 정류장 이름을 중복 없이(대소문자·공백 유지) 조회.
    const rows = await prisma.$queryRawUnsafe<{ stopName: string }[]>(
      `SELECT DISTINCT "stopName"
         FROM "RegularShuttleStop"
        WHERE "latitude" IS NULL AND COALESCE(TRIM("stopName"), '') <> ''
          AND ($1::text IS NULL OR "serviceMonth"=$1)
        ORDER BY "stopName" ASC`,
      serviceMonth ?? null,
    );
    return rows.map((r) => String(r.stopName ?? "").trim()).filter(Boolean);
  } catch {
    // 테이블이 없거나 조회 실패 시 빈 목록(화면은 "채울 정류장 없음"으로 안전 처리).
    return [];
  }
}

/** 정류장 이름별 좌표를 저장한다. 같은 이름의 모든 행에 동일 좌표를 채운다(원장 전용). */
export async function saveRegularStopCoords(
  entries: { stopName: string; latitude: number; longitude: number }[],
): Promise<{ updated: number }> {
  await requireAdmin();
  let updated = 0;
  for (const e of entries) {
    const name = (e.stopName ?? "").trim();
    if (!name || !Number.isFinite(e.latitude) || !Number.isFinite(e.longitude)) continue;
    const n = await prisma.$executeRawUnsafe(
      `UPDATE "RegularShuttleStop" SET "latitude"=$1,"longitude"=$2 WHERE "stopName"=$3`,
      e.latitude, e.longitude, name,
    );
    updated += Number(n) || 0;
  }
  return { updated };
}

/** 정규 셔틀 정차의 순서(sortOrder)·도착시각(arriveTime)을 저장한다(원장 전용). id 기준 개별 갱신. */
export async function saveRegularStopOrder(
  updates: { id: string; sortOrder: number; arriveTime: string | null }[],
  serviceMonth: string,
): Promise<{ updated: number }> {
  await requireAdmin();
  const month = normalizeServiceMonth(serviceMonth);
  const updated = await prisma.$transaction(async (tx) => {
    let count = 0;
    for (const u of updates) {
      const id = (u.id ?? "").trim();
      if (!id || !Number.isFinite(u.sortOrder)) continue;
      const arrive = typeof u.arriveTime === "string" && /^\d{1,2}:\d{2}$/.test(u.arriveTime.trim()) ? u.arriveTime.trim() : null;
      const n = await tx.$executeRawUnsafe(
        `UPDATE "RegularShuttleStop" SET "sortOrder"=$1,"arriveTime"=$2 WHERE "id"=$3 AND "serviceMonth"=$4`,
        Math.round(u.sortOrder), arrive, id, month,
      );
      count += Number(n) || 0;
    }
    if (count !== updates.length) throw new Error("일부 정차가 선택한 월에 없어 저장을 취소했습니다. 차량표를 새로고침해 주세요.");
    return count;
  });
  return { updated };
}

/** 저장된 정규 셔틀 정차를 요일 순·시간 순으로 돌려준다. */
export async function getRegularShuttleStops(serviceMonth?: string): Promise<{ stops: RegularShuttleStop[]; importedAt: string | null; serviceMonth: string | null; months: string[] }> {
  try {
    const months = await getRegularShuttleMonths();
    const month = serviceMonth ? normalizeServiceMonth(serviceMonth) : (months[0] ?? null);
    if (!month) return { stops: [], importedAt: null, serviceMonth: null, months };
    const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT "id","serviceMonth","weekday","classTime","arriveTime","stopName","direction","studentName","studentId","studentPhone","parentPhone","note","sortOrder","latitude","longitude","importedAt"
         FROM "RegularShuttleStop" WHERE "serviceMonth"=$1 ORDER BY "weekday" ASC, "sortOrder" ASC`,
      month,
    );
    const WD = ["일", "월", "화", "수", "목", "금", "토"];
    const stops: RegularShuttleStop[] = rows.map((r) => ({
      id: r.id != null ? String(r.id) : undefined,
      serviceMonth: String(r.serviceMonth ?? month),
      weekday: Number(r.weekday),
      weekdayLabel: WD[Number(r.weekday)] ?? "",
      classTime: (r.classTime as string | null) ?? null,
      arriveTime: (r.arriveTime as string | null) ?? null,
      stopName: String(r.stopName ?? ""),
      direction: (["BOARD", "ALIGHT", "PIVOT", "RETURN"].includes(String(r.direction)) ? r.direction : "BOARD") as RegularShuttleStop["direction"],
      studentName: (r.studentName as string | null) ?? null,
      studentId: (r.studentId as string | null) ?? null,
      studentPhone: (r.studentPhone as string | null) ?? null,
      parentPhone: (r.parentPhone as string | null) ?? null,
      note: (r.note as string | null) ?? null,
      sortOrder: Number(r.sortOrder) || 0,
      latitude: r.latitude != null ? Number(r.latitude) : null,
      longitude: r.longitude != null ? Number(r.longitude) : null,
    }));
    const importedAt = rows[0]?.importedAt ? new Date(String(rows[0].importedAt)).toISOString() : null;
    return { stops, importedAt, serviceMonth: month, months };
  } catch {
    return { stops: [], importedAt: null, serviceMonth: null, months: [] };
  }
}
