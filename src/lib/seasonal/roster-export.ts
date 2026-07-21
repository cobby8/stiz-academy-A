const UTF8_BOM = "\uFEFF";
const CRLF = "\r\n";

export type CsvCellValue = string | number | boolean | null | undefined;

export type CsvColumn<Row, Key extends keyof Row = keyof Row> = Readonly<{
  key: Key;
  header: string;
}>;

/** 화면에서 전화번호의 앞/뒤 식별 정보만 남깁니다. */
export function maskPhoneNumber(value: string | null | undefined): string {
  if (!value) return "";

  const digits = value.replace(/\D/g, "");
  if (digits.length < 7) return "****";

  return `${digits.slice(0, 3)}-****-${digits.slice(-4)}`;
}

/**
 * Excel 수식 실행과 제어문자 오염을 막고, 셀 내부 줄바꿈을 CRLF로 통일합니다.
 */
export function sanitizeCsvCell(value: CsvCellValue): string {
  if (value === null || value === undefined) return "";

  const original = String(value);
  const hasFormulaPrefix = /^[\s]*[=+\-@]/.test(original)
    || /^[\t\r]/.test(original);

  const normalized = original
    .replace(/\r\n|\r|\n/g, "\n")
    // 줄바꿈은 보존하고, NUL을 포함한 나머지 C0 제어문자는 제거합니다.
    .replace(/[\u0000-\u0009\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\n/g, CRLF);

  return hasFormulaPrefix ? `'${normalized}` : normalized;
}

/** RFC 4180 규칙에 맞게 하나의 CSV 필드를 이스케이프합니다. */
export function escapeCsvField(value: CsvCellValue): string {
  const sanitized = sanitizeCsvCell(value);
  if (!/[",\r\n]/.test(sanitized)) return sanitized;

  return `"${sanitized.replace(/"/g, '""')}"`;
}

/**
 * columns에 선언된 키만 내보냅니다. 행 객체의 나머지 값은 CSV에 포함되지 않습니다.
 */
export function createCsv<Row extends Record<string, CsvCellValue>>(
  columns: readonly CsvColumn<Row>[],
  rows: readonly Row[],
): string {
  const header = columns.map((column) => escapeCsvField(column.header)).join(",");
  const body = rows.map((row) => (
    columns.map((column) => escapeCsvField(row[column.key])).join(",")
  ));

  return `${UTF8_BOM}${[header, ...body].join(CRLF)}${CRLF}`;
}

/** Windows/macOS에서 모두 안전한 CSV 파일명을 만듭니다. */
export function createSafeCsvFilename(name: string): string {
  const withoutExtension = name.replace(/\.csv$/i, "");
  const safeBase = withoutExtension
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_")
    .replace(/\s+/g, " ")
    .replace(/[. ]+$/g, "")
    .trim();

  return `${safeBase || "특강명단"}.csv`;
}
