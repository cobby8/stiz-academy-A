// 요일 유틸 — 서버(shuttle-optimize)와 클라이언트(DispatchClient) 양쪽에서 쓰는 순수 모듈.
// (prisma 등 서버 전용 의존성을 넣지 말 것 — 클라이언트 번들에 새면 안 된다.)

export const WEEKDAY_KO = ["일", "월", "화", "수", "목", "금", "토"];

// 'YYYY-MM-DD'의 요일(0=일 … 6=토). 서버 타임존과 무관하게 그 달력 날짜의 요일을 준다.
export function weekdayIndex(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y || 1970, (m || 1) - 1, d || 1)).getUTCDay();
}

// 요일별 관리: 어떤 날짜든 그 요일의 '대표 날짜'(운행일 목록 중 같은 요일의 첫 날)로 접는다.
// 노선은 대표 날짜 한 곳에만 저장/조회하므로, 같은 요일이면 모두 같은 노선을 본다.
export function firstDateOfSameWeekday(dates: { date: string }[], target: string): string {
  const wd = weekdayIndex(target);
  const same = dates.map((x) => x.date).filter((x) => weekdayIndex(x) === wd).sort();
  return same[0] ?? target;
}

// 운행일 목록에서 (요일 오름차순, 월→토) 유니크 요일 + 대표 날짜를 뽑는다.
export function weekdayOptions(dates: { date: string; label?: string }[]): { weekday: number; label: string; canonicalDate: string }[] {
  const map = new Map<number, string>(); // weekday → 대표(첫) 날짜
  for (const d of [...dates].sort((a, b) => a.date.localeCompare(b.date))) {
    const wd = weekdayIndex(d.date);
    if (!map.has(wd)) map.set(wd, d.date);
  }
  // 월(1)~토(6)~일(0) 순으로 보이도록 정렬(월요일부터).
  const order = (wd: number) => (wd === 0 ? 7 : wd);
  return [...map.entries()]
    .map(([weekday, canonicalDate]) => ({ weekday, label: `${WEEKDAY_KO[weekday]}요일`, canonicalDate }))
    .sort((a, b) => order(a.weekday) - order(b.weekday));
}
