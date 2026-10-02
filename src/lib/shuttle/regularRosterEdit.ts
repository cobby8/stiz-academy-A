import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";
import {
  buildAddRows,
  buildMoveUpdates,
  RosterInputError,
  validateAddInput,
  validateCopyInput,
  validateMoveInput,
  validateRemoveInput,
  validateStopEditInput,
  type RosterExistingRow,
} from "./regularRosterEditLogic";

// 셔틀 명단(RegularShuttleStop) 앱 편집 — 원장 전용. 시트 대신 사이트가 명단 원장이다.
// PgBouncer 트랜잭션 모드라 $queryRawUnsafe/$executeRawUnsafe 만 쓴다(ORM 기본 메서드 금지).
// 정규 배차·기사님 화면은 이 표를 그대로 읽으므로(reconcile) 여기서는 명단 행만 고친다.

type Tx = Prisma.TransactionClient;

export { RosterInputError };

/** 같은 달 명단을 동시에 고치면 정렬순서·중복 판정이 엇갈리므로 달 단위로 줄 세운다. */
async function lockMonth(tx: Tx, month: string) {
  await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, `regular-roster:${month}`);
}

async function monthRows(tx: Tx, month: string): Promise<RosterExistingRow[]> {
  const rows = await tx.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT "id","weekday","direction","classTime","sortOrder","studentId","studentName","parentPhone"
       FROM "RegularShuttleStop" WHERE "serviceMonth"=$1`,
    month,
  );
  return rows.map((r) => ({
    id: String(r.id),
    weekday: Number(r.weekday),
    direction: String(r.direction),
    classTime: (r.classTime as string | null) ?? null,
    sortOrder: Number(r.sortOrder) || 0,
    studentId: (r.studentId as string | null) ?? null,
    studentName: (r.studentName as string | null) ?? null,
    parentPhone: (r.parentPhone as string | null) ?? null, // 반이동 같은 학생 확인용
  }));
}

/** 변경 기록. ShuttleAuditLog 의 노선·차량 연결 칸은 비워 두고 action 으로 구분한다. */
async function audit(tx: Tx, actorId: string, action: string, before: unknown, after: unknown) {
  await tx.$executeRawUnsafe(
    `INSERT INTO "ShuttleAuditLog" ("actorId","action","beforeJSON","afterJSON") VALUES ($1,$2,$3::jsonb,$4::jsonb)`,
    actorId, action, before == null ? null : JSON.stringify(before), after == null ? null : JSON.stringify(after),
  );
}

const ROW_COLUMNS = `"id","serviceMonth","weekday","classTime","arriveTime","stopName","direction","studentName","studentId","studentPhone","parentPhone","note","sortOrder","latitude","longitude"`;

// ── 학생 검색(추가 폼) ───────────────────────────────────────

export type RosterStudentPlace = { name: string | null; address: string; latitude: number; longitude: number };
export type RosterStudentSearchResult = {
  id: string;
  name: string;
  grade: string | null;
  parentPhone: string | null;
  pickup: RosterStudentPlace | null;
  dropoff: RosterStudentPlace | null;
};

/** 이름으로 학생 검색(병합된 학생 제외, 최대 20명). 학생 상세에 저장된 등·하원 좌표가 있으면 함께 준다. */
export async function searchRosterStudents(query: string): Promise<RosterStudentSearchResult[]> {
  await requireAdmin();
  const q = String(query ?? "").trim();
  if (!q) return [];
  if (q.length > 40) throw new RosterInputError("검색어가 너무 깁니다.");
  const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT s."id", s."name", s."grade", u."phone" AS "parentPhone",
            pk."name" AS "pkName", pk."address" AS "pkAddress", pk."latitude" AS "pkLat", pk."longitude" AS "pkLng",
            dr."name" AS "drName", dr."address" AS "drAddress", dr."latitude" AS "drLat", dr."longitude" AS "drLng"
       FROM "Student" s
       LEFT JOIN "User" u ON u."id"=s."parentId"
       LEFT JOIN "StudentShuttleLocation" pk ON pk."studentId"=s."id" AND pk."kind"='PICKUP'
       LEFT JOIN "StudentShuttleLocation" dr ON dr."studentId"=s."id" AND dr."kind"='DROPOFF'
      WHERE s."mergedIntoStudentId" IS NULL AND s."name" ILIKE $1
      ORDER BY s."name" ASC, s."createdAt" ASC
      LIMIT 20`,
    like,
  );
  const place = (name: unknown, address: unknown, lat: unknown, lng: unknown): RosterStudentPlace | null =>
    lat != null && lng != null ? { name: (name as string | null) ?? null, address: String(address ?? ""), latitude: Number(lat), longitude: Number(lng) } : null;
  return rows.map((r) => ({
    id: String(r.id),
    name: String(r.name ?? ""),
    grade: (r.grade as string | null) ?? null,
    parentPhone: (r.parentPhone as string | null) ?? null,
    pickup: place(r.pkName, r.pkAddress, r.pkLat, r.pkLng),
    dropoff: place(r.drName, r.drAddress, r.drLat, r.drLng),
  }));
}

