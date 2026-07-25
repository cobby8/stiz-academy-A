/**
 * 셔틀 "확정 시간"(ShuttleRouteStop.plannedAt) 표시 전용 유틸.
 *
 * 왜 필요한가 (이 파일이 생긴 이유):
 *   저장은 한국시간(KST) 기준인데, DB 컬럼은 Timestamptz라 API 응답은 UTC ISO 문자열로 나간다.
 *   예) 관리자가 08:10 입력 → 서버는 "2026-08-03T08:10:00+09:00"으로 해석 → "2026-08-02T23:10:00.000Z" 저장.
 *   이 ISO 문자열을 그대로 잘라 쓰면(slice(11,16)) 화면에 "23:10"이 뜬다.
 *   그 잘못 보이는 값을 관리자가 시간칸에서 다시 저장하면 23:10이 "한국시간 23:10"으로 저장돼
 *   실제 운행 시각이 9시간 밀린다. 그래서 화면 표시는 반드시 Asia/Seoul로 변환한다.
 *
 * 반대로 화면 → 서버로 보낼 때는 "HH:MM"(한국시간)이나 원본 ISO 문자열을 그대로 보내면 된다.
 * 서버(`plannedDate`)가 HH:MM은 KST로, ISO는 그대로 해석한다.
 */
export const KOREA_TIME_ZONE = "Asia/Seoul";

// h23: 자정을 "24:00"이 아니라 "00:00"으로 뽑기 위해 명시한다(<input type="time">이 24시를 못 받음).
const KOREA_HHMM = new Intl.DateTimeFormat("en-GB", {
  timeZone: KOREA_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/**
 * ISO 문자열 또는 Date를 한국시간 "HH:MM"으로 바꾼다.
 * - 이미 "HH:MM"이면 그대로 돌려준다(입력칸에서 편집 중인 값).
 * - 값이 없거나 날짜로 못 읽으면 빈 문자열(= 입력칸 비움).
 */
export function koreaTimeHHMM(value?: string | Date | null): string {
  if (!value) return "";
  if (typeof value === "string" && /^\d{2}:\d{2}$/.test(value.trim())) return value.trim();
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return KOREA_HHMM.format(parsed);
}

/**
 * 화면에 보여줄 "확정 시간" 문구. 시간이 아직 없으면 안내 문구를 돌려준다.
 * (학부모 문자에서 쓰는 "시간 확인 중"과 뜻을 맞춘다.)
 */
export function confirmedTimeLabel(value?: string | Date | null, fallback = "시간 미정"): string {
  return koreaTimeHHMM(value) || fallback;
}

/**
 * 학부모가 신청서에 적어 낸 "희망 시간"을 그대로 보여준다.
 * `pickupTime`은 "오전 9:10", "9:30"처럼 형식이 제각각인 자유 텍스트다.
 * 절대 파싱해서 시간 계산에 쓰지 말 것 — 참고 표시 전용이다.
 */
export function preferredTimeLabel(value?: string | null): string {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized ? `희망 ${normalized} (참고)` : "희망시간 미입력";
}
