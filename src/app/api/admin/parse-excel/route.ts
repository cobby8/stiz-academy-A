/**
 * 엑셀 파싱 API — 랠리즈 엑셀 파일을 JSON으로 변환
 *
 * POST /api/admin/parse-excel
 * - FormData로 .xlsx 파일을 받는다
 * - xlsx(SheetJS) 라이브러리로 서버에서 파싱한다
 * - 랠리즈 컬럼 매핑표에 따라 학생 데이터 JSON 배열로 변환한다
 * - 응답: { students: [...], errors: [...] }
 */

import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";

// ──────────────────────────────────────────────
// 타입 정의
// ──────────────────────────────────────────────

/** 파싱된 학생 한 명의 데이터 */
export interface ParsedStudent {
  rowNumber: number; // 엑셀 원본 행 번호 (디버깅용)
  name: string; // 학생명 (A열)
  managementName: string | null; // 관리용이름 (B열)
  className: string | null; // 클래스명 (C열, 이번에는 저장 안 함)
  phone: string | null; // 학생 휴대폰번호 (D열)
  guardian1Relation: string | null; // 보호자1 관계 (E열)
  guardian1Phone: string | null; // 보호자1 번호 (F열)
  guardian2Relation: string | null; // 보호자2 관계 (G열)
  guardian2Phone: string | null; // 보호자2 번호 (H열)
  guardian3Relation: string | null; // 보호자3 관계 (I열)
  guardian3Phone: string | null; // 보호자3 번호 (J열)
  school: string | null; // 학교 (K열)
  grade: string | null; // 학년 (L열)
  gender: string | null; // 성별 — "MALE" | "FEMALE" | null (M열)
  address: string | null; // 주소 (N열)
  enrollDate: string | null; // 입회일자 ISO 문자열 (O열)
  paymentDate: string | null; // 수강료 납부일 (P열, 이번에는 저장 안 함)
  birthDate: string | null; // 생년월일 ISO 문자열 (Q열)
  memo: string | null; // 메모 (R열)
}

/** 파싱 중 오류가 발생한 행 정보 */
interface ParseError {
  rowNumber: number;
  reason: string;
}

/** API 응답 형태 */
interface ParseExcelResponse {
  students: ParsedStudent[];
  errors: ParseError[];
  totalRows: number;
}

// ──────────────────────────────────────────────
// 유틸 함수
// ──────────────────────────────────────────────

/**
 * 셀 값을 문자열로 안전하게 변환
 * - 빈 셀, undefined, null 모두 null 반환
 * - 숫자도 문자열로 변환 (전화번호 등)
 */
function cellToString(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  return String(value).trim();
}

/**
 * 성별 변환: 랠리즈 형식 -> DB 형식
 * - "남" 또는 "남자" -> "MALE"
 * - "여" 또는 "여자" -> "FEMALE"
 * - 그 외 -> null
 */
function convertGender(raw: string | null): string | null {
  if (!raw) return null;
  const normalized = raw.trim();
  if (normalized === "남" || normalized === "남자") return "MALE";
  if (normalized === "여" || normalized === "여자") return "FEMALE";
  return null;
}

/**
 * 날짜 파싱: 다양한 형식을 ISO 문자열로 변환
 *
 * xlsx 라이브러리는 엑셀 날짜를 JS Date 숫자(serial number)로 읽을 수 있다.
 * 하지만 텍스트로 저장된 날짜도 있으므로 여러 형식을 처리해야 한다.
 *
 * 지원 형식:
 * - 엑셀 시리얼 넘버 (예: 44927 -> 2023-01-01)
 * - "2023-01-01" (ISO)
 * - "2023.01.01" (점 구분)
 * - "2023/01/01" (슬래시 구분)
 * - "20230101" (8자리 숫자 문자열)
 */
function parseDate(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;

  // 1) 이미 Date 객체인 경우 (xlsx가 자동 변환했을 때)
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return null;
    return value.toISOString();
  }

  // 2) 숫자인 경우 — 엑셀 시리얼 넘버
  if (typeof value === "number") {
    // 엑셀 시리얼 넘버를 JS Date로 변환 (xlsx 유틸 사용)
    const date = XLSX.SSF.parse_date_code(value);
    if (date) {
      // parse_date_code는 { y, m, d, H, M, S } 객체를 반환
      const jsDate = new Date(date.y, date.m - 1, date.d);
      if (!isNaN(jsDate.getTime())) return jsDate.toISOString();
    }
    return null;
  }

  // 3) 문자열인 경우 — 여러 형식 시도
  const str = String(value).trim();
  if (!str) return null;

  // "20230101" 형태 (8자리 숫자)
  if (/^\d{8}$/.test(str)) {
    const y = str.slice(0, 4);
    const m = str.slice(4, 6);
    const d = str.slice(6, 8);
    const date = new Date(`${y}-${m}-${d}T00:00:00`);
    if (!isNaN(date.getTime())) return date.toISOString();
  }

  // "2023-01-01", "2023.01.01", "2023/01/01" 형태
  const normalized = str.replace(/[./]/g, "-");
  const date = new Date(`${normalized}T00:00:00`);
  if (!isNaN(date.getTime())) return date.toISOString();

  return null;
}

