import test from "node:test";
import assert from "node:assert/strict";
import {
    buildConfirmedRosterUpdate,
    pinSetClauses,
    rosterPatchTarget,
} from "../src/lib/seasonal/shuttleRosterEdit.ts";

// 확정본 수정 SQL을 **실제로 만들어 보고** 검사하는 테스트.
//
// 왜 굳이 실행하나: 여기서 나는 사고(같은 컬럼 두 번 지정 → Postgres 42701 → 500,
// 쓰지도 않는 파라미터를 남겨 bind 개수 어긋남, $n 번호 밀림)는 소스 문자열을 아무리
// 뒤져도 잡히지 않는다. 리뷰에서 실제로 이 방식으로만 잡히는 결함(R-6)이 나왔다.

const PIN = {
    latitude: 37.5665,
    longitude: 127.1889,
    address: "경기도 남양주시 다산동 1",
    roadAddress: "경기도 남양주시 다산중앙로 1",
    source: "MAP_PIN",
    placeId: "place-1",
    accuracyMeters: 12,
};

/** SET 절이 건드리는 컬럼 목록. */
function columnsOf(sets) {
    return sets.map((s) => s.match(/^"([^"]+)"/)?.[1]).filter(Boolean);
}

/** SQL 문자열에서 참조하는 파라미터 번호 집합. */
function placeholdersOf(sql) {
    return new Set((sql.match(/\$\d+/g) ?? []).map((p) => Number(p.slice(1))));
}

// ── 같은 컬럼을 두 번 지정하지 않는다 (R-6) ─────────────────────────

test("텍스트와 핀이 한 번에 와도 같은 컬럼이 두 번 들어가지 않는다", () => {
    // 이게 깨지면 Postgres가 42701(multiple assignments to same column)로 거절해 500이 난다.
    const { sets } = buildConfirmedRosterUpdate("roster-1", {
        pickupLocation: "다산이편한세상자이 정문",
        pickupPin: PIN,
    });
    const cols = columnsOf(sets);
    assert.equal(new Set(cols).size, cols.length, `중복 컬럼: ${cols.join(", ")}`);
});

test("등원·하원 핀과 텍스트를 전부 한꺼번에 보내도 중복이 없다", () => {
    const { sets } = buildConfirmedRosterUpdate("roster-1", {
        ride: true,
        pickupLocation: "정문",
        pickupTime: "08:30",
        dropoffLocation: "후문",
        dropoffSameAsPickup: false,
        note: "형제 같이 탑승",
        pickupPin: PIN,
        dropoffPin: { ...PIN, latitude: 37.57, longitude: 127.19 },
    });
    const cols = columnsOf(sets);
    assert.equal(new Set(cols).size, cols.length, `중복 컬럼: ${cols.join(", ")}`);
});

test("표시 라벨은 사람이 직접 친 값이 이긴다", () => {
    // 핀의 라벨 절은 "비어 있을 때만 채우기"라, 새로 친 이름을 버리면 저장한 줄 알고 안 바뀐다.
    const { sets, args } = buildConfirmedRosterUpdate("roster-1", {
        pickupLocation: "다산이편한세상자이 정문",
        pickupPin: PIN,
    });
    const label = sets.find((s) => s.startsWith('"pickupLocation"'));
    assert.ok(label, "pickupLocation 절이 없다");
    assert.doesNotMatch(label, /COALESCE/, "직접 친 라벨이 핀의 COALESCE에 먹혔다");
    assert.ok(args.includes("다산이편한세상자이 정문"));
});

test("핀만 보내면 라벨은 비어 있을 때만 채운다(건물명 보존)", () => {
    const { sets } = buildConfirmedRosterUpdate("roster-1", { pickupPin: PIN });
    const label = sets.find((s) => s.startsWith('"pickupLocation"'));
    assert.match(label, /COALESCE\(NULLIF\(btrim\("pickupLocation"\), ''\), \$\d+\)/);
});

// ── 파라미터 번호가 어긋나지 않는다 ─────────────────────────────────

test("만들어진 파라미터는 모두 SQL에서 쓰인다(남는 파라미터 0)", () => {
    // 안 쓰는 파라미터가 남으면 "bind message supplies N parameters, but requires M"으로 죽는다.
    const { sets, args } = buildConfirmedRosterUpdate("roster-1", {
        pickupLocation: "정문",       // 핀과 같은 컬럼을 노린다(핀 절을 대체하는 경로)
        dropoffLocation: "후문",
        pickupPin: PIN,
        dropoffPin: PIN,
        note: "메모",
    });
    const used = placeholdersOf(sets.join(", "));
    used.add(1); // $1 = rosterId, WHERE 절에서 쓴다
    for (let i = 1; i <= args.length; i += 1) {
        assert.ok(used.has(i), `$${i} 파라미터가 어디에도 쓰이지 않는다(bind 개수 불일치)`);
    }
    // 반대로 args 범위를 넘는 번호를 참조해도 안 된다.
    for (const n of used) assert.ok(n <= args.length, `$${n}는 args 범위(${args.length})를 넘는다`);
});

test("args[0]은 언제나 rosterId다($1 = WHERE id)", () => {
    const { args } = buildConfirmedRosterUpdate("roster-42", { ride: false });
    assert.equal(args[0], "roster-42");
});

