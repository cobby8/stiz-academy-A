import { google } from "googleapis";
// @ts-expect-error -- Node 타입 제거 기반 단위 테스트는 런타임 확장자를 요구한다.
import { parseGoogleServiceAccount } from "./googleServiceAccount.ts";

const DEFAULT_SPREADSHEET_ID = "12xfQWT6OYa0hH2Ajei7E48CF2aUh6vZ8WWeFeocZrzY";
const REGISTRATION_SHEET = "등록";
const CHANGE_LOG_SHEET = "변동내역메모";

type SheetIdentity = {
  commandId: string;
  studentName: string;
  birthDate: Date;
  parentPhone: string | null;
  targetMonth: string;
  kind: "PAUSE" | "WITHDRAW";
};

function digits(value: unknown) {
  return String(value ?? "").replace(/\D/g, "");
}

function monthLabel(value: string) {
  const [year, month] = value.split("-").map(Number);
  return `${year}년 ${month}월`;
}

function birthKey(value: unknown) {
  const parts = String(value ?? "").match(/\d+/g) || [];
  if (parts.length < 3) return "";
  return `${parts[0]}-${String(Number(parts[1])).padStart(2, "0")}-${String(Number(parts[2])).padStart(2, "0")}`;
}

export function findSheetEnrollmentRows(rows: unknown[][], input: Pick<SheetIdentity, "studentName" | "birthDate" | "parentPhone" | "targetMonth">) {
  const expectedBirth = input.birthDate.toISOString().slice(0, 10);
  const expectedPhone = digits(input.parentPhone);
  const expectedMonth = monthLabel(input.targetMonth);
  const matches: number[] = [];
  for (let index = 1; index < rows.length; index += 1) {
    const row = rows[index] || [];
    if (String(row[3] || "").trim() !== input.studentName || String(row[7] || "").trim() !== expectedMonth) continue;
    const birthMatches = birthKey(row[24]) === expectedBirth;
    const phoneMatches = expectedPhone.length >= 8 && digits(row[27]).endsWith(expectedPhone.slice(-8));
    if (birthMatches || phoneMatches) matches.push(index + 1);
  }
  return matches;
}

function sheetsClient() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY가 없어 구글 시트 자동 반영을 사용할 수 없습니다.");
  const credentials = parseGoogleServiceAccount(raw);
  const auth = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

export async function applySheetEnrollmentStatus(input: SheetIdentity) {
  const sheets = sheetsClient();
  const spreadsheetId = process.env.STIZ_STUDENT_SPREADSHEET_ID || DEFAULT_SPREADSHEET_ID;
  const [registration, logs] = await Promise.all([
    sheets.spreadsheets.values.get({ spreadsheetId, range: `'${REGISTRATION_SHEET}'!A1:AL3000` }),
    sheets.spreadsheets.values.get({ spreadsheetId, range: `'${CHANGE_LOG_SHEET}'!A1:G2000` }),
  ]);
  const rows = registration.data.values || [];
  const expectedMonth = monthLabel(input.targetMonth);
  const targetValue = input.kind === "PAUSE" ? "휴원" : "퇴원";
  const matches = findSheetEnrollmentRows(rows, input);
  if (matches.length === 0) throw new Error("등록 시트에서 이름·적용 월·생년월일/전화가 일치하는 행을 찾지 못했습니다.");

  const requests = matches
    .filter((rowNumber) => String(rows[rowNumber - 1]?.[8] || "").trim() !== targetValue)
    .map((rowNumber) => ({ range: `'${REGISTRATION_SHEET}'!I${rowNumber}`, values: [[targetValue]] }));
  if (requests.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: { valueInputOption: "USER_ENTERED", data: requests },
    });
  }

  const marker = `STIZ_SYNC:${input.commandId}`;
  const alreadyLogged = (logs.data.values || []).some((row) => String(row[6] || "").includes(marker));
  if (!alreadyLogged) {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `'${CHANGE_LOG_SHEET}'!A:G`,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [[new Date().toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" }), `${input.studentName} ${expectedMonth} ${targetValue}`, "반영", "미반영", "해당없음", "", marker]] },
    });
  }

  const verify = await sheets.spreadsheets.values.batchGet({
    spreadsheetId,
    ranges: matches.map((rowNumber) => `'${REGISTRATION_SHEET}'!I${rowNumber}`),
  });
  const verified = (verify.data.valueRanges || []).every((range) => String(range.values?.[0]?.[0] || "").trim() === targetValue);
  if (!verified) throw new Error("시트 저장 후 재조회 값이 일치하지 않습니다.");
  return { spreadsheetId, rows: matches, value: targetValue };
}
