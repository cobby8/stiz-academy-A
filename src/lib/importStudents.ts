/**
 * 구글 스프레드시트 수강생 CSV 데이터 파싱 및 변환 유틸리티
 *
 * 스프레드시트에서 복사한 CSV(탭 구분)를 파싱하여
 * 학부모(User), 학생(Student), 수강(Enrollment), 결제(Payment) 데이터로 변환한다.
 *
 * 핵심 로직:
 * 1. CSV 파싱 → 빈 행 제거
 * 2. 이름+학부모전화번호로 그룹핑 → 같은 학생 여러 행 중복 제거
 * 3. 각 그룹에서 최신 행(월 기준) 선택
 * 4. 2호점 데이터 우선 (1호점 폐점)
 * 5. 결제방법에서 상태/결제수단 분리
 * 6. 수업선택에서 교시 추출 → slotKey 변환
 */

// ──────────────────────────────────────────────
// 타입 정의
// ──────────────────────────────────────────────

/** CSV 원본 한 행의 데이터 (47개 컬럼 중 주요 컬럼만 추출) */
export interface RawCsvRow {
  rowNumber: number;         // CSV 원본 행 번호 (디버깅용)
  branch: string;            // 지점 (1호점/2호점)
  name: string;              // 학생 이름
  birthDate: string | null;  // 생년월일 ("2016. 8. 22" 형태)
  phone: string | null;      // 학생 전화번호
  parentName: string | null; // 학부모 이름
  parentPhone: string | null;// 학부모 전화번호
  school: string | null;     // 학교명
  grade: string | null;      // 학년
  address: string | null;    // 주소
  enrollDate: string | null; // 등록일
  paymentMethod: string | null; // 결제방법 (랠리즈/카드/휴원/퇴원 등 혼합)
  amount: number | null;     // 결제금액
  referralSource: string | null; // 가입경로
  uniformStatus: string | null;  // 유니폼 상태
  classSelections: string[];  // 수업선택 컬럼들 (요일별 교시)
  year: number | null;       // 연도
  month: number | null;      // 월
}

/** 변환된 학생 데이터 (DB 삽입 준비 완료) */
export interface TransformedStudent {
  // 학부모 정보
  parentName: string;
  parentPhone: string;

  // 학생 정보
  name: string;
  birthDate: Date | null;
  phone: string | null;
  school: string | null;
  grade: string | null;
  address: string | null;
  enrollDate: Date | null;
  referralSource: string | null;
  uniformStatus: string | null;

  // 수강 상태
  status: "ACTIVE" | "PAUSED" | "WITHDRAWN";

  // 결제 정보
  paymentMethod: "RALLYZ" | "CARD" | "CASH" | "UNPAID" | null;
  amount: number | null;
  year: number | null;
  month: number | null;

  // 수업 슬롯 키 목록 (예: ["Mon-4", "Wed-3"])
  slotKeys: string[];

  // 원본 행 번호 (디버깅용)
  rowNumber: number;
  branch: string;
}

/** 이관 미리보기 결과 */
export interface ImportPreviewResult {
  students: TransformedStudent[];
  summary: {
    totalRows: number;       // CSV 전체 행 수
    uniqueStudents: number;  // 중복 제거 후 학생 수
    activeCount: number;     // 재원 중
    pausedCount: number;     // 휴원
    withdrawnCount: number;  // 퇴원
    branch1Count: number;    // 1호점
    branch2Count: number;    // 2호점
  };
  errors: { rowNumber: number; reason: string }[];
}

// ──────────────────────────────────────────────
// 요일 매핑: 스프레드시트 컬럼 헤더 → slotKey 접두사
// ──────────────────────────────────────────────

// 스프레드시트의 수업선택 컬럼은 "[월요일]", "[화요일]" 등의 헤더를 가진다
// 각 셀에는 "4교시" 같은 값이 들어있다
// 이를 "Mon-4" 같은 slotKey로 변환한다
const DAY_MAP: Record<string, string> = {
  "월요일": "Mon",
  "화요일": "Tue",
  "수요일": "Wed",
  "목요일": "Thu",
  "금요일": "Fri",
  "토요일": "Sat",
  "일요일": "Sun",
};

