/**
 * ?묒? ?뚯떛 API ???좊━利??묒? ?뚯씪??JSON?쇰줈 蹂?? *
 * POST /api/admin/parse-excel
 * - FormData濡?.xlsx ?뚯씪??諛쏅뒗?? * - xlsx(SheetJS) ?쇱씠釉뚮윭由щ줈 ?쒕쾭?먯꽌 ?뚯떛?쒕떎
 * - ?좊━利?而щ읆 留ㅽ븨?쒖뿉 ?곕씪 ?숈깮 ?곗씠??JSON 諛곗뿴濡?蹂?섑븳?? * - ?묐떟: { students: [...], errors: [...] }
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import * as XLSX from "xlsx";

// ??????????????????????????????????????????????
// ????뺤쓽
// ??????????????????????????????????????????????

/** ?뚯떛???숈깮 ??紐낆쓽 ?곗씠??*/
export interface ParsedStudent {
  rowNumber: number; // ?묒? ?먮낯 ??踰덊샇 (?붾쾭源낆슜)
  name: string; // ?숈깮紐?(A??
  managementName: string | null; // 愿由ъ슜?대쫫 (B??
  className: string | null; // ?대옒?ㅻ챸 (C?? ?대쾲?먮뒗 ???????
  phone: string | null; // ?숈깮 ?대??곕쾲??(D??
  guardian1Relation: string | null; // 蹂댄샇?? 愿怨?(E??
  guardian1Phone: string | null; // 蹂댄샇?? 踰덊샇 (F??
  guardian2Relation: string | null; // 蹂댄샇?? 愿怨?(G??
  guardian2Phone: string | null; // 蹂댄샇?? 踰덊샇 (H??
  guardian3Relation: string | null; // 蹂댄샇?? 愿怨?(I??
  guardian3Phone: string | null; // 蹂댄샇?? 踰덊샇 (J??
  school: string | null; // ?숆탳 (K??
  grade: string | null; // ?숇뀈 (L??
  gender: string | null; // ?깅퀎 ??"MALE" | "FEMALE" | null (M??
  address: string | null; // 二쇱냼 (N??
  enrollDate: string | null; // ?낇쉶?쇱옄 ISO 臾몄옄??(O??
  paymentDate: string | null; // ?섍컯猷??⑸???(P?? ?대쾲?먮뒗 ???????
  birthDate: string | null; // ?앸뀈?붿씪 ISO 臾몄옄??(Q??
  memo: string | null; // 硫붾え (R??
}

/** ?뚯떛 以??ㅻ쪟媛 諛쒖깮?????뺣낫 */
interface ParseError {
  rowNumber: number;
  reason: string;
}

/** API ?묐떟 ?뺥깭 */
interface ParseExcelResponse {
  students: ParsedStudent[];
  errors: ParseError[];
  totalRows: number;
}

// ??????????????????????????????????????????????
// ?좏떥 ?⑥닔
// ??????????????????????????????????????????????

/**
 * ? 媛믪쓣 臾몄옄?대줈 ?덉쟾?섍쾶 蹂?? * - 鍮??, undefined, null 紐⑤몢 null 諛섑솚
 * - ?レ옄??臾몄옄?대줈 蹂??(?꾪솕踰덊샇 ??
 */
function cellToString(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  return String(value).trim();
}

/**
 * ?깅퀎 蹂?? ?좊━利??뺤떇 -> DB ?뺤떇
 * - "남" 또는 "남자" -> "MALE"
 * - "여" 또는 "여자" -> "FEMALE"
 * - 洹???-> null
 */
function convertGender(raw: string | null): string | null {
  if (!raw) return null;
  const normalized = raw.trim();
  if (normalized === "남" || normalized === "남자") return "MALE";
  if (normalized === "여" || normalized === "여자") return "FEMALE";
  return null;
}

/**
 * ?좎쭨 ?뚯떛: ?ㅼ뼇???뺤떇??ISO 臾몄옄?대줈 蹂?? *
 * xlsx ?쇱씠釉뚮윭由щ뒗 ?묒? ?좎쭨瑜?JS Date ?レ옄(serial number)濡??쎌쓣 ???덈떎.
 * ?섏?留??띿뒪?몃줈 ??λ맂 ?좎쭨???덉쑝誘濡??щ윭 ?뺤떇??泥섎━?댁빞 ?쒕떎.
 *
 * 吏???뺤떇:
 * - ?묒? ?쒕━???섎쾭 (?? 44927 -> 2023-01-01)
 * - "2023-01-01" (ISO)
 * - "2023.01.01" (??援щ텇)
 * - "2023/01/01" (?щ옒??援щ텇)
 * - "20230101" (8?먮━ ?レ옄 臾몄옄??
 */
