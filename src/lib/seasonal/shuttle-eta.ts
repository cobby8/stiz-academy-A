// 셔틀 정차별 ETA 누적 계산(순수 함수, 외부 의존성 없음 → 단위 테스트 대상).
//
// 왜 분리했나: planRun(shuttle-optimize.ts)은 prisma·requireAdmin 등 서버 의존성을 import하므로
// node --test 에서 그대로 불러오면 DB/환경변수까지 끌려와 실행이 어렵다.
// "구간 실제시간 → 방향별 stop ETA 누적" 판정만 이 순수 모듈로 떼어내 회귀를 테스트로 못박는다.

export type DispatchDirection = "PICKUP" | "DROPOFF";

// 구간별 실도로 시간(초, 실패 구간은 null)을 '분'으로 바꾼다.
// - 성공 구간 = 실측 시간(초/60).
// - 실패(null·0 이하) 구간 = 그 구간의 segMin 추정(fallbackMin[i])으로 대체 → ETA가 비지 않는다.
// segSeconds.length 와 fallbackMin.length 는 같아야 한다(둘 다 정차수+1).
export function segmentMinutes(segSeconds: (number | null)[], fallbackMin: number[]): number[] {
  return segSeconds.map((sec, i) =>
    sec != null && sec > 0 ? sec / 60 : (fallbackMin[i] ?? 0),
  );
}

// 구간 이동시간(분) 배열로 각 노드의 시각(자정 기준 분)을 누적 계산한다.
// 노드 수 = 구간 수 + 1 = [출발, ...정차, 도착].
// - PICKUP(등원): 학원 '도착' 시각(anchorMin)을 기준으로 뒤에서 앞으로 역산.
// - DROPOFF(하원): 학원 '출발' 시각(anchorMin)을 기준으로 앞에서 뒤로 순방향.
export function nodeTimesFromSegments(segMinutes: number[], direction: DispatchDirection, anchorMin: number): number[] {
  const n = segMinutes.length + 1;
  const times = new Array<number>(n).fill(0);
  if (direction === "PICKUP") {
    times[n - 1] = anchorMin; // 마지막 노드(학원) 도착 시각
    for (let i = n - 2; i >= 0; i--) times[i] = times[i + 1] - segMinutes[i];
  } else {
    times[0] = anchorMin; // 첫 노드(학원) 출발 시각
    for (let i = 1; i < n; i++) times[i] = times[i - 1] + segMinutes[i - 1];
  }
  return times;
}