/**
 * 메모 조합: 관리용이름 + 기존 메모
 * - 관리용이름이 있으면 "[관리명: xxx]" 형태로 앞에 붙인다
 * - 둘 다 있으면 줄바꿈으로 구분
 */
function buildMemo(
  managementName: string | null,
  rawMemo: string | null
): string | null {
  const parts: string[] = [];
  if (managementName) parts.push(`[관리명: ${managementName}]`);
  if (rawMemo) parts.push(rawMemo);
  return parts.length > 0 ? parts.join("\n") : null;
}

/**
 * 보호자 JSON 배열 생성
 * - 보호자2, 3 정보가 하나라도 있으면 JSON 배열 문자열로 반환
 * - 모두 비어있으면 null
 */
function buildGuardiansJSON(
  g2Relation: string | null,
  g2Phone: string | null,
  g3Relation: string | null,
  g3Phone: string | null
): string | null {
  const guardians: { relation: string; phone: string }[] = [];

  // 보호자2: 관계 또는 전화번호 중 하나라도 있으면 추가
  if (g2Relation || g2Phone) {
    guardians.push({
      relation: g2Relation || "보호자2",
      phone: g2Phone || "",
    });
  }

  // 보호자3: 관계 또는 전화번호 중 하나라도 있으면 추가
  if (g3Relation || g3Phone) {
    guardians.push({
      relation: g3Relation || "보호자3",
      phone: g3Phone || "",
    });
  }

  return guardians.length > 0 ? JSON.stringify(guardians) : null;
}

// ──────────────────────────────────────────────
// 메인 핸들러
// ──────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    // 1) FormData에서 파일 추출
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "파일이 전송되지 않았습니다." },
        { status: 400 }
      );
    }

    // 파일 확장자 검증 — .xlsx, .xls만 허용
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith(".xlsx") && !fileName.endsWith(".xls")) {
      return NextResponse.json(
        { error: "엑셀 파일(.xlsx, .xls)만 업로드할 수 있습니다." },
        { status: 400 }
      );
    }

    // 파일 크기 제한 — 10MB
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "파일 크기가 10MB를 초과합니다." },
        { status: 400 }
      );
    }

    // 2) 파일을 ArrayBuffer로 읽어서 xlsx로 파싱
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, {
      type: "array",
      cellDates: true, // 날짜 셀을 JS Date 객체로 자동 변환
    });

    // 첫 번째 시트 사용 (랠리즈 엑셀은 보통 시트 1개)
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return NextResponse.json(
        { error: "엑셀 파일에 시트가 없습니다." },
        { status: 400 }
      );
    }

    const sheet = workbook.Sheets[sheetName];

    // 시트를 2차원 배열로 변환 (header 없이 raw 데이터)
    const rawRows: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
      header: 1, // 배열 형태로 반환 (객체가 아닌 [값, 값, ...])
      defval: null, // 빈 셀은 null
      blankrows: false, // 빈 행 건너뛰기
    });

    if (rawRows.length === 0) {
      return NextResponse.json(
        { error: "엑셀 파일에 데이터가 없습니다." },
        { status: 400 }
      );
    }

    // 3) 첫 행은 헤더이므로 건너뛰고, 데이터 행부터 파싱
    // 랠리즈 엑셀 컬럼 순서 (A~R):
    // A:학생명 B:관리용이름 C:클래스명 D:학생휴대폰 E:보호자1관계 F:보호자1번호
    // G:보호자2관계 H:보호자2번호 I:보호자3관계 J:보호자3번호
    // K:학교 L:학년 M:성별 N:주소 O:입회일자 P:수강료납부일 Q:생년월일 R:메모
    const dataRows = rawRows.slice(1); // 헤더 제외
    const students: ParsedStudent[] = [];
    const errors: ParseError[] = [];

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const rowNumber = i + 2; // 엑셀 기준 행 번호 (1행=헤더, 2행부터 데이터)

      try {
        // 학생명(A열)은 필수 — 없으면 빈 행으로 간주하고 건너뛴다
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

        // 성별 변환
        const gender = convertGender(genderRaw);

        // 날짜 파싱
        const enrollDate = parseDate(enrollDateRaw);
        const paymentDate = parseDate(paymentDateRaw);
        const birthDate = parseDate(birthDateRaw);

        // 메모 조합 (관리용이름 + 원본 메모)
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
        // 개별 행 파싱 오류 — 해당 행만 건너뛰고 오류 기록
        errors.push({
          rowNumber,
          reason:
            err instanceof Error
              ? err.message
              : "알 수 없는 오류로 파싱 실패",
        });
      }
    }

    // 4) 응답 반환
    const response: ParseExcelResponse = {
      students,
      errors,
      totalRows: dataRows.length,
    };

    return NextResponse.json(response);
  } catch (err) {
    // 전체 처리 실패 (파일 읽기 실패, xlsx 파싱 실패 등)
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
