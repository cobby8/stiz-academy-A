// 정규 수업 운행리스트(구글 시트) 파서 — 순수 모듈(외부 의존성 0, 실행 테스트 가능).
// 시트 형식(컬럼): (빈칸)·수강생 이름·수강생 전화·학부모 전화·요일·수업시간·도착시간·목적지·비고(승차/하차/복귀)·메모
// 각 행 = 하루 타임라인의 정차 하나. '2호점'(학원) 경유 행은 반 교대 지점.

export type RegularShuttleStop = {
  weekday: number;          // 0=일 … 6=토 (월=1)
  weekdayLabel: string;     // '월'…'금'
  classTime: string | null; // '17:00~18:00' 등(2호점 경유 행은 없을 수 있음)
  arriveTime: string | null;// 'HH:MM' 정차 시각
  stopName: string;         // 목적지(정차 위치 이름)
  direction: "BOARD" | "ALIGHT" | "PIVOT" | "RETURN"; // 승차/하차/(하차·승차 동시=학원 경유)/복귀
  studentName: string | null;
  studentPhone: string | null;
  parentPhone: string | null;
  note: string | null;
  sortOrder: number;        // 요일 안에서 도착시간·행순 정렬용
  latitude?: number | null; // 정류장 좌표(지오코딩 후 채워짐)
  longitude?: number | null;
};

const WD: Record<string, number> = { "일": 0, "월": 1, "화": 2, "수": 3, "목": 4, "금": 5, "토": 6 };

// 따옴표·개행을 처리하는 CSV → 2차원 셀 배열 파서.
export function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  const s = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') { cell += '"'; i++; } else inQuotes = false;
      } else cell += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += c;
  }
  row.push(cell);
  if (row.length > 1 || row[0] !== "") rows.push(row);
  return rows;
}

function clean(v: string | undefined): string | null {
  const t = (v ?? "").trim();
  return t && t !== "없음" ? t : null;
}
function normTime(v: string | undefined): string | null {
  const t = (v ?? "").trim();
  const m = t.match(/^(\d{1,2}):(\d{2})$/);
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : null;
}
function normDirection(v: string | undefined): RegularShuttleStop["direction"] | null {
  const t = (v ?? "").replace(/\s/g, "");
  if (!t) return null;
  if (t.includes("하차") && t.includes("승차")) return "PIVOT"; // '하차 / 승차' = 학원 경유
  if (t.includes("복귀")) return "RETURN";
  if (t.includes("승차")) return "BOARD";
  if (t.includes("하차")) return "ALIGHT";
  return null;
}

// 시트 CSV → 정차 목록. 요일·목적지·방향이 있는 유효 행만 남긴다.
export function parseRegularShuttleSheet(csv: string): { title: string | null; stops: RegularShuttleStop[] } {
  const rows = parseCsvRows(csv);
  // 헤더 행(‘수강생 이름’ 포함) 찾기
  let headerIdx = rows.findIndex((r) => r.some((c) => c.includes("수강생") && c.includes("이름")));
  if (headerIdx < 0) headerIdx = 2;
  const title = rows.slice(0, headerIdx).flat().map((c) => c.trim()).find((c) => c.includes("운행리스트")) ?? null;

  const stops: RegularShuttleStop[] = [];
  let order = 0;
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    const weekdayRaw = (r[4] ?? "").trim();
    const weekday = WD[weekdayRaw];
    const stopName = clean(r[7]);
    const direction = normDirection(r[8]);
    if (weekday === undefined || !stopName || !direction) continue; // 유효 행만
    stops.push({
      weekday, weekdayLabel: weekdayRaw,
      classTime: clean(r[5]),
      arriveTime: normTime(r[6]),
      stopName,
      direction,
      studentName: clean(r[1]),
      studentPhone: clean(r[2]),
      parentPhone: clean(r[3]),
      note: clean(r[9]),
      sortOrder: order++,
    });
  }
  // 요일 안에서 도착시간(그다음 행순)으로 정렬해 sortOrder를 다시 매긴다.
  const byWd = new Map<number, RegularShuttleStop[]>();
  for (const s of stops) { const a = byWd.get(s.weekday) ?? []; a.push(s); byWd.set(s.weekday, a); }
  const out: RegularShuttleStop[] = [];
  for (const [, list] of [...byWd.entries()].sort((a, b) => a[0] - b[0])) {
    list.sort((a, b) => (a.arriveTime ?? "99:99").localeCompare(b.arriveTime ?? "99:99") || a.sortOrder - b.sortOrder);
    list.forEach((s, idx) => { s.sortOrder = idx; });
    out.push(...list);
  }
  return { title, stops: out };
}