// ── 학생 추가 ───────────────────────────────────────────────

export async function addRosterStudent(raw: unknown): Promise<{ added: number }> {
  const admin = await requireAdmin();
  const input = validateAddInput(raw);

  // 학생을 골랐으면 이름·전화를 학생/학부모 정보에서 채운다. 이름만 입력했으면 전화 없이 둔다.
  let studentName = input.studentName;
  let studentPhone: string | null = null;
  let parentPhone: string | null = null;
  if (input.studentId) {
    const found = await prisma.$queryRawUnsafe<{ name: string; phone: string | null; parentPhone: string | null; guardianPhone: string | null }[]>(
      `SELECT s."name", s."phone", u."phone" AS "parentPhone",
              (SELECT g."phone" FROM "Guardian" g WHERE g."studentId"=s."id" AND g."phone" IS NOT NULL ORDER BY g."isPrimary" DESC, g."createdAt" ASC LIMIT 1) AS "guardianPhone"
         FROM "Student" s LEFT JOIN "User" u ON u."id"=s."parentId"
        WHERE s."id"=$1 AND s."mergedIntoStudentId" IS NULL LIMIT 1`,
      input.studentId,
    );
    if (!found[0]) throw new RosterInputError("학생을 찾지 못했습니다. 다시 검색해 주세요.");
    studentName = found[0].name;
    studentPhone = found[0].phone ?? null;
    parentPhone = found[0].parentPhone ?? found[0].guardianPhone ?? null;
  }

  return prisma.$transaction(async (tx) => {
    await lockMonth(tx, input.serviceMonth);
    const rows = buildAddRows(input, await monthRows(tx, input.serviceMonth), studentName);
    for (const r of rows) {
      await tx.$executeRawUnsafe(
        `INSERT INTO "RegularShuttleStop"
          ("serviceMonth","weekday","classTime","arriveTime","stopName","direction","studentName","studentId","studentPhone","parentPhone","note","sortOrder","latitude","longitude")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NULL,$11,$12,$13)`,
        input.serviceMonth, r.weekday, r.classTime, r.arriveTime, r.stopName, r.direction,
        studentName, input.studentId, studentPhone, parentPhone, r.sortOrder, r.latitude, r.longitude,
      );
    }
    await audit(tx, admin.appUserId, "REGULAR_ROSTER_ADD", null, { serviceMonth: input.serviceMonth, studentId: input.studentId, studentName, rows });
    return { added: rows.length };
  });
}

// ── 빼기(퇴원·셔틀 중단) ─────────────────────────────────────

export async function removeRosterRows(raw: unknown): Promise<{ removed: number }> {
  const admin = await requireAdmin();
  const input = validateRemoveInput(raw);
  return prisma.$transaction(async (tx) => {
    await lockMonth(tx, input.serviceMonth);
    // 학생 등·하원 행만 지운다(학원 경유·복귀 같은 운영 정차는 이 화면에서 지우지 않는다).
    const deleted = await tx.$queryRawUnsafe<Record<string, unknown>[]>(
      `DELETE FROM "RegularShuttleStop"
        WHERE "id" = ANY($1::text[]) AND "serviceMonth"=$2 AND "direction" IN ('BOARD','ALIGHT')
        RETURNING ${ROW_COLUMNS}`,
      input.ids, input.serviceMonth,
    );
    // 일부만 지워지면(다른 달·이미 삭제) 전체를 되돌린다 — 화면과 DB 가 어긋난 상태라서.
    if (deleted.length !== input.ids.length) throw new RosterInputError("일부 행을 이 달 명단에서 찾지 못했습니다. 화면을 새로고침해 주세요.");
    await audit(tx, admin.appUserId, "REGULAR_ROSTER_REMOVE", { serviceMonth: input.serviceMonth, rows: deleted }, null);
    return { removed: deleted.length };
  });
}

// ── 반이동 ─────────────────────────────────────────────────

export async function moveRosterRows(raw: unknown): Promise<{ moved: number }> {
  const admin = await requireAdmin();
  const input = validateMoveInput(raw);
  return prisma.$transaction(async (tx) => {
    await lockMonth(tx, input.serviceMonth);
    const existing = await monthRows(tx, input.serviceMonth);
    const updates = buildMoveUpdates(input.ids, input.weekday, input.classTime, existing);
    const before = existing.filter((r) => input.ids.includes(r.id));
    for (const u of updates) {
      await tx.$executeRawUnsafe(
        `UPDATE "RegularShuttleStop" SET "weekday"=$1,"classTime"=$2,"sortOrder"=$3 WHERE "id"=$4 AND "serviceMonth"=$5`,
        u.weekday, u.classTime, u.sortOrder, u.id, input.serviceMonth,
      );
    }
    await audit(tx, admin.appUserId, "REGULAR_ROSTER_MOVE", { serviceMonth: input.serviceMonth, rows: before }, { serviceMonth: input.serviceMonth, rows: updates });
    return { moved: updates.length };
  });
}

