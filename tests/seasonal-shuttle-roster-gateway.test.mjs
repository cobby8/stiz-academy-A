import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// 셔틀 확정 명단 게이트웨이(src/lib/seasonal/shuttleRoster.ts)의 회귀 테스트.
//
// 이 게이트웨이가 존재하는 이유는 하나다: "셔틀 태울 학생"을 읽는 출구를 하나로 만들어,
// 새 화면이 원본 4테이블을 다시 조인하다가 필터를 빠뜨리는 사고를 구조적으로 막는 것.
// (2026-07-26 기준 같은 사고 6회 반복)
//
// 그래서 여기서 지키는 것은 두 가지다.
//   ① 확정본이 **없을 때**(오늘 상태) — 폴백이 전환 이전과 똑같이 동작하는가
//   ② 확정본이 **있을 때** — 원본을 다시 섞지 않고 확정본만 보는가

const gateway = readFileSync(new URL("../src/lib/seasonal/shuttleRoster.ts", import.meta.url), "utf8");
const ddl = readFileSync(new URL("../prisma/sql/add_seasonal_shuttle_roster.sql", import.meta.url), "utf8");
const schema = readFileSync(new URL("../prisma/schema.prisma", import.meta.url), "utf8");

// ── 노출 범위 ────────────────────────────────────────────────

test("밖으로 내보내는 조회 함수는 딱 2개다", () => {
    const readers = gateway.match(/export async function get\w+/g) ?? [];
    assert.deepEqual(readers.sort(), [
        "export async function getConfirmedShuttleRoster",
        "export async function getConfirmedShuttleRosterForDate",
    ]);
});

test("폴백은 게이트웨이 안에만 있고 밖으로 새지 않는다", () => {
    // 폴백 함수는 export 되면 안 된다. 소비처가 폴백을 직접 부르는 순간 출구가 둘이 된다.
    assert.match(gateway, /^async function fallbackSeasonRoster/m);
    assert.doesNotMatch(gateway, /export async function fallbackSeasonRoster/);
});

// ── ① 확정본이 없을 때(폴백) ──────────────────────────────────

test("확정본이 비어 있으면 원본 폴백으로 내려간다", () => {
    assert.match(gateway, /if \(rows\.length > 0\) return rows\.map\(\(r\) => toEntry\(r, "CONFIRMED"\)\)/);
    assert.match(gateway, /return fallbackSeasonRoster\(seasonId\)/);
});

test("폴백은 공용 대상자 기준을 그대로 쓴다", () => {
    assert.match(gateway, /seasonalShuttleEligibilitySql\(\{ application: "a", item: "it", offering: "o" \}\)/);
    // 손으로 쓴 상태 비교는 금지. 목록이 갈리면 화면마다 결과가 달라진다.
    assert.doesNotMatch(gateway, /'CANCELLED','REJECTED'/);
    assert.doesNotMatch(gateway, /"CANCELLED", ?"REJECTED"/);
});

// ── ② 확정본이 있을 때 ───────────────────────────────────────

