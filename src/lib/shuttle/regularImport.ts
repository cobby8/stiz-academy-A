import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";
import { parseRegularShuttleSheet, type RegularShuttleStop } from "./regularSheet";

// 정규 셔틀 운행리스트: 구글 시트 → 앱 DB 이관(replace) + 조회. PgBouncer 때문에 $queryRawUnsafe/$executeRawUnsafe 고정.

// 구글 시트 URL(편집/보기)을 CSV export URL로 바꾼다.
export function toCsvExportUrl(sheetUrl: string): string | null {
  const id = sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)?.[1];
  if (!id) return null;
  const gid = sheetUrl.match(/[#&?]gid=(\d+)/)?.[1] ?? "0";
  return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`;
}

/** 시트를 가져와 파싱한 뒤 RegularShuttleStop 테이블을 통째로 교체한다(원장 전용). */
export async function importRegularShuttleFromSheet(sheetUrl: string): Promise<{ imported: number; title: string | null }> {
  await requireAdmin();
  const csvUrl = toCsvExportUrl(sheetUrl);
  if (!csvUrl) throw new Error("올바른 구글 시트 URL이 아닙니다.");
  const res = await fetch(csvUrl, { cache: "no-store", redirect: "follow" });
  if (!res.ok) throw new Error("시트를 불러오지 못했습니다. '링크 있는 모든 사용자' 공개인지 확인해주세요.");
  const csv = await res.text();
  if (/<html/i.test(csv.slice(0, 200))) throw new Error("시트가 공개되어 있지 않습니다(로그인 페이지 응답).");
  const { title, stops } = parseRegularShuttleSheet(csv);
  if (stops.length === 0) throw new Error("시트에서 유효한 운행 정차를 찾지 못했습니다. 형식을 확인해주세요.");

  // 통째로 교체: 기존 삭제 후 새로 삽입. (좌표는 후속 지오코딩 단계에서 채운다.)
  await prisma.$executeRawUnsafe(`DELETE FROM "RegularShuttleStop"`);
  for (const s of stops) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "RegularShuttleStop"
        ("weekday","classTime","arriveTime","stopName","direction","studentName","studentPhone","parentPhone","note","sortOrder")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      s.weekday, s.classTime, s.arriveTime, s.stopName, s.direction,
      s.studentName, s.studentPhone, s.parentPhone, s.note, s.sortOrder,
    );
  }
  return { imported: stops.length, title };
}

/** 좌표(latitude)가 아직 없는 '고유 정류장 이름' 목록을 돌려준다(빈 이름 제외). 1회용 좌표 채우기 화면용. */
export async function getRegularStopsWithoutCoords(): Promise<string[]> {
  try {
    // latitude 가 null 인 행들의 정류장 이름을 중복 없이(대소문자·공백 유지) 조회.
    const rows = await prisma.$queryRawUnsafe<{ stopName: string }[]>(
      `SELECT DISTINCT "stopName"
         FROM "RegularShuttleStop"
        WHERE "latitude" IS NULL AND COALESCE(TRIM("stopName"), '') <> ''
        ORDER BY "stopName" ASC`,
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
): Promise<{ updated: number }> {
  await requireAdmin();
  let updated = 0;
  for (const u of updates) {
    const id = (u.id ?? "").trim();
    if (!id || !Number.isFinite(u.sortOrder)) continue;
    const arrive = typeof u.arriveTime === "string" && /^\d{1,2}:\d{2}$/.test(u.arriveTime.trim()) ? u.arriveTime.trim() : null;
    const n = await prisma.$executeRawUnsafe(
      `UPDATE "RegularShuttleStop" SET "sortOrder"=$1,"arriveTime"=$2 WHERE "id"=$3`,
      Math.round(u.sortOrder), arrive, id,
    );
    updated += Number(n) || 0;
  }
  return { updated };
}

/** 저장된 정규 셔틀 정차를 요일 순·시간 순으로 돌려준다. */
export async function getRegularShuttleStops(): Promise<{ stops: RegularShuttleStop[]; importedAt: string | null }> {
  try {
    const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT "id","weekday","classTime","arriveTime","stopName","direction","studentName","studentPhone","parentPhone","note","sortOrder","latitude","longitude","importedAt"
         FROM "RegularShuttleStop" ORDER BY "weekday" ASC, "sortOrder" ASC`,
    );
    const WD = ["일", "월", "화", "수", "목", "금", "토"];
    const stops: RegularShuttleStop[] = rows.map((r) => ({
      id: r.id != null ? String(r.id) : undefined,
      weekday: Number(r.weekday),
      weekdayLabel: WD[Number(r.weekday)] ?? "",
      classTime: (r.classTime as string | null) ?? null,
      arriveTime: (r.arriveTime as string | null) ?? null,
      stopName: String(r.stopName ?? ""),
      direction: (["BOARD", "ALIGHT", "PIVOT", "RETURN"].includes(String(r.direction)) ? r.direction : "BOARD") as RegularShuttleStop["direction"],
      studentName: (r.studentName as string | null) ?? null,
      studentPhone: (r.studentPhone as string | null) ?? null,
      parentPhone: (r.parentPhone as string | null) ?? null,
      note: (r.note as string | null) ?? null,
      sortOrder: Number(r.sortOrder) || 0,
      latitude: r.latitude != null ? Number(r.latitude) : null,
      longitude: r.longitude != null ? Number(r.longitude) : null,
    }));
    const importedAt = rows[0]?.importedAt ? new Date(String(rows[0].importedAt)).toISOString() : null;
    return { stops, importedAt };
  } catch {
    return { stops: [], importedAt: null };
  }
}
