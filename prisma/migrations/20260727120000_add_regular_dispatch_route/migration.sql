-- 정규 배차 "저장된 배차 노선"(RegularDispatchRoute) 테이블 추가.
--
-- 왜 필요한가: 방학특강 SeasonalDispatchRoute와 같은 문제를 정규 셔틀에서도 겪는다.
--   자동 제안(suggestDispatch)은 매번 새로 계산하므로, 원장이 순서·출발시각을 손으로
--   조정해도 새로고침하면 사라진다. 조정 결과를 저장해 다시 열면 그대로 뜨게 한다.
--
-- 방학특강과의 차이(요일판):
--   방학특강은 특정 날짜(serviceDate 'YYYY-MM-DD') 단위로 저장한다. 정규 셔틀은 상시
--   요일 운영이라 날짜가 아니라 '요일(dayOfWeek 'Mon'~'Sun') × 방향' 단위로 저장한다.
--
-- 설계:
--   1) 저장 단위 = dayOfWeek('Mon'|'Tue'|'Wed'|'Thu'|'Fri'|'Sat'|'Sun') × direction('PICKUP'|'DROPOFF').
--      UNIQUE로 요일·방향당 1행만.
--   2) payload(jsonb) = 조정된 vehicles 스냅샷(방학특강과 동일 형식 {vehicles:[...]}).
--   3) classStart/classEnd = 분 단위(자정 기준) 정수. 나중에 명단이 바뀌면 저장본은 스냅샷이다.
--      원장이 "자동 제안"으로 새로 만들어 다시 저장하면 덮어쓴다(ON CONFLICT DO UPDATE, 앱단 처리).
--   4) 원본 테이블에 FK 없음(값 스냅샷이 정본, 나머지 배차 화면과 같은 관례).
--
-- 안전성: CREATE TABLE IF NOT EXISTS + CREATE UNIQUE INDEX IF NOT EXISTS. 몇 번 실행해도 같다.
--         기존 테이블 ALTER 0건, DROP 0건. ADD-only.

CREATE TABLE IF NOT EXISTS "RegularDispatchRoute" (
  "id" TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  "dayOfWeek" TEXT NOT NULL,             -- 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun'
  "direction" TEXT NOT NULL,             -- 'PICKUP' | 'DROPOFF'
  "payload" JSONB NOT NULL,              -- 조정된 vehicles 스냅샷
  "classStart" TEXT,                     -- 수업 시작(seasonal SeasonalDispatchRoute와 동일하게 TEXT)
  "classEnd" TEXT,                       -- 수업 종료(seasonal과 동일 TEXT)
  "savedByUserId" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "RegularDispatchRoute_dayOfWeek_direction_key"
  ON "RegularDispatchRoute" ("dayOfWeek", "direction");