// ──────────────────────────────────────────────
// CSV 파싱 함수
// ──────────────────────────────────────────────

/**
 * CSV 텍스트를 2차원 배열로 파싱
 * - 탭 구분자(\t) 또는 쉼표(,) 자동 감지
 * - 큰따옴표 안의 구분자는 무시
 */
function parseCsvText(csvText: string): string[][] {
  const lines = csvText.split(/\r?\n/);
  if (lines.length === 0) return [];

  // 첫 줄로 구분자 감지: 탭이 쉼표보다 많으면 탭 구분
  const firstLine = lines[0];
  const tabCount = (firstLine.match(/\t/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  const delimiter = tabCount >= commaCount ? "\t" : ",";

  return lines
    .filter((line) => line.trim() !== "") // 빈 줄 제거
    .map((line) => {
      // 간단한 CSV 파서: 큰따옴표 안의 구분자는 무시
      const cells: string[] = [];
      let current = "";
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          inQuotes = !inQuotes;
        } else if (ch === delimiter && !inQuotes) {
          cells.push(current.trim());
          current = "";
        } else {
          current += ch;
        }
      }
      cells.push(current.trim());
      return cells;
    });
}

/**
 * 스프레드시트 날짜 문자열을 Date 객체로 변환
 * 지원 형식: "2016. 8. 22", "2016.8.22", "2016-08-22", "2016/08/22"
 */
function parseSpreadsheetDate(raw: string | null): Date | null {
  if (!raw || raw.trim() === "") return null;

  const cleaned = raw.trim();

  // "2016. 8. 22" 형태 (스프레드시트 기본 형식)
  const spaceMatch = cleaned.match(/^(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})$/);
  if (spaceMatch) {
    const [, y, m, d] = spaceMatch;
    return new Date(Number(y), Number(m) - 1, Number(d));
  }

  // "2016.8.22" 또는 "2016-08-22" 또는 "2016/08/22"
  const normalMatch = cleaned.match(/^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})$/);
  if (normalMatch) {
    const [, y, m, d] = normalMatch;
    return new Date(Number(y), Number(m) - 1, Number(d));
  }

  // ISO 형태 시도
  const date = new Date(cleaned);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * 결제방법 문자열에서 수강 상태를 분리
 * - "휴원" → PAUSED
 * - "퇴원" → WITHDRAWN
 * - 나머지 (랠리즈, 카드결제, 현금영수증, 미결제, 추가수강 등) → ACTIVE
 */
function extractStatus(paymentMethod: string | null): "ACTIVE" | "PAUSED" | "WITHDRAWN" {
  if (!paymentMethod) return "ACTIVE";
  const trimmed = paymentMethod.trim();
  if (trimmed === "휴원") return "PAUSED";
  if (trimmed === "퇴원") return "WITHDRAWN";
  return "ACTIVE";
}

/**
 * 결제방법 문자열에서 결제수단을 분리
 * - "랠리즈" → RALLYZ
 * - "카드결제" → CARD
 * - "현금영수증" → CASH
 * - "미결제" → UNPAID
 * - "휴원", "퇴원", "추가수강", "이월" 등 → null (결제수단 아님)
 */
function extractPaymentMethod(
  paymentMethod: string | null
): "RALLYZ" | "CARD" | "CASH" | "UNPAID" | null {
  if (!paymentMethod) return null;
  const trimmed = paymentMethod.trim();
  if (trimmed === "랠리즈") return "RALLYZ";
  if (trimmed === "카드결제" || trimmed === "카드") return "CARD";
  if (trimmed === "현금영수증" || trimmed === "현금") return "CASH";
  if (trimmed === "미결제") return "UNPAID";
  // 휴원, 퇴원, 추가수강, 이월 등은 결제수단이 아님
  return null;
}

/**
 * 수업선택 셀에서 교시를 추출하여 slotKey 배열로 변환
 * - 입력: 요일별 컬럼 헤더와 셀 값의 쌍
 * - "4교시" → 숫자 4 추출
 * - 요일 + 교시번호 = "Mon-4" 형태의 slotKey
 */
