/**
 * 기사님 앱이 "마지막에 연 운행 링크"를 기억하는 규칙.
 *
 * 기사님 앱은 로그인이 없고 토큰 주소 자체가 화면이다. 그래서 홈 화면 아이콘이
 * 여는 시작 주소(/driver)에는 토큰이 없다. 기억해 두지 않으면 아이콘을 누를 때마다
 * 기사님이 카톡에서 링크를 다시 찾아야 한다.
 *
 * 저장·판독 규칙을 순수 함수로 떼어 둔 이유: 저장값은 사용자가 손댈 수 있는
 * localStorage 라 그대로 주소에 붙이면 안 된다(`../..` 같은 값이 들어오면 엉뚱한
 * 경로로 이동한다). 검증을 한 곳에 모아 두면 저장·판독 양쪽이 같은 규칙을 쓴다.
 */

export const DRIVER_TOKEN_STORAGE_KEY = "stiz:driver-run-token";

/** 운행 토큰이 가질 수 있는 모양. 영문·숫자·-·_ 만 허용해 경로 조작을 막는다. */
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;

/**
 * 저장돼 있던 값이 토큰으로 쓸 수 있는 모양인지 확인한다.
 * 모양만 본다 — 실제로 살아 있는 토큰인지는 서버가 판정한다.
 */
export function sanitizeStoredDriverToken(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return TOKEN_PATTERN.test(trimmed) ? trimmed : null;
}

/** 저장값으로 이동할 주소를 만든다. 쓸 수 없는 값이면 null(이동하지 않음). */
export function buildDriverRunPath(raw: string | null | undefined): string | null {
  const token = sanitizeStoredDriverToken(raw);
  return token ? `/driver/${token}` : null;
}