function parseDate(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;

  // 1) ?대? Date 媛앹껜??寃쎌슦 (xlsx媛 ?먮룞 蹂?섑뻽????
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return null;
    return value.toISOString();
  }

  // 2) ?レ옄??寃쎌슦 ???묒? ?쒕━???섎쾭
  if (typeof value === "number") {
    // ?묒? ?쒕━???섎쾭瑜?JS Date濡?蹂??(xlsx ?좏떥 ?ъ슜)
    const date = XLSX.SSF.parse_date_code(value);
    if (date) {
      // parse_date_code??{ y, m, d, H, M, S } 媛앹껜瑜?諛섑솚
      const jsDate = new Date(date.y, date.m - 1, date.d);
      if (!isNaN(jsDate.getTime())) return jsDate.toISOString();
    }
    return null;
  }

  // 3) 臾몄옄?댁씤 寃쎌슦 ???щ윭 ?뺤떇 ?쒕룄
  const str = String(value).trim();
  if (!str) return null;

  // "20230101" ?뺥깭 (8?먮━ ?レ옄)
  if (/^\d{8}$/.test(str)) {
    const y = str.slice(0, 4);
    const m = str.slice(4, 6);
    const d = str.slice(6, 8);
    const date = new Date(`${y}-${m}-${d}T00:00:00`);
    if (!isNaN(date.getTime())) return date.toISOString();
  }

  // "2023-01-01", "2023.01.01", "2023/01/01" ?뺥깭
  const normalized = str.replace(/[./]/g, "-");
  const date = new Date(`${normalized}T00:00:00`);
  if (!isNaN(date.getTime())) return date.toISOString();

  return null;
}

/**
 * 硫붾え 議고빀: 愿由ъ슜?대쫫 + 湲곗〈 硫붾え
 * - 愿由ъ슜?대쫫???덉쑝硫?"[愿由щ챸: xxx]" ?뺥깭濡??욎뿉 遺숈씤?? * - ?????덉쑝硫?以꾨컮轅덉쑝濡?援щ텇
 */
function buildMemo(
  managementName: string | null,
  rawMemo: string | null
): string | null {
  const parts: string[] = [];
  if (managementName) parts.push(`[愿由щ챸: ${managementName}]`);
  if (rawMemo) parts.push(rawMemo);
  return parts.length > 0 ? parts.join("\n") : null;
}

/**
 * 蹂댄샇??JSON 諛곗뿴 ?앹꽦
 * - 蹂댄샇??, 3 ?뺣낫媛 ?섎굹?쇰룄 ?덉쑝硫?JSON 諛곗뿴 臾몄옄?대줈 諛섑솚
 * - 紐⑤몢 鍮꾩뼱?덉쑝硫?null
 */
function buildGuardiansJSON(
  g2Relation: string | null,
  g2Phone: string | null,
  g3Relation: string | null,
  g3Phone: string | null
): string | null {
  const guardians: { relation: string; phone: string }[] = [];

  // 蹂댄샇??: 愿怨??먮뒗 ?꾪솕踰덊샇 以??섎굹?쇰룄 ?덉쑝硫?異붽?
  if (g2Relation || g2Phone) {
    guardians.push({
      relation: g2Relation || "보호자",
      phone: g2Phone || "",
    });
  }

  // 蹂댄샇??: 愿怨??먮뒗 ?꾪솕踰덊샇 以??섎굹?쇰룄 ?덉쑝硫?異붽?
  if (g3Relation || g3Phone) {
    guardians.push({
      relation: g3Relation || "보호자",
      phone: g3Phone || "",
    });
  }

  return guardians.length > 0 ? JSON.stringify(guardians) : null;
}

// ??????????????????????????????????????????????
// 硫붿씤 ?몃뱾??// ??????????????????????????????????????????????