function extractSlotKeys(
  dayHeaders: string[],
  dayValues: string[]
): string[] {
  const keys: string[] = [];

  for (let i = 0; i < dayHeaders.length; i++) {
    const header = dayHeaders[i] || "";
    const value = dayValues[i] || "";

    if (!value.trim()) continue;

    // 헤더에서 요일 추출: "[월요일]" → "월요일"
    const dayMatch = header.match(/\[?([월화수목금토일]요일)\]?/);
    if (!dayMatch) continue;

    const dayPrefix = DAY_MAP[dayMatch[1]];
    if (!dayPrefix) continue;

    // 셀 값에서 교시 번호 추출: "4교시" → 4
    const periodMatch = value.match(/(\d+)\s*교시/);
    if (periodMatch) {
      keys.push(`${dayPrefix}-${periodMatch[1]}`);
    }
  }

  return keys;
}

/**
 * 금액 문자열을 숫자로 변환
 * "150,000" → 150000, "150000" → 150000
 */
function parseAmount(raw: string | null): number | null {
  if (!raw || raw.trim() === "") return null;
  const cleaned = raw.replace(/[,\s원]/g, "");
  const num = Number(cleaned);
  return isNaN(num) ? null : num;
}

// ──────────────────────────────────────────────
// 메인 변환 함수
// ──────────────────────────────────────────────

/**
 * CSV 텍스트를 파싱하여 이관용 데이터로 변환
 *
 * 처리 흐름:
 * 1. CSV 텍스트 → 2차원 배열
 * 2. 헤더 행에서 컬럼 인덱스 매핑
 * 3. 각 데이터 행을 RawCsvRow로 변환
 * 4. 이름+학부모전화번호로 그룹핑 (같은 학생 중복 제거)
 * 5. 각 그룹에서 대표 행 선택 (2호점 우선, 최신 월 우선)
 * 6. TransformedStudent 배열 반환
 *
 * @param csvText - 스프레드시트에서 복사하거나 다운로드한 CSV 텍스트
 * @param columnMapping - 컬럼 이름 → 인덱스 매핑 (자동 감지 실패 시 수동 지정)
 */
