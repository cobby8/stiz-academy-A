/**
 * POST /api/admin/parse-excel
 *
 * 엑셀 원장 파일을 읽어 학생 데이터 JSON으로 변환한다.
 * 업로드된 .xlsx/.xls 파일을 SheetJS로 파싱하고, 정해진 컬럼 순서에 따라 학생 정보를 추출한다.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import * as XLSX from "xlsx";

/** 엑셀에서 파싱한 학생 1명의 데이터 */
export interface ParsedStudent {
  rowNumber: number; // 엑셀 원본 행 번호
  name: string; // 학생명, A열
  managementName: string | null; // 관리용 이름, B열
  className: string | null; // 클래스명, C열
  phone: string | null; // 학생 휴대폰, D열
  guardian1Relation: string | null; // 보호자 관계, E열
  guardian1Phone: string | null; // 보호자 번호, F열
  guardian2Relation: string | null; // 추가 보호자 관계, G열
  guardian2Phone: string | null; // 추가 보호자 번호, H열
  guardian3Relation: string | null; // 추가 보호자 관계, I열
  guardian3Phone: string | null; // 추가 보호자 번호, J열
  school: string | null; // 학교, K열
  grade: string | null; // 학년, L열
  gender: string | null; // "MALE" | "FEMALE" | null
  address: string | null; // 주소, N열
  enrollDate: string | null; // 입회일 ISO 문자열, O열
  paymentDate: string | null; // 수강료 납부일 ISO 문자열, P열
  birthDate: string | null; // 생년월일 ISO 문자열, Q열
  memo: string | null; // 메모, R열
}

interface ParseError {
  rowNumber: number;
  reason: string;
}

interface ParseExcelResponse {
  students: ParsedStudent[];
  errors: ParseError[];
  totalRows: number;
}

function cellToString(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  return String(value).trim();
}

function convertGender(raw: string | null): string | null {
  if (!raw) return null;
  const normalized = raw.trim();
  if (normalized === "남" || normalized === "남자") return "MALE";
  if (normalized === "여" || normalized === "여자") return "FEMALE";
  return null;
}

function parseDate(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;

  if (value instanceof Date) {
    if (isNaN(value.getTime())) return null;
    return value.toISOString();
  }

  if (typeof value === "number") {
    const date = XLSX.SSF.parse_date_code(value);
    if (date) {
      const jsDate = new Date(date.y, date.m - 1, date.d);
      if (!isNaN(jsDate.getTime())) return jsDate.toISOString();
    }
    return null;
  }

  const str = String(value).trim();
  if (!str) return null;

  if (/^\d{8}$/.test(str)) {
    const y = str.slice(0, 4);
    const m = str.slice(4, 6);
    const d = str.slice(6, 8);
    const date = new Date(`${y}-${m}-${d}T00:00:00`);
    if (!isNaN(date.getTime())) return date.toISOString();
  }

  const normalized = str.replace(/[./]/g, "-");
  const date = new Date(`${normalized}T00:00:00`);
  if (!isNaN(date.getTime())) return date.toISOString();

  return null;
}

function buildMemo(
  managementName: string | null,
  rawMemo: string | null
): string | null {
  const parts: string[] = [];
  if (managementName) parts.push(`[관리명: ${managementName}]`);
  if (rawMemo) parts.push(rawMemo);
  return parts.length > 0 ? parts.join("\n") : null;
}

function buildGuardiansJSON(
  g2Relation: string | null,
  g2Phone: string | null,
  g3Relation: string | null,
  g3Phone: string | null
): string | null {
  const guardians: { relation: string; phone: string }[] = [];

  if (g2Relation || g2Phone) {
    guardians.push({
      relation: g2Relation || "보호자",
      phone: g2Phone || "",
    });
  }

  if (g3Relation || g3Phone) {
    guardians.push({
      relation: g3Relation || "보호자",
      phone: g3Phone || "",
    });
  }

  return guardians.length > 0 ? JSON.stringify(guardians) : null;
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "파일이 전송되지 않았습니다." },
        { status: 400 }
      );
    }

    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith(".xlsx") && !fileName.endsWith(".xls")) {
      return NextResponse.json(
        { error: "엑셀 파일(.xlsx, .xls)만 업로드할 수 있습니다." },
        { status: 400 }
      );
    }

    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "파일 크기가 10MB를 초과합니다." },
        { status: 400 }
      );
    }

    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, {
      type: "array",
      cellDates: true,
    });

    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return NextResponse.json(
        { error: "엑셀 파일에 시트가 없습니다." },
        { status: 400 }
      );
    }

    const sheet = workbook.Sheets[sheetName];
    const rawRows: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: null,
      blankrows: false,
    });

    if (rawRows.length === 0) {
      return NextResponse.json(
        { error: "엑셀 파일에 데이터가 없습니다." },
        { status: 400 }
      );
    }

    const dataRows = rawRows.slice(1);
    const students: ParsedStudent[] = [];
    const errors: ParseError[] = [];

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const rowNumber = i + 2;

      try {
        const name = cellToString(row[0]);
        if (!name) continue;

        const managementName = cellToString(row[1]);
        const className = cellToString(row[2]);
        const phone = cellToString(row[3]);
        const guardian1Relation = cellToString(row[4]);
        const guardian1Phone = cellToString(row[5]);
        const guardian2Relation = cellToString(row[6]);
        const guardian2Phone = cellToString(row[7]);
        const guardian3Relation = cellToString(row[8]);
        const guardian3Phone = cellToString(row[9]);
        const school = cellToString(row[10]);
        const grade = cellToString(row[11]);
        const genderRaw = cellToString(row[12]);
        const address = cellToString(row[13]);
        const enrollDateRaw = row[14];
        const paymentDateRaw = row[15];
        const birthDateRaw = row[16];
        const rawMemo = cellToString(row[17]);

        const gender = convertGender(genderRaw);
        const enrollDate = parseDate(enrollDateRaw);
        const paymentDate = parseDate(paymentDateRaw);
        const birthDate = parseDate(birthDateRaw);
        const memo = buildMemo(managementName, rawMemo);

        students.push({
          rowNumber,
          name,
          managementName,
          className,
          phone,
          guardian1Relation,
          guardian1Phone,
          guardian2Relation,
          guardian2Phone,
          guardian3Relation,
          guardian3Phone,
          school,
          grade,
          gender,
          address,
          enrollDate,
          paymentDate,
          birthDate,
          memo,
        });
      } catch (err) {
        errors.push({
          rowNumber,
          reason:
            err instanceof Error
              ? err.message
              : "알 수 없는 오류로 파싱에 실패했습니다.",
        });
      }
    }

    const response: ParseExcelResponse = {
      students,
      errors,
      totalRows: dataRows.length,
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error("[parse-excel] 엑셀 파싱 실패:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? `엑셀 파일 처리 중 오류: ${err.message}`
            : "엑셀 파일 처리 중 알 수 없는 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}
