import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  REQUIRED_SEASONAL_TABLES,
  checkSeasonalTables,
  findMissingSeasonalTables,
  main,
} from "../scripts/seasonal-db-preflight.mjs";

test("방학특강 배포 검사는 신규 테이블 7개를 요구한다", () => {
  assert.equal(REQUIRED_SEASONAL_TABLES.length, 7);
  assert.deepEqual(findMissingSeasonalTables(REQUIRED_SEASONAL_TABLES), []);
  assert.deepEqual(findMissingSeasonalTables(REQUIRED_SEASONAL_TABLES.slice(0, 6)), ["SpecialProgramAuditLog"]);
});

test("테이블 확인 쿼리는 읽기 전용 트랜잭션에서 실행된다", async () => {
  const queries = [];
  class FakeClient {
    async connect() {}
    async query(sql) {
      queries.push(sql);
      if (String(sql).includes("information_schema.tables")) {
        return { rows: REQUIRED_SEASONAL_TABLES.map((table_name) => ({ table_name })) };
      }
      return { rows: [] };
    }
    async end() {}
  }

  assert.deepEqual(await checkSeasonalTables({ connectionString: "postgres://example", Client: FakeClient }), []);
  assert.equal(queries[0], "BEGIN READ ONLY");
  assert.match(queries[1], /information_schema\.tables/);
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