// ── 정류장 수정(한 행 / 같은 이름 전체) ──────────────────────────

export async function editRosterStop(raw: unknown): Promise<{ updated: number }> {
  const admin = await requireAdmin();
  const input = validateStopEditInput(raw);
  const { stop } = input;
  return prisma.$transaction(async (tx) => {
    await lockMonth(tx, input.serviceMonth);
    const current = await tx.$queryRawUnsafe<{ stopName: string; arriveTime: string | null; latitude: number | null; longitude: number | null }[]>(
      `SELECT "stopName","arriveTime","latitude","longitude" FROM "RegularShuttleStop" WHERE "id"=$1 AND "serviceMonth"=$2`,
      input.id, input.serviceMonth,
    );
    if (!current[0]) throw new RosterInputError("이 달 명단에서 해당 정류장을 찾지 못했습니다. 화면을 새로고침해 주세요.");
    // 도착시각은 학생·요일마다 다르므로 언제나 이 행에만 적용한다.
    // 좌표가 비어 오면(null) 기존 좌표를 유지한다 — 화면에 좌표를 지우는 기능이 없어 null 은 "변경 없음"으로 본다.
    await tx.$executeRawUnsafe(
      `UPDATE "RegularShuttleStop" SET "stopName"=$1,"arriveTime"=$2,"latitude"=COALESCE($3::double precision,"latitude"),"longitude"=COALESCE($4::double precision,"longitude") WHERE "id"=$5 AND "serviceMonth"=$6`,
      stop.stopName, stop.arriveTime, stop.latitude, stop.longitude, input.id, input.serviceMonth,
    );
    let updated = 1;
    if (input.applyToAll) {
      // 같은 달·같은 정류장 이름을 쓰는 다른 행도 이름·좌표를 함께 바꾼다(도착시각은 그대로).
      // 새 좌표가 null 이면 각 행의 기존 좌표를 유지한다(좌표 없는 행을 고칠 때 다른 행 좌표까지 지우던 문제 방지).
      updated += Number(await tx.$executeRawUnsafe(
        `UPDATE "RegularShuttleStop" SET "stopName"=$1,"latitude"=COALESCE($2::double precision,"latitude"),"longitude"=COALESCE($3::double precision,"longitude")
          WHERE "serviceMonth"=$4 AND "stopName"=$5 AND "id"<>$6`,
        stop.stopName, stop.latitude, stop.longitude, input.serviceMonth, current[0].stopName, input.id,
      )) || 0;
    }
    await audit(tx, admin.appUserId, input.applyToAll ? "REGULAR_ROSTER_STOP_RENAME_ALL" : "REGULAR_ROSTER_STOP_EDIT",
      { serviceMonth: input.serviceMonth, id: input.id, ...current[0] },
      { serviceMonth: input.serviceMonth, id: input.id, ...stop, applyToAll: input.applyToAll, updated });
    return { updated };
  });
}

// ── 다음 달 명단 만들기(월 복사) ───────────────────────────────

export async function copyRosterMonth(raw: unknown): Promise<{ copied: number; targetMonth: string }> {
  const admin = await requireAdmin();
  const input = validateCopyInput(raw);
  return prisma.$transaction(async (tx) => {
    await lockMonth(tx, input.targetMonth);
    const exists = await tx.$queryRawUnsafe<{ n: number }[]>(
      `SELECT COUNT(*)::int AS n FROM "RegularShuttleStop" WHERE "serviceMonth"=$1`, input.targetMonth,
    );
    // 대상 달에 이미 명단이 있으면 덮어쓰지 않는다(그 달에서 고친 내용이 사라지지 않게).
    if (Number(exists[0]?.n) > 0) throw new RosterInputError(`${input.targetMonth} 명단이 이미 있습니다. 그 달에서 직접 고쳐 주세요.`);
    const copied = Number(await tx.$executeRawUnsafe(
      `INSERT INTO "RegularShuttleStop"
        ("serviceMonth","weekday","classTime","arriveTime","stopName","direction","studentName","studentId","studentPhone","parentPhone","note","sortOrder","latitude","longitude")
       SELECT $1,"weekday","classTime","arriveTime","stopName","direction","studentName","studentId","studentPhone","parentPhone","note","sortOrder","latitude","longitude"
         FROM "RegularShuttleStop" WHERE "serviceMonth"=$2`,
      input.targetMonth, input.sourceMonth,
    )) || 0;
    if (copied === 0) throw new RosterInputError(`${input.sourceMonth} 명단이 비어 있어 복사할 내용이 없습니다.`);
    await audit(tx, admin.appUserId, "REGULAR_ROSTER_COPY_MONTH", { sourceMonth: input.sourceMonth }, { targetMonth: input.targetMonth, copied });
    return { copied, targetMonth: input.targetMonth };
  });
}
