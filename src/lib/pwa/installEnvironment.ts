/**
 * PWA 설치 안내에 쓰는 "지금 어떤 환경인가" 판별 순수 모듈.
 *
 * 왜 분리하나:
 *  - 학부모 앱(/app)과 선생님 앱(/staff/install) 두 화면이 같은 판별을 각자 갖고 있으면
 *    한쪽만 고쳐지는 사고가 난다. 판별은 여기 한 곳에서만 한다.
 *  - 외부 의존성이 전혀 없는 순수 함수라서 테스트에서 실제 UA 문자열로 실행 검증할 수 있다.
 *    (소스 문자열 매칭만으로는 판별 로직의 오류를 못 잡는다)
 */

/** 홈 화면 추가가 막히는 인앱 브라우저 종류 */
export type InAppBrowserKind = "kakaotalk" | "naver" | "instagram" | "facebook" | "line" | "generic";

export type InstallPlatform = "ios" | "android" | "other";

/** 안내 문구를 고르는 기준값 (설치 가능 여부와는 별개로 관리한다) */
export type InstallDeviceState = "ios-safari" | "ios-browser" | "android" | "other";

export type InstallEnvironment = {
  platform: InstallPlatform;
  /** iOS이면서 진짜 Safari(인앱 아님) — 홈 화면 추가가 가능한 유일한 경우 */
  isIosSafari: boolean;
  inAppBrowser: InAppBrowserKind | null;
  deviceState: InstallDeviceState;
};

type DetectInput = {
  userAgent: string;
  /** navigator.platform (iPadOS 데스크톱 모드 판별용) */
  platform?: string;
  /** navigator.maxTouchPoints (iPadOS 데스크톱 모드 판별용) */
  maxTouchPoints?: number;
};

const safe = (value: unknown): string => (typeof value === "string" ? value : "");

/** UA만으로 판단하는 iOS 여부 (iPadOS 데스크톱 모드는 여기서 안 잡힌다) */
function hasIosToken(userAgent: string): boolean {
  return /iphone|ipad|ipod/i.test(userAgent);
}

/** Safari가 아닌 iOS 브라우저(크롬·파폭·엣지·오페라)의 표식 */
function hasNonSafariIosBrowserToken(userAgent: string): boolean {
  return /crios|fxios|edgios|opios/i.test(userAgent);
}

/**
 * 인앱 브라우저 판별.
 * 원칙: **확실한 표식만 잡는다.** 애매하면 일반 브라우저로 둔다(오탐이 미탐보다 나쁘다).
 */
export function detectInAppBrowser(userAgent: string): InAppBrowserKind | null {
  const ua = safe(userAgent);
  if (!ua) return null;

  // 카카오톡: iOS/안드로이드 모두 UA 끝에 "KAKAOTALK <버전>"이 붙는다.
  if (/kakaotalk/i.test(ua)) return "kakaotalk";
  // 네이버 앱: "NAVER(inapp; search; ...)" 형태. Whale 브라우저 UA에는 NAVER 토큰이 없다.
  if (/naver\(inapp/i.test(ua) || /\bnaver\b/i.test(ua)) return "naver";
  if (/instagram/i.test(ua)) return "instagram";
  // 페이스북/메신저: [FBAN/FBIOS;FBAV/...] 형태
  if (/\bfban\b|\bfbav\b|fb_iab/i.test(ua)) return "facebook";
  // 라인: "Line/14.5.0" (앞이 공백·세미콜론·괄호일 때만 — Inline 같은 단어 오탐 방지)
  if (/(^|[\s;(])line\//i.test(ua)) return "line";

  // 이름을 모르는 웹뷰는 "확실한 신호"만 인정한다.
  // 1) 안드로이드 웹뷰는 UA에 "; wv)" 가 들어간다.
  if (/;\s*wv[);]/i.test(ua)) return "generic";
  // 2) iOS 브라우저는 모두 UA에 Safari 토큰을 달고 다닌다. 없으면 WKWebView(=인앱)다.
  if (hasIosToken(ua) && !/safari/i.test(ua)) return "generic";

  return null;
}

/** 기기 + 브라우저 환경을 한 번에 판별한다. */
export function detectInstallEnvironment(input: DetectInput): InstallEnvironment {
  const ua = safe(input?.userAgent);
  // iPadOS는 기본이 데스크톱 모드라 UA에 iPad가 없다. 터치 지원 Mac으로 위장하므로 이렇게 잡는다.
  const isIpadOs = safe(input?.platform) === "MacIntel" && (input?.maxTouchPoints ?? 0) > 1;
  const isIos = hasIosToken(ua) || isIpadOs;
  const isAndroid = /android/i.test(ua);

  const inAppBrowser = detectInAppBrowser(ua);
  // 인앱 브라우저는 UA에 Safari가 있어도(라인 등) Safari가 아니다. 반드시 제외한다.
  const isIosSafari =
    isIos && inAppBrowser === null && /safari/i.test(ua) && !hasNonSafariIosBrowserToken(ua);

  const platform: InstallPlatform = isIos ? "ios" : isAndroid ? "android" : "other";
  const deviceState: InstallDeviceState = isIos
    ? isIosSafari
      ? "ios-safari"
      : "ios-browser"
    : isAndroid
      ? "android"
      : "other";

  return { platform, isIosSafari, inAppBrowser, deviceState };
}

/** 사용자에게 보여줄 인앱 브라우저 이름 */
export function getInAppBrowserLabel(kind: InAppBrowserKind): string {
  switch (kind) {
    case "kakaotalk":
      return "카카오톡";
    case "naver":
      return "네이버 앱";
    case "instagram":
      return "인스타그램";
    case "facebook":
      return "페이스북";
    case "line":
      return "라인";
    default:
      return "앱 안의 브라우저";
  }
}

/**
 * 카카오톡만 외부 브라우저를 여는 스킴을 공개해 두었다.
 * 이 주소로 이동하면 기본 브라우저(아이폰=Safari)에서 같은 페이지가 다시 열린다.
 */
export function buildKakaoExternalUrl(currentUrl: string): string {
  return `kakaotalk://web/openExternal?url=${encodeURIComponent(safe(currentUrl))}`;
}

/** 스킴이 없는 인앱 브라우저용 — 메뉴로 빠져나가는 짧은 단계 안내 */
export function getInAppEscapeSteps(kind: InAppBrowserKind, platform: InstallPlatform): string[] {
  if (kind === "kakaotalk") {
    return platform === "ios"
      ? ["오른쪽 아래 ⋯ 누르기", "‘다른 브라우저로 열기’ 선택"]
      : ["오른쪽 위 ⋮ 누르기", "‘다른 브라우저로 열기’ 선택"];
  }
  return platform === "ios"
    ? ["오른쪽 아래(또는 위) ⋯ 누르기", "‘Safari로 열기’ 선택"]
    : ["오른쪽 위 ⋮ 누르기", "‘다른 브라우저로 열기’ 선택"];
}
