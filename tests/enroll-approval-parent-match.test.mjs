import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { loadTsModule } from "./_ts-module.mjs";

// 실제 사고(2026-08~09, 4가족): 신청 승인이 학부모를 전화번호 '글자 그대로' 찾는데
// 신청서는 '010-1234-5678', 가입 계정은 '01012345678' 로 저장된다. 그래서 번호가
// 바뀌지 않아도 기존 학부모를 못 찾고 계정·학생을 새로 만들었고,
// **학부모가 로그인하는 계정에는 자녀가 0명**으로 남았다(앱에서 아무것도 안 보임).
// 2026-09-18 실측: 학부모 계정 314개 중 284개(90%)가 숫자만 형식.

const { parentPhoneDigits, isUsablePhoneKey } = await loadTsModule("src/lib/enrollment/parentIdentity.ts");
const admin = await readFile("src/app/actions/admin.ts", "utf8");

test("전화번호는 숫자만 남겨서 비교한다", () => {
  assert.equal(parentPhoneDigits("010-1234-5678"), "01012345678");
  assert.equal(parentPhoneDigits("01012345678"), "01012345678");
  assert.equal(parentPhoneDigits(" 010 1234 5678 "), "01012345678");
  assert.equal(parentPhoneDigits("+82 10-1234-5678"), "821012345678");
  assert.equal(parentPhoneDigits(null), "");
  assert.equal(parentPhoneDigits(undefined), "");
  // 두 형식이 같은 사람으로 판정돼야 한다 — 이게 사고의 핵심이었다.
  assert.equal(parentPhoneDigits("010-1234-5678"), parentPhoneDigits("01012345678"));
});

test("빈 번호·자리채움 번호는 사람을 찾는 열쇠로 쓰지 않는다", () => {
  // 번호가 비어 있는 학부모 계정이 20개 있다. 숫자만 남기면 전부 ''가 되어
  // 서로 같은 사람으로 묶이고, 남의 자녀가 붙는다.
  assert.equal(isUsablePhoneKey(""), false);
  assert.equal(isUsablePhoneKey("0101234"), false, "너무 짧은 번호");
  assert.equal(isUsablePhoneKey("00000000000"), false, "시트 임포트의 자리채움 번호");
  assert.equal(isUsablePhoneKey("11111111111"), false);
  assert.equal(isUsablePhoneKey("821012345678"), false, "국가번호 포함 12자리는 열쇠로 쓰지 않는다");
  assert.equal(isUsablePhoneKey("01012345678"), true);
  assert.equal(isUsablePhoneKey("0312345678"), true, "지역번호 10자리");
});

test("학부모를 찾는 모든 경로가 글자 그대로 비교하지 않는다", async () => {
  // 되돌아가면 4가족 사고가 그대로 재현된다.
  // 승인·엑셀 일괄등록·시트 임포트 세 곳이 같은 결함을 갖고 있었다(2026-09-28 전수 확인).
  const files = ["src/app/actions/admin.ts", "src/app/api/admin/import-students/route.ts"];
  for (const file of files) {
    const source = await readFile(file, "utf8");
    assert.doesNotMatch(
      source,
      /WHERE phone = \$\d+ AND role = 'PARENT'/,
      `${file} — 글자 그대로 비교로 되돌아갔습니다`,
    );
  }
  const digitsCompare = /regexp_replace\(COALESCE\(phone, ''\), '\[\^0-9\]', '', 'g'\) = \$1/g;
  assert.equal((admin.match(digitsCompare) || []).length, 2, "승인·엑셀 두 곳 모두 숫자 비교여야 합니다");
  assert.match(admin, /isUsablePhoneKey\(parentPhoneDigitsValue\)/, "승인 경로에 빈 번호 가드가 있어야 합니다");
});

test("신청서에 연결된 가입 계정을 전화번호보다 먼저 본다", () => {
  // 가입 절차에서 번호를 확인하고 연결해 둔 값이라 가장 믿을 수 있다.
  assert.match(admin, /app\.parentUserId \?\? app\.parentuserid/, "연결된 계정을 읽어야 합니다");
  // 승인 함수 안에서만 순서를 본다(엑셀 일괄등록에도 숫자 비교가 있어 파일 전체로 재면 어긋난다).
  const linkedAt = admin.indexOf("const linkedParentUserId");
  assert.ok(linkedAt > 0, "연결 계정 변수를 찾지 못했습니다");
  const phoneAt = admin.indexOf("regexp_replace(COALESCE(phone, '')", linkedAt);
  assert.ok(phoneAt > linkedAt, "연결 계정 확인이 전화번호 조회보다 앞서야 합니다");
  // 그리고 전화번호 조회는 연결 계정이 없을 때만 돈다.
  assert.match(admin, /linkedUsers\.length === 0 && isUsablePhoneKey\(parentPhoneDigitsValue\)/);
});

test("실제로 로그인에 쓰이는 계정을 우선 고른다", () => {
  // 같은 번호로 계정이 둘이면(이미 4쌍 존재) 로그인 계정 쪽에 자녀를 붙여야
  // 학부모 앱에서 자녀가 보인다.
  assert.match(admin, /ORDER BY \("authUserId" IS NOT NULL\) DESC, "createdAt" ASC/);
});

test("새로 만드는 계정은 숫자만 형식으로 저장한다", () => {
  // 가입 경로와 형식을 맞춰야 다음 조회가 또 어긋나지 않는다.
  assert.match(admin, /parent_\$\{parentPhoneDigitsValue\}@stiz\.local/);
  assert.match(admin, /parentPhoneDigitsValue \|\| parentPhone,/);
});

test("학생 중복 생성을 막는 기존 방어는 그대로 남아 있다", () => {
  assert.match(admin, /STUDENT_AMBIGUOUS/, "동명 형제는 자동 선택하지 않는다");
  assert.match(admin, /fallback\.length === 1/, "단일 학생은 재사용한다");
});
