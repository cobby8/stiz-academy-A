import { prisma } from "@/lib/prisma";
import {
  buildRegularShuttleRoster,
  weekdayNameFromDate,
  type RegularShuttleDirection,
  type RegularShuttlePlace,
  type RegularShuttleRawRider,
  type RegularShuttleRosterResult,
} from "./shuttleRosterLogic";

/**
 * 정규 수업 셔틀 "라이더 명단" 조회 (Phase 0) — 서버 · 읽기 전용.
 *
 * 목표:
 *   구글시트 텍스트 명단(RegularShuttleStop)이 아니라, **학생 계정에 붙은 정합 명단**을 만든다.
 *   좌표 SSOT = 신청서(EnrollmentApplication)의 지오코딩 좌표 + Student 연결(convertedStudentId).
 *
 * 이번 단계 범위: roster 조회 함수까지. 배차 엔진 연결(Phase 1)·관리자 화면·학부모 노출은 다음 단계.
 * roster shape는 방학특강 ShuttleRosterRider(place{lat,lng,label}+direction)와 유사하게 맞춰
 * 엔진 입력에 그대로 넣을 수 있게 잡아 둔다.
 *
 * ⚠️ 스키마·기존 셔틀(구글시트/방학특강/정규 결석 등) 무변경. 새 정합 소스만 "추가"한다(병행 존재).
 * ⚠️ PgBouncer 트랜잭션 모드 → $queryRawUnsafe 고정(prepared statement 우회).
 * 권한: 내부 roster 조회라 인증하지 않는다. 소비처(화면·API)가 기존 가드를 유지한다(IDOR 무관).
 */

export type GetRegularShuttleRidersOptions = {
  direction: RegularShuttleDirection;
  /** Class.dayOfWeek 문자열("Mon" 등). date보다 우선한다. */
  dayOfWeek?: string;
  /** 'YYYY-MM-DD'. dayOfWeek 미지정 시 이 날짜의 요일로 계산한다. */
  date?: string;
};

// raw SQL 한 행. 컬럼명이 SQL 문자열 안에 있어 정적 타입을 붙일 수 없다.
type RawRow = Record<string, unknown>;

function str(v: unknown): string | null {
  if (v == null) return null;
  const t = String(v).trim();
  return t ? t : null;
}

function num(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** 접두사(pickup/dropoff)에 맞춰 위치 한 벌을 원시 행에서 뽑는다. */
function place(r: RawRow, prefix: "pickup" | "dropoff"): RegularShuttlePlace {
  const p = (suffix: string) => r[`${prefix}${suffix}`];
  return {
    location: str(p("Location")),
    address: str(p("Address")),
    roadAddress: str(p("RoadAddress")),
    latitude: num(p("Latitude")),
    longitude: num(p("Longitude")),
    placeId: str(p("PlaceId")),
  };
}

function toRawRider(r: RawRow): RegularShuttleRawRider {
  return {
    studentId: String(r.studentId),
    studentName: String(r.studentName ?? ""),
    childGrade: str(r.childGrade),
    childPhone: str(r.childPhone),
    parentName: str(r.parentName),
    parentPhone: str(r.parentPhone),
    classId: String(r.classId),
    className: str(r.className),
    dayOfWeek: String(r.dayOfWeek ?? ""),
    classStart: str(r.classStart),
    classEnd: str(r.classEnd),
    applicationId: str(r.applicationId),
    shuttleNeeded: r.shuttleNeeded === true,
    pickupTime: str(r.pickupTime),
    pickup: place(r, "pickup"),
    dropoff: place(r, "dropoff"),
  };
}

/**
 * 특정 요일(또는 날짜) × 방향 기준으로 정규 셔틀 라이더 명단을 반환한다.
 *
 * 판정:
 *   - ACTIVE Enrollment 인 학생 중, 그 요일 수업(Class.dayOfWeek 일치)이 있고
 *   - 셔틀 이용자(신청서 shuttleNeeded=true 이거나 등원 좌표가 있는) 인 사람만.
 *   - 미전환 신청(convertedStudentId=null)은 Student join이 안 돼 자연 제외된다.
 * 좌표 없는 이용자는 buildRegularShuttleRoster 에서 unassigned 로 분리된다(경고).
 */
export async function getRegularShuttleRiders(
  opts: GetRegularShuttleRidersOptions,
): Promise<RegularShuttleRosterResult> {
  const dayOfWeek = opts.dayOfWeek ?? (opts.date ? weekdayNameFromDate(opts.date) : null);
  if (!dayOfWeek) {
    throw new Error("getRegularShuttleRiders: dayOfWeek 또는 date 가 필요합니다.");
  }

  const rows = await prisma.$queryRawUnsafe<RawRow[]>(
    `SELECT
        s.id                              AS "studentId",
        s.name                            AS "studentName",
        s.grade                           AS "childGrade",
        s.phone                           AS "childPhone",
        c.id                              AS "classId",
        c.name                            AS "className",
        c."dayOfWeek"                     AS "dayOfWeek",
        c."startTime"                     AS "classStart",
        c."endTime"                       AS "classEnd",
        app.id                            AS "applicationId",
        app."parentName"                  AS "parentName",
        app."parentPhone"                 AS "parentPhone",
        app."shuttleNeeded"               AS "shuttleNeeded",
        app."shuttleTime"                 AS "pickupTime",
        app."shuttlePickup"               AS "pickupLocation",
        app."shuttlePickupAddress"        AS "pickupAddress",
        app."shuttlePickupRoadAddress"    AS "pickupRoadAddress",
        app."shuttlePickupLatitude"       AS "pickupLatitude",
        app."shuttlePickupLongitude"      AS "pickupLongitude",
        app."shuttlePickupPlaceId"        AS "pickupPlaceId",
        app."shuttleDropoff"              AS "dropoffLocation",
        app."shuttleDropoffAddress"       AS "dropoffAddress",
        app."shuttleDropoffRoadAddress"   AS "dropoffRoadAddress",
        app."shuttleDropoffLatitude"      AS "dropoffLatitude",
        app."shuttleDropoffLongitude"     AS "dropoffLongitude",
        app."shuttleDropoffPlaceId"       AS "dropoffPlaceId"
       FROM "Enrollment" e
       JOIN "Class" c   ON c.id = e."classId"
       JOIN "Student" s ON s.id = e."studentId"
       -- 학생당 셔틀 관련 신청서 1건만(가장 최근). 신청서-학생은 FK가 아니라 convertedStudentId 문자열 매칭.
       LEFT JOIN LATERAL (
         SELECT ea.*
           FROM "EnrollmentApplication" ea
          WHERE ea."convertedStudentId" = s.id
            AND (ea."shuttleNeeded" = true OR ea."shuttlePickupLatitude" IS NOT NULL)
          ORDER BY ea."createdAt" DESC
          LIMIT 1
       ) app ON true
      WHERE e.status = 'ACTIVE'
        AND c."dayOfWeek" = $1
        -- 셔틀 이용자(플래그 또는 좌표)만 남긴다. 좌표만 없는 이용자는 unassigned로 뒤에서 분리.
        AND app.id IS NOT NULL
      ORDER BY c."startTime" ASC, s.name ASC`,
    dayOfWeek,
  );

  const raw = rows.map(toRawRider);
  return buildRegularShuttleRoster(raw, opts.direction, dayOfWeek);
}
