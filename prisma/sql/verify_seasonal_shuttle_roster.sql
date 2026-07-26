-- add_seasonal_shuttle_roster.sql 적용 확인용 (SELECT만. 아무것도 바꾸지 않는다)
--
-- 사용법: 이 파일의 쿼리를 순서대로 실행하고 기대값과 비교한다.
-- 0~2단계 직후 기대값은 "확정본 0행 + 기존 화면 수치 그대로"다.

-- 1) 테이블·컬럼이 다 생겼는가  → 기대: 46
SELECT count(*) AS roster_columns
  FROM information_schema.columns
 WHERE table_schema = 'public' AND table_name = 'SeasonalShuttleRoster';

-- 2) 인덱스가 있는가  → 기대: 4행 (PK 1 + unique 1 + index 2)
SELECT indexname
  FROM pg_indexes
 WHERE schemaname = 'public' AND tablename = 'SeasonalShuttleRoster'
   AND indexname LIKE 'SeasonalShuttleRoster_%'
 ORDER BY indexname;

-- 3) 킬 스위치 컬럼  → 기대: 1행 (boolean, is_nullable = YES, 값 NULL = 꺼짐)
SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
 WHERE table_schema = 'public' AND table_name = 'AcademySettings'
   AND column_name = 'shuttleRosterConfirmedMode';

-- 4) ⚠️ 원본에 FK가 걸리지 않았는가 (걸려 있으면 설계 위반)  → 기대: 0
SELECT count(*) AS foreign_keys
  FROM information_schema.table_constraints
 WHERE table_schema = 'public' AND table_name = 'SeasonalShuttleRoster'
   AND constraint_type = 'FOREIGN KEY';

-- 5) 확정본 행 수  → 기대: 0 (자동 백필 금지. 원장이 확정 버튼을 눌러야 생긴다)
SELECT count(*) AS total,
       count(*) FILTER (WHERE "removedAt" IS NULL) AS alive,
       count(*) FILTER (WHERE "removedAt" IS NULL AND "ride") AS riding
  FROM "SeasonalShuttleRoster";

-- 6) 기존 화면 기준선 — 확정본이 비어 있는 동안 이 값들이 그대로여야 한다.
--    기대: roster_total 18 / roster_ride 16 / roster_noride 2 / unassigned 16
SELECT
  count(*) AS roster_total,
  count(*) FILTER (WHERE r.status NOT IN ('CANCELLED','REJECTED')) AS roster_ride,
  count(*) FILTER (WHERE r.status IN ('CANCELLED','REJECTED')) AS roster_noride
  FROM "SpecialProgramShuttleRequest" r
  JOIN "SpecialProgramApplication" a ON a.id = r."applicationId"
  JOIN "SpecialProgramSeason" s ON s.id = a."seasonId"
  LEFT JOIN "SpecialProgramApplicationItem" it ON it.id = r."applicationItemId"
  LEFT JOIN "SpecialProgramOffering" o ON o.id = it."offeringId"
 WHERE s.status <> 'ARCHIVED'
   AND a.status NOT IN ('CANCELLED','REJECTED')
   AND (it.id IS NULL OR it.status NOT IN ('CANCELLED','REJECTED'))
   AND (o.id IS NULL OR o.status <> 'CANCELLED');

-- 7) 날짜별 운행 인원 기준선  → 기대: 월 9 / 화 11 / 수 9 / 목 11 / 금 4 (총 15일)
SELECT (sd."startsAt" AT TIME ZONE 'Asia/Seoul')::date AS service_date,
       count(DISTINCT r.id) AS riders
  FROM "SpecialProgramEnrollmentDate" e
  JOIN "SpecialProgramSessionDate" sd ON sd.id = e."sessionDateId"
  JOIN "SpecialProgramShuttleRequest" r ON r."applicationItemId" = e."applicationItemId"
  JOIN "SpecialProgramApplication" a ON a.id = r."applicationId"
  JOIN "SpecialProgramApplicationItem" it ON it.id = e."applicationItemId"
  JOIN "SpecialProgramOffering" o ON o.id = it."offeringId"
 WHERE e.status = 'SCHEDULED'
   AND r.status NOT IN ('CANCELLED','REJECTED')
   AND a.status NOT IN ('CANCELLED','REJECTED')
   AND it.status NOT IN ('CANCELLED','REJECTED')
   AND o.status <> 'CANCELLED'
 GROUP BY 1
 ORDER BY 1;

-- 8) 확정본이 원본과 어긋나지 않는지(3단계 이후 상시 점검용)
--    → 확정본이 있는데 원본 셔틀신청이 사라진 행. 기대: 0 (있어도 확정본은 살아 있어야 정상)
SELECT count(*) AS orphaned_rosters
  FROM "SeasonalShuttleRoster" sr
 WHERE sr."removedAt" IS NULL
   AND NOT EXISTS (
     SELECT 1 FROM "SpecialProgramShuttleRequest" r WHERE r.id = sr."shuttleRequestId"
   );