export async function POST(request: NextRequest) {
  // 관리자만 엑셀 파싱 가능
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  }

  try {
    // 1) FormData?먯꽌 ?뚯씪 異붿텧
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "파일이 전송되지 않았습니다." },
        { status: 400 }
      );
    }

    // ?뚯씪 ?뺤옣??寃利???.xlsx, .xls留??덉슜
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith(".xlsx") && !fileName.endsWith(".xls")) {
      return NextResponse.json(
        { error: "엑셀 파일(.xlsx, .xls)만 업로드할 수 있습니다." },
        { status: 400 }
      );
    }

    // ?뚯씪 ?ш린 ?쒗븳 ??10MB
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "파일 크기가 10MB를 초과합니다." },
        { status: 400 }
      );
    }

    // 2) ?뚯씪??ArrayBuffer濡??쎌뼱??xlsx濡??뚯떛
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, {
      type: "array",
      cellDates: true,
    });

    // 泥?踰덉㎏ ?쒗듃 ?ъ슜 (?좊━利??묒?? 蹂댄넻 ?쒗듃 1媛?
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return NextResponse.json(
        { error: "엑셀 파일에 시트가 없습니다." },
        { status: 400 }
      );
    }

    const sheet = workbook.Sheets[sheetName];

    // ?쒗듃瑜?2李⑥썝 諛곗뿴濡?蹂??(header ?놁씠 raw ?곗씠??
    const rawRows: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
      header: 1, // 諛곗뿴 ?뺥깭濡?諛섑솚 (媛앹껜媛 ?꾨땶 [媛? 媛? ...])
      defval: null, // 鍮??? null
      blankrows: false, // 鍮???嫄대꼫?곌린
    });

    if (rawRows.length === 0) {
      return NextResponse.json(
        { error: "엑셀 파일에 데이터가 없습니다." },
        { status: 400 }
      );
    }

    // 3) 泥??됱? ?ㅻ뜑?대?濡?嫄대꼫?곌퀬, ?곗씠???됰????뚯떛
    // ?좊━利??묒? 而щ읆 ?쒖꽌 (A~R):
    // A:?숈깮紐?B:愿由ъ슜?대쫫 C:?대옒?ㅻ챸 D:?숈깮?대???E:蹂댄샇??愿怨?F:蹂댄샇??踰덊샇
    // G:蹂댄샇??愿怨?H:蹂댄샇??踰덊샇 I:蹂댄샇??愿怨?J:蹂댄샇??踰덊샇
    // K:?숆탳 L:?숇뀈 M:?깅퀎 N:二쇱냼 O:?낇쉶?쇱옄 P:?섍컯猷뚮궔遺??Q:?앸뀈?붿씪 R:硫붾え
    const dataRows = rawRows.slice(1); // ?ㅻ뜑 ?쒖쇅
    const students: ParsedStudent[] = [];
    const errors: ParseError[] = [];

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const rowNumber = i + 2; // ?묒? 湲곗? ??踰덊샇 (1???ㅻ뜑, 2?됰????곗씠??

      try {
        // ?숈깮紐?A??? ?꾩닔 ???놁쑝硫?鍮??됱쑝濡?媛꾩＜?섍퀬 嫄대꼫?대떎
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

        // ?좎쭨 ?뚯떛
        const enrollDate = parseDate(enrollDateRaw);
        const paymentDate = parseDate(paymentDateRaw);
        const birthDate = parseDate(birthDateRaw);

        // 硫붾え 議고빀 (愿由ъ슜?대쫫 + ?먮낯 硫붾え)
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
        // 媛쒕퀎 ???뚯떛 ?ㅻ쪟 ???대떦 ?됰쭔 嫄대꼫?곌퀬 ?ㅻ쪟 湲곕줉
        errors.push({
          rowNumber,
          reason:
            err instanceof Error
              ? err.message
              : "알 수 없는 오류로 파싱에 실패했습니다.",
        });
      }
    }

    // 4) ?묐떟 諛섑솚
    const response: ParseExcelResponse = {
      students,
      errors,
      totalRows: dataRows.length,
    };

    return NextResponse.json(response);
  } catch (err) {
    // ?꾩껜 泥섎━ ?ㅽ뙣 (?뚯씪 ?쎄린 ?ㅽ뙣, xlsx ?뚯떛 ?ㅽ뙣 ??
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
