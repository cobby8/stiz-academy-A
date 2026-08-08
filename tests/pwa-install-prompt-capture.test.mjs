import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const layoutSource = await readFile("src/app/layout.tsx", "utf8");
const staffInstallSource = await readFile("src/app/teacher-app/StaffAppInstallClient.tsx", "utf8");
const parentInstallSource = await readFile("src/app/parent-app/ParentAppInstallClient.tsx", "utf8");

const installScreens = [
  ["선생님 앱", staffInstallSource],
  ["학부모 앱", parentInstallSource],
];

// 루트 레이아웃 <head>에 넣은 인라인 캡처 스크립트 원문을 꺼낸다.
const capturedScript = layoutSource.match(/__html:\s*`([\s\S]*?)`,/)?.[1];

test("루트 레이아웃 head에 설치 이벤트 캡처 스크립트가 있다", () => {
  assert.ok(capturedScript, "layout.tsx <head>에 인라인 캡처 스크립트가 있어야 합니다.");
  assert.match(capturedScript, /beforeinstallprompt/);
  assert.match(capturedScript, /window\.__stizInstallPrompt/);
  // 하이드레이션 전에 실행돼야 의미가 있으므로 </head> 앞에 위치해야 한다.
  assert.ok(
    layoutSource.indexOf("__stizInstallPrompt") < layoutSource.indexOf("</head>"),
    "캡처 스크립트는 <head> 안에 있어야 합니다.",
  );
});

test("캡처 스크립트는 이벤트를 전역에 보관하고 커스텀 이벤트로 알린다", () => {
  // 가짜 window(EventTarget)에 스크립트를 실제로 실행시켜 동작을 확인한다.
  const fakeWindow = new EventTarget();
  const fired = [];
  fakeWindow.addEventListener("stiz:installprompt", () => fired.push("stiz:installprompt"));
  fakeWindow.addEventListener("stiz:installed", () => fired.push("stiz:installed"));

  new Function("window", capturedScript)(fakeWindow);

  // 1) 설치 프롬프트가 오면 전역에 보관되고 stiz:installprompt 가 발신된다.
  const promptEvent = new Event("beforeinstallprompt", { cancelable: true });
  fakeWindow.dispatchEvent(promptEvent);
  assert.equal(fakeWindow.__stizInstallPrompt, promptEvent);
  assert.equal(promptEvent.defaultPrevented, true);
  assert.deepEqual(fired, ["stiz:installprompt"]);

  // 2) 설치가 끝나면 보관값을 비우고 stiz:installed 가 발신된다.
  fakeWindow.dispatchEvent(new Event("appinstalled"));
  assert.equal(fakeWindow.__stizInstallPrompt, null);
  assert.deepEqual(fired, ["stiz:installprompt", "stiz:installed"]);
});

test("캡처 스크립트가 두 번 실행돼도 리스너가 중복 등록되지 않는다", () => {
  const fakeWindow = new EventTarget();
  let count = 0;
  fakeWindow.addEventListener("stiz:installprompt", () => {
    count += 1;
  });

  new Function("window", capturedScript)(fakeWindow);
  new Function("window", capturedScript)(fakeWindow);
  fakeWindow.dispatchEvent(new Event("beforeinstallprompt", { cancelable: true }));

  assert.equal(count, 1);
});

for (const [label, source] of installScreens) {
  test(`${label} 설치 화면은 마운트 시 보관된 설치 프롬프트를 먼저 읽는다`, () => {
    // 핵심 회귀 방지: 전역 보관값을 읽지 않으면 하이드레이션 전에 온 이벤트를 놓쳐 버튼이 사라진다.
    assert.match(source, /if \(globalWindow\.__stizInstallPrompt\)/);
    assert.match(source, /setInstallPrompt\(globalWindow\.__stizInstallPrompt\)/);
    assert.match(source, /addEventListener\("stiz:installprompt"/);
    assert.match(source, /addEventListener\("stiz:installed"/);
    // 늦게 오는 이벤트 대비로 직접 구독도 남아 있어야 한다.
    assert.match(source, /addEventListener\("beforeinstallprompt"/);
    assert.match(source, /addEventListener\("appinstalled"/);
    // 등록한 리스너 4종은 모두 해제한다.
    for (const eventName of ["stiz:installprompt", "stiz:installed", "beforeinstallprompt", "appinstalled"]) {
      assert.ok(
        source.includes(`removeEventListener("${eventName}"`),
        `${eventName} 리스너를 해제해야 합니다.`,
      );
    }
  });

  test(`${label} 설치 화면은 설치 실행 후 전역 보관값을 비운다`, () => {
    assert.match(source, /__stizInstallPrompt = null/);
  });

  test(`${label} 설치 화면은 기기 판별과 설치 가능 여부를 분리한다`, () => {
    // beforeinstallprompt 를 받았다고 기기를 android 로 단정하면 PC 안내가 틀어진다.
    assert.doesNotMatch(source, /event\.preventDefault\(\)[\s\S]{0,200}setDeviceState\("android"\)/);
    // PC(other)에서도 프롬프트가 있으면 설치할 수 있다고 안내한다.
    assert.match(source, /deviceState === "other" && installPrompt/);
    assert.match(source, /deviceState === "other" && !installPrompt/);
    // 이미 설치된 경우를 오해하지 않도록 한 줄 안내가 있다.
    assert.match(source, /이미 설치돼 있으면 설치 버튼이 나타나지 않습니다/);
  });

  test(`${label} 설치 화면의 iOS 안내와 기존 문구는 그대로 유지된다`, () => {
    assert.match(source, /Safari의 공유 버튼 누르기/);
    assert.match(source, /‘홈 화면에 추가’ 선택하기/);
    assert.match(source, /오른쪽 위 ‘추가’ 누르기/);
    assert.match(source, /설치하지 않아도 웹에서 바로 사용할 수 있습니다\./);
  });
}
