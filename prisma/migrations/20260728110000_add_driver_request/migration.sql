-- 기사님 → 관리자 변경 요청 테이블
-- type: REMOVE(학생 제외) | LOCATION(주소 변경) | ORDER(순서 고정) | OTHER(기타)
-- 승인 시 type에 따라 서버가 자동으로 명단·노선을 수정한다.

CREATE TABLE IF NOT EXISTS "DriverRequest" (
  "id"               TEXT        NOT NULL DEFAULT (gen_random_uuid())::text,
  "token"            TEXT        NOT NULL,
  "serviceDate"      TEXT        NOT NULL,
  "type"             TEXT        NOT NULL,
  "targetId"         TEXT,
  "targetName"       TEXT,
  "note"             TEXT,
  "payload"          JSONB,
  "status"           TEXT        NOT NULL DEFAULT 'PENDING',
  "resolvedAt"       TIMESTAMPTZ,
  "resolvedByUserId" TEXT,
  "createdAt"        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "DriverRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "DriverRequest_status_createdAt_idx"
  ON "DriverRequest" ("status", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "DriverRequest_token_serviceDate_idx"
  ON "DriverRequest" ("token", "serviceDate");
