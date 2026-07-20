import { pathToFileURL } from "node:url";
import pg from "pg";

export const REQUIRED_SEASONAL_TABLES = [
  "SpecialProgramSeason",
  "SpecialProgramOffering",
  "SpecialProgramSessionDate",
  "SpecialProgramApplication",
  "SpecialProgramApplicationItem",
  "SpecialProgramShuttleRequest",
  "SpecialProgramAuditLog",
];

export function findMissingSeasonalTables(existingTableNames) {
  const existing = new Set(existingTableNames);
  return REQUIRED_SEASONAL_TABLES.filter((table) => !existing.has(table));
}

export function analyzeSeasonalTableSecurity(rows) {
  const byName = new Map(rows.map((row) => [row.table_name, row]));
  return {
    missing: REQUIRED_SEASONAL_TABLES.filter((table) => !byName.has(table)),
    rlsDisabled: REQUIRED_SEASONAL_TABLES.filter((table) => byName.has(table) && !byName.get(table).rls_enabled),
    directlyAccessible: REQUIRED_SEASONAL_TABLES.filter((table) => {
      const row = byName.get(table);
      return row && (row.anon_has_access || row.authenticated_has_access);
    }),
  };
}

export async function checkSeasonalTables({ connectionString, Client = pg.Client }) {
  if (!connectionString?.trim()) {
    throw new Error("DIRECT_URL 또는 DATABASE_URL이 없습니다.");
  }

  const client = new Client({
    connectionString,
    application_name: "stiz-seasonal-release-preflight",
    connectionTimeoutMillis: 8_000,
    statement_timeout: 8_000,
  });

  try {
    await client.connect();
    // information_schema 조회만 허용하는 읽기 전용 트랜잭션이다.
    await client.query("BEGIN READ ONLY");
    const result = await client.query(
      `SELECT c.relname AS table_name,
              c.relrowsecurity AS rls_enabled,
              EXISTS (
                SELECT 1 FROM pg_roles r
                 WHERE r.rolname = 'anon'
                   AND has_table_privilege(r.oid, c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
              ) AS anon_has_access,
              EXISTS (
                SELECT 1 FROM pg_roles r
                 WHERE r.rolname = 'authenticated'
                   AND has_table_privilege(r.oid, c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
              ) AS authenticated_has_access
         FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = current_schema()
          AND c.relkind IN ('r', 'p')
          AND c.relname = ANY($1::text[])`,
      [REQUIRED_SEASONAL_TABLES],
    );
    await client.query("ROLLBACK");
    return analyzeSeasonalTableSecurity(result.rows);
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch {}
    throw error;
  } finally {
    await client.end().catch(() => {});
  }
}

export async function main(args = process.argv.slice(2), env = process.env) {
  if (args.includes("--skip-db")) {
    console.warn("[건너뜀] 방학특강 DB 준비 검사를 명시적으로 생략했습니다. 코드 검사일 뿐 배포 승인이 아닙니다.");
    return 0;
  }

  const connectionString = env.DIRECT_URL || env.DATABASE_URL;
  if (!connectionString?.trim()) {
    console.error("[실패] 방학특강 DB 준비 검사를 실행할 연결 정보가 없습니다.");
    console.error("DIRECT_URL 또는 DATABASE_URL을 설정하세요. DB 없는 코드 검사만 원하면 --skip-db를 명시하세요.");
    return 1;
  }

  try {
    const security = await checkSeasonalTables({ connectionString });
    if (security.missing.length > 0) {
      console.error(`[실패] 방학특강 필수 테이블 ${security.missing.length}개가 준비되지 않았습니다.`);
      security.missing.forEach((table) => console.error(`- ${table}`));
      console.error("배포 전에 prisma/migrations/20260720190000_add_special_programs/migration.sql 마이그레이션을 먼저 적용하세요.");
      console.error("이 검사는 읽기 전용이며 마이그레이션을 자동 실행하지 않습니다.");
      return 1;
    }
    if (security.rlsDisabled.length > 0) {
      console.error(`[실패] RLS가 활성화되지 않은 방학특강 테이블 ${security.rlsDisabled.length}개가 있습니다.`);
      security.rlsDisabled.forEach((table) => console.error(`- ${table}`));
      console.error("운영 배포 전에 신규 migration의 ENABLE ROW LEVEL SECURITY 구문을 적용하세요.");
      return 1;
    }
    if (security.directlyAccessible.length > 0) {
      console.error(`[실패] anon/authenticated 역할이 직접 접근할 수 있는 방학특강 테이블 ${security.directlyAccessible.length}개가 있습니다.`);
      security.directlyAccessible.forEach((table) => console.error(`- ${table}`));
      console.error("운영 배포 전에 신규 migration의 REVOKE 구문을 적용하세요.");
      return 1;
    }
    console.log(`[통과] 방학특강 필수 테이블 ${REQUIRED_SEASONAL_TABLES.length}개의 존재, RLS, 직접 접근 차단을 확인했습니다.`);
    return 0;
  } catch (error) {
    console.error(`[실패] 방학특강 DB 연결 또는 조회에 실패했습니다: ${error instanceof Error ? error.message : String(error)}`);
    console.error("DB 연결과 권한을 확인하세요. 배포 전에 마이그레이션 적용 여부를 별도로 확인해야 합니다.");
    return 1;
  }
}

const isDirectRun = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isDirectRun) process.exitCode = await main();
