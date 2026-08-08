import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

// 저장값 판별은 의존성 없는 순수 함수라 실제로 실행해서 검증한다.
// (문자열 매칭으로는 정규식 실수를 절대 못 잡는다)
const moduleSource = await readFile("src/lib/shuttle/driverTokenStorage.ts", "utf8");
const transpiled = ts.transpileModule(moduleSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { sanitizeStoredDriverToken, buildDriverRunPath, DRIVER_TOKEN_STORAGE_KEY } = await import(
  `data:text/javascript;base64,${Buffer.from(transpiled).toString("base64")}`
);

const manifest = JSON.parse(await readFile("public/driver-manifest.json", "utf8"));

test("정상 토큰만 통과시킨다", () => {
  assert.equal(sanitizeStoredDriverToken("abcdefgh12345678"), "abcdefgh12345678");
  assert.equal(sanitizeStoredDriverToken("  abcdefgh12345678  "), "abcdefgh12345678");
  assert.equal(sanitizeStoredDriverToken("Ab-cd_ef12"), "Ab-cd_ef12");
});

test("주소를 조작하려는 저장값은 거부한다", () => {
  // localStorage 는 사용자가 손댈 수 있다. 그대로 주소에 붙이면 엉뚱한 경로로 이동한다.
  for (const bad of [
    "../../admin/students",
    "..",
    "abc/def12345",
    "abcdefgh1234?x=1",
    "abcdefgh1234#y",
    "abcdefgh 1234",
    "https://evil.example/x",
    "short",
    "",
    "   ",
    null,
    undefined,
    12345678,
    {},
  ]) {
    assert.equal(sanitizeStoredDriverToken(bad), null, `거부해야 합니다: ${String(bad)}`);
    assert.equal(buildDriverRunPath(bad), null, `주소를 만들면 안 됩니다: ${String(bad)}`);
  }
});

test("통과한 토큰만 운행 주소가 된다", () => {
  assert.equal(buildDriverRunPath("abcdefgh12345678"), "/driver/abcdefgh12345678");
  assert.equal(DRIVER_TOKEN_STORAGE_KEY, "stiz:driver-run-token");
});

test("기사님 앱의 시작 주소는 실제로 열리는 페이지다", async () => {
  // 이 페이지가 없어서 설치해도 홈 화면 아이콘이 404 를 열고 있었다.
  const page = await readFile("src/app/driver/page.tsx", "utf8");
  assert.match(page, /DriverHomeClient/);
});

test("기사님 앱 주소에 끝 슬래시를 붙이지 않는다", () => {
  // /driver/ 로 두면 Next 가 /driver 로 308 되돌리는데, 그 주소는 scope(/driver/)
  // 밖이라 앱이 시작하자마자 영역을 벗어난다(실측 확인).
  assert.equal(manifest.start_url, "/driver");
  assert.equal(manifest.scope, "/driver");
});

test("만료된 링크는 기억하지 않고, 앱 영역 밖에서는 저장하지 않는다", async () => {
  const runPage = await readFile("src/components/shuttle/UnifiedDriverRunPage.tsx", "utf8");
  // 토큰 검증 실패는 그대로 반환하고 끝나야 한다(기억 컴포넌트에 닿지 않음).
  const errorReturn = runPage.indexOf("유효하지 않은 링크입니다");
  const remember = runPage.indexOf("rememberToken && <RememberDriverToken");
  assert.ok(errorReturn >= 0 && remember > errorReturn, "기억은 토큰 검증을 통과한 뒤에만 해야 합니다.");

  // 설치된 앱의 영역은 /driver 다. 이 주소에서만 켠다.
  const driverPage = await readFile("src/app/driver/[token]/page.tsx", "utf8");
  assert.match(driverPage, /rememberToken/);
  for (const path of ["src/app/shuttle/run/[token]/page.tsx", "src/app/shuttle/regular/[token]/page.tsx"]) {
    assert.doesNotMatch(await readFile(path, "utf8"), /rememberToken/, `${path} 는 앱 영역 밖입니다.`);
  }
});