test("확정본이 있으면 원본을 섞지 않는다", () => {
    // 확정본과 폴백을 합치면(concat/merge) 확정의 의미가 사라진다.
    const confirmedBlock = gateway.slice(
        gateway.indexOf("export async function getConfirmedShuttleRoster("),
        gateway.indexOf("async function fallbackSeasonRoster"),
    );
    assert.doesNotMatch(confirmedBlock, /\.concat\(/);
    assert.doesNotMatch(confirmedBlock, /\.\.\.fallback/);
});

test("확정본은 soft delete 행을 빼고 읽는다", () => {
    assert.match(gateway, /sr\."removedAt" IS NULL/);
});

test("확정본 경로와 폴백 경로는 같은 변환 함수를 통과한다", () => {
    // 두 경로가 다른 방식으로 값을 만들면 "확정하면 화면이 달라지는" 사고가 난다.
    assert.match(gateway, /toEntry\(r, "CONFIRMED"\)/);
    assert.match(gateway, /toEntry\(\{ \.\.\.r, ride: isRidingShuttleStatus\(r\.requestStatus\) \}, "FALLBACK"\)/);
});

// ── 킬 스위치 ────────────────────────────────────────────────

test("킬 스위치는 기본이 꺼짐이라 아무것도 안 해도 오늘과 같다", () => {
    assert.match(gateway, /if \(mode === true\) return true/);
    assert.match(gateway, /return false;/);
    // 캐시(unstable_cache 5분)를 타면 끄고 5분을 기다려야 한다. 직접 읽어야 한다.
    assert.match(gateway, /FROM "AcademySettings" WHERE id = 'singleton'/);
    assert.doesNotMatch(gateway, /import .*getAcademySettings/);
    assert.doesNotMatch(gateway, /await getAcademySettings\(/);
});

test("킬 스위치 컬럼은 DB에 있고 BOOLEAN이다", () => {
    assert.match(ddl, /ADD COLUMN IF NOT EXISTS "shuttleRosterConfirmedMode" BOOLEAN/);
    assert.match(schema, /shuttleRosterConfirmedMode\s+Boolean\?/);
});

// ── 확정·수정·제외 (원장 전용) ────────────────────────────────

test("확정·수정·제외는 원장(ADMIN)만 할 수 있다", () => {
    assert.match(gateway, /if \(admin\.appUserRole !== "ADMIN"\)/);
    for (const fn of [
        "confirmSeasonalShuttleRoster",
        "updateConfirmedShuttleRosterRow",
        "removeConfirmedShuttleRosterRow",
        "restoreConfirmedShuttleRosterRow",
    ]) {
        const body = gateway.slice(gateway.indexOf(`export async function ${fn}`), gateway.indexOf(`export async function ${fn}`) + 400);
        assert.match(body, /requireRosterOwner\(\)/, `${fn} 에 원장 검사가 없다`);
    }
});

test("조회 함수는 인증을 걸지 않는다(학부모 화면도 쓴다)", () => {
    const readBlock = gateway.slice(
        gateway.indexOf("export async function getConfirmedShuttleRoster("),
        gateway.indexOf("// 확정 · 수정 · 제외"),
    );
    assert.doesNotMatch(readBlock, /requireAdmin\(\)/);
    assert.doesNotMatch(readBlock, /requireRosterOwner\(\)/);
});

test("확정 명단에서 빼는 것은 하드 DELETE가 아니라 soft remove다", () => {
    assert.doesNotMatch(gateway, /DELETE FROM "SeasonalShuttleRoster"/);
    assert.match(gateway, /SET "removedAt" = now\(\), "removedReason" = \$2/);
});

test("재확정이 원장이 고쳐 둔 값을 덮지 않는다", () => {
    assert.match(gateway, /ON CONFLICT \("seasonId", "shuttleRequestId"\) DO NOTHING/);
    assert.doesNotMatch(gateway, /ON CONFLICT[\s\S]{0,80}DO UPDATE/);
});

// ── 스키마 안전장치 ──────────────────────────────────────────

test("확정본은 원본에 FK를 걸지 않는다", () => {
    // FK(CASCADE)를 걸면 원본이 지워질 때 확정본도 같이 죽는다 = 존재 이유가 무너진다.
    assert.doesNotMatch(ddl, /REFERENCES/);
    const model = schema.slice(schema.indexOf("model SeasonalShuttleRoster"), schema.indexOf("model SeasonalShuttleRoster") + 3000);
    assert.doesNotMatch(model, /@relation/);
});

test("확정 단위는 시즌 × 셔틀신청 1행이다", () => {
    assert.match(ddl, /CREATE UNIQUE INDEX IF NOT EXISTS "SeasonalShuttleRoster_season_request_key"/);
    assert.match(ddl, /ON "SeasonalShuttleRoster" \("seasonId", "shuttleRequestId"\)/);
});

test("DDL은 몇 번 실행해도 같다(멱등)", () => {
    assert.match(ddl, /CREATE TABLE IF NOT EXISTS "SeasonalShuttleRoster"/);
    const alters = ddl.match(/^ALTER TABLE .+$/gm) ?? [];
    assert.ok(alters.length > 0);
    for (const line of alters) {
        assert.match(line, /(ADD COLUMN IF NOT EXISTS|ALTER COLUMN)/, `멱등하지 않은 DDL: ${line}`);
    }
    // 기존 테이블을 지우거나 컬럼을 떨어뜨리는 문장이 있으면 안 된다.
    assert.doesNotMatch(ddl, /DROP TABLE/);
    assert.doesNotMatch(ddl, /DROP COLUMN/);
});

test("탑승 여부 전용 컬럼(ride)이 있다", () => {
    // 원본 status를 덮어쓰는 방식은 노선 배정(ASSIGNED)과 같은 칸을 써서 충돌한다.
    assert.match(ddl, /"ride" BOOLEAN NOT NULL DEFAULT true/);
    assert.match(schema, /ride Boolean @default\(true\)/);
});

test("날짜별 확정 테이블은 만들지 않는다", () => {
    // 15운행일 × 2방향 = 30번 확정은 운영이 불가능하다. 날짜는 좌석으로 파생한다.
    assert.doesNotMatch(ddl, /SeasonalShuttleRosterDate/);
    assert.doesNotMatch(schema, /model SeasonalShuttleRosterDate/);
});
