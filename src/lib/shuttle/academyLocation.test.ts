import test from "node:test";
import assert from "node:assert/strict";

// @ts-expect-error -- Node's type-stripping runner needs the runtime extension.
import { DEFAULT_ACADEMY_PLACE_NAME, isKoreanCoordinate, parseCoordinate, resolveAcademyShuttleLocation, validateAcademyCoordinateInput } from "./academyLocation.ts";

// 2026-07-26 실측으로 확정한 학원 좌표.
// 카카오맵 장소검색 "스티즈농구교실 다산2호점"(place id 1661652155)과
// 네이버 지역검색이 같은 도로명주소(경기 남양주시 다산중앙로20번길 10-32)를 가리켰고,
// 네이버 좌표(mapx 1271563116 / mapy 376145054)를 정본으로 채택했다.
const ACADEMY = { latitude: 37.6145054, longitude: 127.1563116 };
// 기존 SHUTTLE_ACADEMY_* 환경변수에 들어 있던 값(누군가 지도 핀으로 찍은 것).
const ACADEMY_FROM_ENV = { latitude: 37.614560753512, longitude: 127.1562856933 };

test("확정 좌표는 남양주 다산동 범위 안이다", () => {
  // 다산신도시 대략 범위. 이 범위를 벗어나면 좌표를 잘못 넣은 것이다.
  assert.ok(ACADEMY.latitude > 37.5 && ACADEMY.latitude < 37.7, "위도가 남양주 범위 밖");
  assert.ok(ACADEMY.longitude > 127.1 && ACADEMY.longitude < 127.3, "경도가 남양주 범위 밖");
});

test("DB 좌표와 기존 환경변수 좌표는 같은 건물을 가리킨다(20m 이내)", () => {
  // 위도 1도 ≈ 111km, 이 위도에서 경도 1도 ≈ 88km 로 어림해 거리 계산.
  const latitudeMeters = (ACADEMY.latitude - ACADEMY_FROM_ENV.latitude) * 111_000;
  const longitudeMeters = (ACADEMY.longitude - ACADEMY_FROM_ENV.longitude) * 88_000;
  const distance = Math.hypot(latitudeMeters, longitudeMeters);
  assert.ok(distance < 20, `두 좌표가 ${Math.round(distance)}m 떨어져 있다 — 둘 중 하나가 틀렸을 수 있다`);
});

test("TEXT 컬럼에서 온 문자열 좌표를 숫자로 읽는다", () => {
  assert.equal(parseCoordinate("37.6145054"), 37.6145054);
  assert.equal(parseCoordinate(" 127.1563116 "), 127.1563116);
  assert.equal(parseCoordinate(37.6145054), 37.6145054);
});

test("값 없음·빈칸·숫자 아님은 전부 null로 본다", () => {
  // 빈 문자열을 Number()에 그냥 넣으면 0이 되어 아프리카 앞바다로 간다. 그걸 막는 테스트.
  assert.equal(parseCoordinate(""), null);
  assert.equal(parseCoordinate("   "), null);
  assert.equal(parseCoordinate(null), null);
  assert.equal(parseCoordinate(undefined), null);
  assert.equal(parseCoordinate("서울"), null);
  assert.equal(parseCoordinate(Number.NaN), null);
});

test("위도와 경도를 바꿔 넣으면 범위 검사에서 걸린다", () => {
  assert.ok(isKoreanCoordinate(ACADEMY.latitude, ACADEMY.longitude));
  assert.ok(!isKoreanCoordinate(ACADEMY.longitude, ACADEMY.latitude), "뒤바뀐 좌표가 통과되면 안 된다");
  assert.ok(!isKoreanCoordinate(0, 0));
});

test("DB 설정이 있으면 환경변수보다 먼저 쓴다", () => {
  const resolved = resolveAcademyShuttleLocation({
    settings: { name: "스티즈농구교실 다산2호점", address: "경기 남양주시 다산중앙로20번길 10-32", latitude: "37.6145054", longitude: "127.1563116" },
    env: { name: "STIZ 농구교실 다산점", latitude: "37.614560753512", longitude: "127.1562856933" },
  });
  assert.equal(resolved?.source, "SETTINGS");
  assert.equal(resolved?.name, "스티즈농구교실 다산2호점");
  assert.equal(resolved?.latitude, 37.6145054);
});

test("DB가 비어 있으면 환경변수로 넘어간다(기존 동작 보존)", () => {
  const resolved = resolveAcademyShuttleLocation({
    settings: { name: null, latitude: null, longitude: null },
    env: { name: "STIZ 농구교실 다산점", latitude: "37.614560753512", longitude: "127.1562856933" },
  });
  assert.equal(resolved?.source, "ENV");
  assert.equal(resolved?.longitude, 127.1562856933);
});

test("DB 좌표가 깨져 있어도 환경변수로 넘어간다", () => {
  // 위경도가 뒤바뀐 채 저장된 경우. 그대로 쓰면 T맵이 엉뚱한 곳으로 간다.
  const resolved = resolveAcademyShuttleLocation({
    settings: { latitude: "127.1563116", longitude: "37.6145054" },
    env: { latitude: "37.614560753512", longitude: "127.1562856933" },
  });
  assert.equal(resolved?.source, "ENV");
});

test("양쪽 다 없으면 null이다", () => {
  assert.equal(resolveAcademyShuttleLocation({}), null);
  assert.equal(resolveAcademyShuttleLocation({ settings: { latitude: "", longitude: "" }, env: {} }), null);
});

test("이름이 비어 있어도 빈 문자열이 아니라 기본 이름이 들어간다", () => {
  const resolved = resolveAcademyShuttleLocation({ settings: { latitude: "37.6145054", longitude: "127.1563116" } });
  assert.equal(resolved?.name, DEFAULT_ACADEMY_PLACE_NAME);
  assert.equal(resolved?.address, null);
});

test("저장 검증은 사유를 한국어로 돌려준다", () => {
  const good = validateAcademyCoordinateInput("37.6145054", "127.1563116");
  assert.equal(good.ok, true);

  const empty = validateAcademyCoordinateInput("", "");
  assert.equal(empty.ok, false);
  assert.match(empty.reason, /숫자/);

  const swapped = validateAcademyCoordinateInput("127.1563116", "37.6145054");
  assert.equal(swapped.ok, false);
  assert.match(swapped.reason, /대한민국 범위/);
});
