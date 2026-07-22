import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  REQUIRED_SEASONAL_TABLES,
  analyzeSeasonalTableSecurity,
  checkSeasonalTables,
  findMissingSeasonalTables,
  main,
} from "../scripts/seasonal-db-preflight.mjs";

test("방학특강 배포 검사는 신규 테이블 7개를 요구한다", () => {
  assert.equal(REQUIRED_SEASONAL_TABLES.length, 7);
  assert.deepEqual(findMissingSeasonalTables(REQUIRED_SEASONAL_TABLES), []);
  assert.deepEqual(findMissingSeasonalTables(REQUIRED_SEASONAL_TABLES.slice(0, 6)), ["SpecialProgramAuditLog"]);
});

test("RLS 비활성화와 Data API 직접 접근을 별도로 탐지한다", () => {
  const rows = REQUIRED_SEASONAL_TABLES.map((table_name) => ({
    table_name,
    rls_enabled: true,
    anon_has_access: false,
    authenticated_has_access: false,
  }));
  rows[1].rls_enabled = false;
  rows[3].authenticated_has_access = true;
  assert.deepEqual(analyzeSeasonalTableSecurity(rows), {
    missing: [],
    rlsDisabled: [REQUIRED_SEASONAL_TABLES[1]],
    directlyAccessible: [REQUIRED_SEASONAL_TABLES[3]],
  });
});

test("테이블 확인 쿼리는 읽기 전용 트랜잭션에서 실행된다", async () => {
  const queries = [];
  class FakeClient {
    async connect() {}
    async query(sql) {
      queries.push(sql);
      if (String(sql).includes("pg_class")) {
        return { rows: REQUIRED_SEASONAL_TABLES.map((table_name) => ({ table_name, rls_enabled: true, anon_has_access: false, authenticated_has_access: false })) };
      }
      return { rows: [] };
    }
    async end() {}
  }

  assert.deepEqual(await checkSeasonalTables({ connectionString: "postgres://example", Client: FakeClient }), { missing: [], rlsDisabled: [], directlyAccessible: [] });
  assert.equal(queries[0], "BEGIN READ ONLY");
  assert.match(queries[1], /pg_class/);
  assert.equal(queries[2], "ROLLBACK");
});

test("DB 미연결은 실패하고 명시적 skip만 통과한다", async () => {
  assert.equal(await main([], {}), 1);
  assert.equal(await main(["--skip-db"], {}), 0);
});

test("통합 release preflight는 운영 검사에서 seasonal DB 검사를 선행한다", () => {
  const source = readFileSync(new URL("../scripts/release-preflight.mjs", import.meta.url), "utf8");
  assert.match(source, /seasonal-db-preflight\.mjs/);
  assert.match(source, /if \(!skipEnv\)/);
});

test("신규 migration은 7개 테이블 모두 RLS와 직접 권한 차단을 적용한다", () => {
  const migration = readFileSync(new URL("../prisma/migrations/20260720190000_add_special_programs/migration.sql", import.meta.url), "utf8");
  for (const table of REQUIRED_SEASONAL_TABLES) {
    assert.match(migration, new RegExp(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY;`));
    assert.match(migration, new RegExp(`REVOKE ALL ON TABLE "${table}" FROM anon, authenticated;`));
  }
});

test("특강 출석 연결 migration은 사용하는 Session 컬럼을 먼저 보장한다", () => {
  const migration = readFileSync(new URL("../prisma/migrations/20260722130000_link_special_program_sessions/migration.sql", import.meta.url), "utf8");
  assert.match(migration, /ADD COLUMN IF NOT EXISTS "sessionKey" TEXT/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'PLANNED'/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS "coachId" TEXT/);
  assert.ok(migration.indexOf("ADD COLUMN IF NOT EXISTS \"sessionKey\"") < migration.indexOf("INSERT INTO \"Session\""));
});

test("공개 특강 정원 필수 제약을 후속 migration으로 복구한다", () => {
  const migration = readFileSync(new URL("../prisma/migrations/20260722190000_require_open_special_program_capacity/migration.sql", import.meta.url), "utf8");
  assert.match(migration, /CHECK \(status <> 'OPEN' OR capacity IS NOT NULL\) NOT VALID/);
  assert.doesNotMatch(migration, /VALIDATE CONSTRAINT/);
});
