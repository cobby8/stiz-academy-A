-- 정규 수업 셔틀 운행리스트(구글 시트) → 앱 DB 이관용 테이블.
-- 정규 셔틀은 요일마다 '도착시간 순 하루 타임라인'이고, 각 행이 정차 하나(승차/하차/학원경유/복귀)다.
-- 시트에서 가져오기(replace)로 통째로 갱신한다. 편집·좌표·자동경로는 후속 단계.
-- 안전성: CREATE TABLE/INDEX IF NOT EXISTS. 추가만.

CREATE TABLE IF NOT EXISTS "RegularShuttleStop" (
  "id" TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  "weekday" INT NOT NULL,               -- 0=일 … 6=토 (월=1)
  "classTime" TEXT,                     -- '17:00~18:00'
  "arriveTime" TEXT,                    -- 'HH:MM' 정차 시각
  "stopName" TEXT NOT NULL,             -- 목적지(정차 위치 이름)
  "direction" TEXT NOT NULL,            -- 'BOARD'|'ALIGHT'|'PIVOT'|'RETURN'
  "studentName" TEXT,
  "studentPhone" TEXT,
  "parentPhone" TEXT,
  "note" TEXT,
  "sortOrder" INT NOT NULL DEFAULT 0,   -- 요일 안 시간순 정렬
  "latitude" DOUBLE PRECISION,          -- 후속 지오코딩으로 채움
  "longitude" DOUBLE PRECISION,
  "importedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "RegularShuttleStop_weekday_sort" ON "RegularShuttleStop" ("weekday", "sortOrder");