test("주소 파라미터는 주소와 라벨이 함께 재사용한다(중복 생성 없음)", () => {
    const { sets, args } = buildConfirmedRosterUpdate("roster-1", { pickupPin: PIN });
    const addressClause = sets.find((s) => s.startsWith('"pickupAddress"'));
    const labelClause = sets.find((s) => s.startsWith('"pickupLocation"'));
    const addressArg = addressClause.match(/\$(\d+)/)[1];
    assert.match(labelClause, new RegExp(`\\$${addressArg}\\)`), "라벨이 주소와 다른 파라미터를 쓴다");
    assert.equal(args.filter((a) => a === PIN.address).length, 1, "같은 주소 값이 두 번 들어갔다");
});

// ── 핀 저장 규칙 ────────────────────────────────────────────────────

test("핀을 찍으면 위치확인 시각을 함께 채운다", () => {
    // 이 값이 비면 노선 편성의 "이 학생 배차 가능" 판정이 죽는다.
    const { sets } = buildConfirmedRosterUpdate("roster-1", { pickupPin: PIN, dropoffPin: PIN });
    assert.ok(sets.includes('"pickupConfirmedAt" = now()'));
    assert.ok(sets.includes('"dropoffConfirmedAt" = now()'));
});

test("핀은 확정본에 있는 컬럼만 건드린다", () => {
    const allowed = new Set([
        "Latitude", "Longitude", "Address", "RoadAddress", "LocationSource",
        "PlaceId", "AccuracyMeters", "ConfirmedAt", "Location",
    ].flatMap((suffix) => [`pickup${suffix}`, `dropoff${suffix}`]));
    const { sets } = buildConfirmedRosterUpdate("roster-1", { pickupPin: PIN, dropoffPin: PIN });
    for (const col of columnsOf(sets)) assert.ok(allowed.has(col), `${col}은 핀이 건드릴 컬럼이 아니다`);
});

test("좌표가 이상하면 조용히 무시하지 않고 던진다", () => {
    // 조용히 넘기면 원장은 저장된 줄 알고, 그 학생만 배차에서 빠진 걸 현장에서 알게 된다.
    for (const bad of [
        { latitude: 91, longitude: 127 },
        { latitude: 37, longitude: 181 },
        { latitude: Number.NaN, longitude: 127 },
        { latitude: "여기요", longitude: 127 },
        { latitude: 37, longitude: null },
    ]) {
        assert.throws(
            () => buildConfirmedRosterUpdate("roster-1", { pickupPin: bad }),
            /좌표가 올바르지 않습니다/,
            `${JSON.stringify(bad)} 를 통과시켰다`,
        );
    }
});

test("좌표가 이상하면 SQL을 한 조각도 만들지 않는다", () => {
    // 절반만 만들어 두면 나중에 "일부만 저장"이 된다. 던지는 시점이 조립 전이어야 한다.
    let sets = null;
    try { sets = buildConfirmedRosterUpdate("roster-1", { ride: true, pickupPin: { latitude: 999, longitude: 0 } }); }
    catch { /* 기대한 실패 */ }
    assert.equal(sets, null);
});

test("모르는 source는 MAP_PIN으로 떨어진다", () => {
    const { sets, args } = buildConfirmedRosterUpdate("roster-1", { pickupPin: { ...PIN, source: "ADMIN_PIN" } });
    const clause = sets.find((s) => s.startsWith('"pickupLocationSource"'));
    const idx = Number(clause.match(/\$(\d+)/)[1]);
    assert.equal(args[idx - 1], "MAP_PIN");
});

test("주소가 하나도 없으면 빈칸 대신 안내 문구가 들어간다", () => {
    const { args } = buildConfirmedRosterUpdate("roster-1", {
        pickupPin: { latitude: 37.5, longitude: 127.1 },
    });
    assert.ok(args.includes("지도에서 선택한 위치"));
});

test("아무것도 안 보내면 UPDATE 할 게 없다", () => {
    const { sets, args } = buildConfirmedRosterUpdate("roster-1", {});
    assert.deepEqual(sets, []);
    assert.deepEqual(args, ["roster-1"]);
});

test("pinSetClauses는 [컬럼, 절] 쌍을 돌려준다(중복 제거의 열쇠)", () => {
    const args = [];
    const arg = (v) => { args.push(v); return `$${args.length}`; };
    const pairs = pinSetClauses("pickup", PIN, arg);
    for (const [col, clause] of pairs) {
        assert.equal(typeof col, "string");
        assert.ok(clause.startsWith(`"${col}" =`), `${col} 컬럼과 절이 어긋난다: ${clause}`);
    }
});

// ── 저장 경로 선택 ──────────────────────────────────────────────────

test("확정본 행이면 rosterId로, 아니면 requestId로 보낸다", () => {
    assert.deepEqual(rosterPatchTarget({ rosterId: "r-1", requestId: "req-1" }), { rosterId: "r-1" });
    assert.deepEqual(rosterPatchTarget({ rosterId: null, requestId: "req-1" }), { requestId: "req-1" });
    // 빈 문자열도 "없음"으로 본다(확정본 id는 절대 빈 문자열이 아니다).
    assert.deepEqual(rosterPatchTarget({ rosterId: "", requestId: "req-1" }), { requestId: "req-1" });
});
