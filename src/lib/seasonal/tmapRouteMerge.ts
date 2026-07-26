// T맵 실도로 경로 병합 규칙(순수 함수, 외부 의존성 없음 → 단위 테스트 대상).
//
// 왜 분리했나: planRun이 진입 즉시 저장된 실도로 경로를 지운 뒤 T맵으로 다시 채우다가,
// 증분 재배차 중 T맵이 일시 실패하면 경로가 사라져 지도가 "직선 추정"으로 퇴화하는 버그가 있었다.
// "T맵 성공 시에만 갱신 / 실패 시 이전값 유지"라는 판정만 이 순수 함수로 떼어내 회귀를 테스트로 못박는다.

export type RunRouteFields = {
  provider: "TMAP" | "LOCAL";
  tmapMinutes: number | null;
  tmapKm: number | null;
  path?: { lat: number; lng: number }[];
};

// - next.ok(성공): 새 실도로 경로/시간으로 갱신(provider="TMAP").
// - next.ok=false(실패): prev를 그대로 유지 → 저장돼 있던 실도로 경로가 사라지지 않는다.
//   prev가 애초에 LOCAL/무path였다면(신규 run) 종전처럼 LOCAL/무path가 유지된다.
export function mergeTmapRoute(
  prev: RunRouteFields,
  next:
    | { ok: true; tmapMinutes: number | null; tmapKm: number | null; path?: { lat: number; lng: number }[] }
    | { ok: false },
): RunRouteFields {
  if (next.ok) {
    return { provider: "TMAP", tmapMinutes: next.tmapMinutes, tmapKm: next.tmapKm, path: next.path };
  }
  // 실패 → 이전값(실도로 경로 포함) 그대로 보존.
  return { provider: prev.provider, tmapMinutes: prev.tmapMinutes, tmapKm: prev.tmapKm, path: prev.path };
}