export function parseAndTransformCsv(csvText: string): ImportPreviewResult {
  const rows = parseCsvText(csvText);
  if (rows.length < 2) {
    return {
      students: [],
      summary: {
        totalRows: 0,
        uniqueStudents: 0,
        activeCount: 0,
        pausedCount: 0,
        withdrawnCount: 0,
        branch1Count: 0,
        branch2Count: 0,
      },
      errors: [{ rowNumber: 0, reason: "데이터가 없거나 헤더만 있습니다." }],
    };
  }

  // 1단계: 헤더에서 컬럼 인덱스 자동 감지
  const headers = rows[0];
  const colIndex = detectColumnIndices(headers);
  const errors: { rowNumber: number; reason: string }[] = [];

  // 필수 컬럼 확인
  if (colIndex.name === -1) {
    return {
      students: [],
      summary: {
        totalRows: rows.length - 1,
        uniqueStudents: 0,
        activeCount: 0,
        pausedCount: 0,
        withdrawnCount: 0,
        branch1Count: 0,
        branch2Count: 0,
      },
      errors: [{ rowNumber: 1, reason: "이름 컬럼을 찾을 수 없습니다. 헤더를 확인해주세요." }],
    };
  }

  // 2단계: 데이터 행을 RawCsvRow로 변환
  const rawRows: RawCsvRow[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const rowNumber = i + 1; // 엑셀 기준 행번호

    try {
      const name = (row[colIndex.name] || "").trim();
      if (!name) continue; // 이름 없는 행은 건너뛰기

      rawRows.push({
        rowNumber,
        branch: (row[colIndex.branch] || "").trim(),
        name,
        birthDate: row[colIndex.birthDate] || null,
        phone: row[colIndex.phone] || null,
        parentName: row[colIndex.parentName] || null,
        parentPhone: row[colIndex.parentPhone] || null,
        school: row[colIndex.school] || null,
        grade: row[colIndex.grade] || null,
        address: row[colIndex.address] || null,
        enrollDate: row[colIndex.enrollDate] || null,
        paymentMethod: row[colIndex.paymentMethod] || null,
        amount: parseAmount(row[colIndex.amount] || null),
        referralSource: row[colIndex.referralSource] || null,
        uniformStatus: row[colIndex.uniformStatus] || null,
        classSelections: colIndex.dayColumns.map((idx) => row[idx] || ""),
        year: colIndex.year !== -1 ? Number(row[colIndex.year]) || null : null,
        month: colIndex.month !== -1 ? Number(row[colIndex.month]) || null : null,
      });
    } catch (err) {
      errors.push({
        rowNumber,
        reason: err instanceof Error ? err.message : "행 파싱 실패",
      });
    }
  }

  // 3단계: 이름+학부모전화번호로 그룹핑
  // 같은 학생이 월별로 여러 행에 등장하므로 최신 행만 선택
  const groupKey = (r: RawCsvRow) => {
    const pPhone = (r.parentPhone || "").replace(/[^0-9]/g, "");
    return `${r.name}__${pPhone}`;
  };

  const groups = new Map<string, RawCsvRow[]>();
  for (const raw of rawRows) {
    const key = groupKey(raw);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(raw);
  }

  // 4단계: 각 그룹에서 대표 행 선택
  // 우선순위: (1) 2호점 > 1호점 (1호점 폐점), (2) 최신 월
  const students: TransformedStudent[] = [];

  for (const [, group] of groups) {
    // 2호점 행이 있으면 2호점만 남기기
    const branch2 = group.filter((r) => r.branch.includes("2"));
    const candidates = branch2.length > 0 ? branch2 : group;

    // 최신 월 기준 정렬 (연도*12+월 내림차순)
    candidates.sort((a, b) => {
      const scoreA = (a.year || 0) * 12 + (a.month || 0);
      const scoreB = (b.year || 0) * 12 + (b.month || 0);
      return scoreB - scoreA;
    });

    const best = candidates[0];

    // 수업선택에서 slotKey 추출
    const dayHeaders = colIndex.dayColumns.map((idx) => headers[idx] || "");
    const slotKeys = extractSlotKeys(dayHeaders, best.classSelections);

    // 상태와 결제수단 분리
    const status = extractStatus(best.paymentMethod);
    const paymentMethodEnum = extractPaymentMethod(best.paymentMethod);

    // 학부모 이름/전화번호 기본값 처리
    const parentName = (best.parentName || "").trim() || best.name + " 보호자";
    const parentPhone = (best.parentPhone || "").replace(/[^0-9]/g, "");

    students.push({
      parentName,
      parentPhone: parentPhone || "00000000000",
      name: best.name,
      birthDate: parseSpreadsheetDate(best.birthDate),
      phone: best.phone?.trim() || null,
      school: best.school?.trim() || null,
      grade: best.grade?.trim() || null,
      address: best.address?.trim() || null,
      enrollDate: parseSpreadsheetDate(best.enrollDate),
      referralSource: best.referralSource?.trim() || null,
      uniformStatus: best.uniformStatus?.trim() || null,
      status,
      paymentMethod: paymentMethodEnum,
      amount: best.amount,
      year: best.year,
      month: best.month,
      slotKeys,
      rowNumber: best.rowNumber,
      branch: best.branch,
    });
  }

  // 요약 통계
  const summary = {
    totalRows: rawRows.length,
    uniqueStudents: students.length,
    activeCount: students.filter((s) => s.status === "ACTIVE").length,
    pausedCount: students.filter((s) => s.status === "PAUSED").length,
    withdrawnCount: students.filter((s) => s.status === "WITHDRAWN").length,
    branch1Count: students.filter((s) => s.branch.includes("1")).length,
    branch2Count: students.filter((s) => s.branch.includes("2")).length,
  };

  return { students, summary, errors };
}

// ──────────────────────────────────────────────
// 컬럼 인덱스 자동 감지
// ──────────────────────────────────────────────

