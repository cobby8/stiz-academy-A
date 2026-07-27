-- 기사님 실시간 GPS 위치 테이블
-- token당 1행 upsert — 현재 위치만 유지하고 히스토리는 보관하지 않는다.
-- ShuttleRunLink.token 삭제 시 함께 삭제(CASCADE).

CREATE TABLE IF NOT EXISTS "DriverLocation" (
  "token"      TEXT                     NOT NULL,
  "label"      TEXT,
  "latitude"   DOUBLE PRECISION         NOT NULL,
  "longitude"  DOUBLE PRECISION         NOT NULL,
  "accuracy"   DOUBLE PRECISION,
  "speed"      DOUBLE PRECISION,
  "heading"    DOUBLE PRECISION,
  "sharing"    BOOLEAN                  NOT NULL DEFAULT TRUE,
  "updatedAt"  TIMESTAMPTZ              NOT NULL,
  CONSTRAINT "DriverLocation_pkey" PRIMARY KEY ("token"),
  CONSTRAINT "DriverLocation_token_fkey"
    FOREIGN KEY ("token") REFERENCES "ShuttleRunLink"("token")
    ON DELETE CASCADE ON UPDATE CASCADE
);
