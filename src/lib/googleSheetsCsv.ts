export interface FetchedSheetCsv {
  sheetName: string;
  csvText: string;
}

export interface FetchedStudentOperationSheets {
  spreadsheetId: string;
  sourceUrl: string;
  csvSheets: Record<string, string>;
  fetchedSheets: string[];
  skippedSheets: { sheetName: string; reason: string }[];
}

const STUDENT_OPERATION_SHEET_NAMES = [
  "등록",
  "변동내역메모",
  "대표팀 명단",
  "1월차량",
  "2월차량",
  "3월차량",
  "4월차량",
  "5월차량",
  "6월차량",
  "7월차량",
  "8월차량",
  "9월차량",
  "10월차량",
  "11월차량",
  "12월차량",
];

export function extractSpreadsheetId(sheetUrl: string): string | null {
  const directId = sheetUrl.trim().match(/^[a-zA-Z0-9_-]{20,}$/)?.[0];
  if (directId) return directId;

  const idMatch = sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  return idMatch?.[1] ?? null;
}

function buildNamedSheetCsvUrl(spreadsheetId: string, sheetName: string): string {
  const params = new URLSearchParams({
    tqx: "out:csv",
    sheet: sheetName,
  });
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?${params.toString()}`;
}

async function fetchNamedSheetCsv(
  spreadsheetId: string,
  sheetName: string
): Promise<FetchedSheetCsv> {
  const url = buildNamedSheetCsvUrl(spreadsheetId, sheetName);
  const res = await fetch(url, { cache: "no-store" });
  const body = await res.text();

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  if (/^\s*</.test(body) || body.includes("google.visualization.Query.setResponse")) {
    throw new Error("CSV 형식으로 읽지 못했습니다.");
  }

  return { sheetName, csvText: body };
}

export async function fetchStudentOperationSheets(
  sheetUrl: string
): Promise<FetchedStudentOperationSheets> {
  const spreadsheetId = extractSpreadsheetId(sheetUrl);
  if (!spreadsheetId) {
    throw new Error("구글시트 URL에서 spreadsheet ID를 찾지 못했습니다.");
  }

  const csvSheets: Record<string, string> = {};
  const fetchedSheets: string[] = [];
  const skippedSheets: { sheetName: string; reason: string }[] = [];

  await Promise.all(
    STUDENT_OPERATION_SHEET_NAMES.map(async (sheetName) => {
      try {
        const sheet = await fetchNamedSheetCsv(spreadsheetId, sheetName);
        if (sheet.csvText.trim()) {
          csvSheets[sheet.sheetName] = sheet.csvText;
          fetchedSheets.push(sheet.sheetName);
        }
      } catch (err) {
        skippedSheets.push({
          sheetName,
          reason: err instanceof Error ? err.message : "시트 읽기 실패",
        });
      }
    })
  );

  if (!csvSheets["등록"]) {
    throw new Error("구글시트에서 등록 탭을 읽지 못했습니다. 공유 권한 또는 탭 이름을 확인해주세요.");
  }

  return {
    spreadsheetId,
    sourceUrl: sheetUrl,
    csvSheets,
    fetchedSheets: fetchedSheets.sort(),
    skippedSheets: skippedSheets.sort((a, b) => a.sheetName.localeCompare(b.sheetName)),
  };
}
