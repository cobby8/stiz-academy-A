/**
 * "설치 화면에 지금 무엇을 보여줄까"를 정하는 순수 모듈.
 *
 * 왜 필요한가 (실제로 겪은 문제):
 *  - 크롬은 beforeinstallprompt 를 페이지가 그려진 뒤 1~2초쯤 뒤늦게 쏜다.
 *  - 그런데 화면은 0초에 이미 "설치 버튼 없음 + 수동 안내 + 이미 설치돼 있으면…" 을 보여준다.
 *  - 그 1.5초를 본 사람은 "설치가 안 되는구나" 하고 닫아 버린다. (원장이 실제로 그렇게 판단)
 *  → 그래서 마운트 직후 아주 짧은 "설치 준비 확인 중" 대기 창을 두고, 그동안 수동 안내를 감춘다.
 *
 * ⚠️ 대기 창은 "표시를 미루는 것"일 뿐이다. 프롬프트를 자동으로 호출(prompt())하지 않는다.
 *    사용자 제스처 밖에서 호출하면 브라우저가 차단하고 그 이벤트가 무효화된다.
 *
 * 왜 별도 순수 함수인가: 화면이 두 개(학부모 /app, 선생님 /staff/install)라 로직이 갈라지면
 * 한쪽만 고쳐지는 사고가 난다. 판단은 여기 한 곳에서만 하고 테스트로 잠근다.
 */

import type { InstallDeviceState } from "./installEnvironment";

/** 화면이 아는 기기 상태 = 판별 전(checking) + 이미 설치됨(installed) + 판별 결과 */
export type InstallScreenDeviceState = "checking" | "installed" | InstallDeviceState;

/** 대기 창 길이(ms). 크롬 실측 지연(1~2초) 중 짧은 쪽에 맞춘다 — 더 길면 그만큼 손해다. */
export const INSTALL_PROMPT_WAIT_MS = 1500;

export type InstallScreenPhase = "installed" | "waiting" | "guide";

export type InstallScreenView = {
  phase: InstallScreenPhase;
  /** 설치 준비 확인 중 표시(스피너 한 줄) */
  showWaitingNotice: boolean;
  /** '지금 앱 설치하기' 버튼 */
  showInstallButton: boolean;
  /** 수동 설치 안내 카드(홈 화면에 추가하는 방법 / iOS 3단계 등) */
  showManualGuide: boolean;
  /** 카카오톡 등 인앱 브라우저 탈출 카드 */
  showInAppEscape: boolean;
};

export type InstallScreenViewInput = {
  deviceState: InstallScreenDeviceState;
  /** beforeinstallprompt 를 잡아 두었는가 */
  hasPrompt: boolean;
  /** 카카오톡·네이버 등 인앱 브라우저인가 */
  isInAppBrowser: boolean;
  /** 대기 창(INSTALL_PROMPT_WAIT_MS)이 끝났는가 */
  waitElapsed: boolean;
};

/**
 * 이 환경에서 설치 프롬프트를 기다릴 가치가 있는가.
 *
 * - iOS: 애플은 beforeinstallprompt 를 **아예 보내지 않는다.** 기다리면 100% 손해다 → 즉시 안내.
 * - 인앱 브라우저(카카오톡 등): 홈 화면 추가 자체가 막혀 프롬프트가 오지 않는다 → 즉시 탈출 안내.
 * - 이미 설치됨: 기다릴 이유가 없다.
 * - 안드로이드 / PC: 늦게 올 수 있으므로 잠깐 기다린다.
 */
export function shouldWaitForInstallPrompt(
  input: Pick<InstallScreenViewInput, "deviceState" | "isInAppBrowser">,
): boolean {
  const { deviceState, isInAppBrowser } = input;
  if (deviceState === "installed") return false;
  if (deviceState === "ios-safari" || deviceState === "ios-browser") return false;
  if (isInAppBrowser) return false;
  return true;
}

/** 지금 화면에 무엇을 보여줄지 한 번에 계산한다. */
export function resolveInstallScreenView(input: InstallScreenViewInput): InstallScreenView {
  const { deviceState, hasPrompt, isInAppBrowser, waitElapsed } = input;

  // 1) 이미 홈 화면 앱으로 실행 중 — 대기 없이 바로 완료 표시.
  if (deviceState === "installed") {
    return {
      phase: "installed",
      showWaitingNotice: false,
      showInstallButton: false,
      showManualGuide: false,
      showInAppEscape: false,
    };
  }

  // 2) 프롬프트가 잡혔으면 대기가 남았어도 즉시 설치 버튼으로 전환한다(대기 표시 제거).
  if (hasPrompt) {
    return {
      phase: "guide",
      showWaitingNotice: false,
      showInstallButton: true,
      // 기기 판별 전(checking)에는 안내 문구를 고를 수 없으므로 카드는 아직 띄우지 않는다.
      showManualGuide: deviceState !== "checking" && !isInAppBrowser,
      showInAppEscape: isInAppBrowser,
    };
  }

  // 3) 기기 판별 전이거나 대기 창이 아직 안 끝났으면 수동 안내를 감추고 대기 표시만 보여준다.
  const waiting =
    deviceState === "checking" ||
    (!waitElapsed && shouldWaitForInstallPrompt({ deviceState, isInAppBrowser }));

  if (waiting) {
    return {
      phase: "waiting",
      showWaitingNotice: true,
      showInstallButton: false,
      showManualGuide: false,
      showInAppEscape: false,
    };
  }

  // 4) 기다려도 프롬프트가 안 왔다(또는 기다릴 필요가 없는 환경) → 그때 수동 안내를 보여준다.
  return {
    phase: "guide",
    showWaitingNotice: false,
    showInstallButton: false,
    showManualGuide: !isInAppBrowser,
    showInAppEscape: isInAppBrowser,
  };
}
