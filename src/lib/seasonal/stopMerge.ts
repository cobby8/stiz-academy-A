// "같은 장소인가" 판정 — 정차 병합의 **단일 기준**. 부수효과·의존성 없는 순수 모듈이다.
//
// 왜 이 파일이 필요한가(2026-08-03 실제 사고):
//   같은 아파트(롯데낙천대 관리사무소 앞)에 타는 두 학생이 등원 노선에서 **정차 2개로 갈라져** 보였다.
//   두 좌표의 차이는 위도 1.24e-5(약 1.4m) — 사람 눈에는 같은 지점이다.
//   원인은 병합 기준이 세 곳에서 제각각이었기 때문이다:
//     · shuttle-optimize   : `${lat.toFixed(4)},${lng.toFixed(4)}` 격자 키(약 11m)
//     · RouteSection       : EPS = 1e-5 축별 비교(약 1.1m)
//     · dispatchIncrement  : COORD_EPSILON = 1e-5 축별 비교(약 1.1m)
//   자동 제안으로 만들면 합쳐지고, 신규자를 손으로 배정하면 갈라지는 모순이 생겼다
//   (실제로 하원은 합쳐져 있고 등원만 갈라져 있었다).
//
// 격자 키(toFixed)를 쓰지 않는 이유:
//   격자는 **경계에 걸치면 1m 떨어진 두 점도 다른 칸**이 된다(37.60774 vs 37.60775 → 다른 키).
//   거리로 판정해야 "가까우면 같은 정차"라는 의도가 실제로 지켜진다.

/** 이 거리 이내면 같은 정차로 본다(미터). */
export const SAME_PLACE_METERS = 30;

export type LatLngLike = { lat?: unknown; lng?: unknown };

function num(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * 두 좌표 사이의 거리(미터). 정차 병합 판정용이라 등거리원통 근사로 충분하다
 * (수십 m 범위에서 haversine과 오차가 무시할 수준이고 훨씬 가볍다).
 */
export function distanceMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000;
  const toR = (d: number) => (d * Math.PI) / 180;
  const lat = toR((aLat + bLat) / 2);
  const dLat = toR(bLat - aLat);
  const dLng = toR(bLng - aLng) * Math.cos(lat);
  return Math.hypot(dLat, dLng) * R;
}

/** 두 좌표가 "같은 장소"인가. 좌표가 하나라도 없으면 판정 불가로 보고 false. */
export function isSamePlace(
  aLat: unknown, aLng: unknown, bLat: unknown, bLng: unknown,
  withinMeters: number = SAME_PLACE_METERS,
): boolean {
  const a1 = num(aLat), a2 = num(aLng), b1 = num(bLat), b2 = num(bLng);
  if (a1 == null || a2 == null || b1 == null || b2 == null) return false;
  return distanceMeters(a1, a2, b1, b2) <= withinMeters;
}

/**
 * stops 중 (lat,lng)와 같은 장소인 정차의 인덱스. 없으면 -1.
 * 여러 개가 걸리면 **가장 가까운** 것을 고른다(가장 자연스러운 병합 대상).
 */
export function findSamePlaceIndex(
  stops: readonly LatLngLike[],
  lat: unknown, lng: unknown,
  withinMeters: number = SAME_PLACE_METERS,
): number {
  const p1 = num(lat), p2 = num(lng);
  if (p1 == null || p2 == null) return -1;
  let best = -1, bestD = Infinity;
  for (let i = 0; i < stops.length; i++) {
    const s1 = num(stops[i]?.lat), s2 = num(stops[i]?.lng);
    if (s1 == null || s2 == null) continue;
    const d = distanceMeters(p1, p2, s1, s2);
    if (d <= withinMeters && d < bestD) { best = i; bestD = d; }
  }
  return best;
}