interface ColumnIndices {
  branch: number;
  name: number;
  birthDate: number;
  phone: number;
  parentName: number;
  parentPhone: number;
  school: number;
  grade: number;
  address: number;
  enrollDate: number;
  paymentMethod: number;
  amount: number;
  referralSource: number;
  uniformStatus: number;
  year: number;
  month: number;
  dayColumns: number[]; // 요일별 수업선택 컬럼 인덱스들
}

/**
 * 헤더 행에서 각 컬럼의 인덱스를 자동 감지
 *
 * 스프레드시트의 컬럼 이름이 약간씩 다를 수 있으므로
 * 키워드 기반으로 유연하게 매칭한다.
 */
function detectColumnIndices(headers: string[]): ColumnIndices {
  const result: ColumnIndices = {
    branch: -1,
    name: -1,
    birthDate: -1,
    phone: -1,
    parentName: -1,
    parentPhone: -1,
    school: -1,
    grade: -1,
    address: -1,
    enrollDate: -1,
    paymentMethod: -1,
    amount: -1,
    referralSource: -1,
    uniformStatus: -1,
    year: -1,
    month: -1,
    dayColumns: [],
  };

  for (let i = 0; i < headers.length; i++) {
    const h = (headers[i] || "").trim();
    const lower = h.toLowerCase();

    // 지점
    if (h.includes("지점") || h.includes("호점") || lower.includes("branch")) {
      result.branch = i;
    }
    // 이름 (학생 이름) — "이름" 포함하되 "부모"/"보호자"/"학부모" 미포함
    else if (
      (h.includes("이름") || h.includes("성명") || lower === "name") &&
      !h.includes("부모") &&
      !h.includes("보호자") &&
      !h.includes("학부모")
    ) {
      if (result.name === -1) result.name = i; // 첫 번째 매칭만
    }
    // 생년월일
    else if (h.includes("생년월일") || h.includes("생일") || lower.includes("birth")) {
      result.birthDate = i;
    }
    // 학생 전화번호 — "전화" 포함하되 "부모"/"보호자" 미포함
    else if (
      (h.includes("전화") || h.includes("연락처") || h.includes("휴대폰")) &&
      !h.includes("부모") &&
      !h.includes("보호자") &&
      !h.includes("학부모")
    ) {
      if (result.phone === -1) result.phone = i;
    }
    // 학부모 이름
    else if (
      (h.includes("부모") || h.includes("보호자") || h.includes("학부모")) &&
      (h.includes("이름") || h.includes("성명"))
    ) {
      result.parentName = i;
    }
    // 학부모 전화번호
    else if (
      (h.includes("부모") || h.includes("보호자") || h.includes("학부모")) &&
      (h.includes("전화") || h.includes("연락처") || h.includes("번호"))
    ) {
      result.parentPhone = i;
    }
    // 학교
    else if (h.includes("학교") || lower.includes("school")) {
      result.school = i;
    }
    // 학년
    else if (h.includes("학년") || lower.includes("grade")) {
      result.grade = i;
    }
    // 주소
    else if (h.includes("주소") || lower.includes("address")) {
      result.address = i;
    }
    // 등록일/입회일
    else if (h.includes("등록일") || h.includes("입회일") || h.includes("가입일")) {
      result.enrollDate = i;
    }
    // 결제방법
    else if (h.includes("결제방법") || h.includes("결제수단") || h.includes("납부")) {
      result.paymentMethod = i;
    }
    // 금액
    else if (h.includes("금액") || h.includes("수강료") || h.includes("납부액")) {
      result.amount = i;
    }
    // 가입경로
    else if (h.includes("가입경로") || h.includes("유입경로") || h.includes("알게된")) {
      result.referralSource = i;
    }
    // 유니폼
    else if (h.includes("유니폼") || h.includes("복장")) {
      result.uniformStatus = i;
    }
    // 연도
    else if (h === "연도" || h === "년도" || lower === "year") {
      result.year = i;
    }
    // 월
    else if (h === "월" || lower === "month") {
      result.month = i;
    }
    // 수업선택 요일 컬럼: "[월요일]", "[화요일]" 등
    else if (/\[?[월화수목금토일]요일\]?/.test(h)) {
      result.dayColumns.push(i);
    }
  }

  return result;
}
