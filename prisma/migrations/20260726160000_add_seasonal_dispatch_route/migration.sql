-- 방학특강 셔틀 "저장된 배차 노선"(SeasonalDispatchRoute) 테이블 추가.
--
-- 왜 필요한가: 자동 제안(suggestDispatch)은 매번 새로 계산한다. 원장이 순서·출발시각을
--   손으로 조정해도 새로고침하면 사라졌다. 조정 결과를 (날짜 × 방향) 단위로 저장해,
--   다시 열면 그 노선이 그대로 뜨게 한다.
--
-- 설계:
--   1) 저장 단위 = serviceDate('YYYY-MM-DD') × direction('PICKUP'|'DROPOFF'). UNIQUE로 1행만.
--   2) payload(jsonb) = 조정된 vehicles 스냅샷(정차 순서·시각·경로 포함).
--   3) 명단이 나중에 바뀌면 저장본은 그 시점 스냅샷이다. 원장이 "자동 제안"으로 새로 만들어
--      다시 저장하면 덮어쓴다(ON CONFLICT DO UPDATE).
--   4) 원본 테이블에 FK 없음(값 스냅샷이 정본, 나머지 화면과 같은 관례).
--
-- 안전성: CREATE TABLE IF NOT EXISTS + CREATE UNIQUE INDEX IF NOT EXISTS. 몇 번 실행해도 같다.
--         기존 테이블 ALTER 0건, DROP 0건.

CREATE TABLE IF NOT EXISTS "SeasonalDispatchRoute" (
  "id" TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  "serviceDate" TEXT NOT NULL,          -- 'YYYY-MM-DD'
  "direction" TEXT NOT NULL,            -- 'PICKUP' | 'DROPOFF'
  "payload" JSONB NOT NULL,             -- 조정된 vehicles 스냅샷
  "classStart" TEXT,
  "classEnd" TEXT,
  "savedByUserId" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "SeasonalDispatchRoute_date_direction_key"
  ON "SeasonalDispatchRoute" ("serviceDate", "direction");
