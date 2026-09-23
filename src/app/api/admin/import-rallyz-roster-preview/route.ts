import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { requireAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import {
  extractRallyzNonPaymentGrid,
  previewRallyzRoster,
} from "@/lib/rallyz-roster-preview.mjs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_ROWS = 5_000;
const MAX_COLUMNS = 100;

type RallyzPreviewResult = {
  rowCount: number;
  studentCount: number;
  enrollmentCount: number;
  heldRowCount: number;
  students: Array<{
    name: string;
    enrollments: Array<{ className: string; classMatched: boolean; sourceRows: number[] }>;
    siteMatch: {
      status: string;
      confidence: string | null;
      siteStudentId?: string;
      existingEnrollments: Array<{ classId: string; className: string; status: string }>;
    };
    [key: string]: unknown;
  }>;
};

function normalizeHeader(value: unknown) {
  return String(value ?? "").trim().replace(/[\s_()-]/g, "");
}

function cellText(cell: XLSX.CellObject | undefined) {
  if (!cell || cell.v === undefined || cell.v === null || cell.v === "") return "";
  if (cell.v instanceof Date) {
    const year = cell.v.getUTCFullYear();
    const month = String(cell.v.getUTCMonth() + 1).padStart(2, "0");
    const day = String(cell.v.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  return String(cell.w ?? cell.v).trim();
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "엑셀 파일을 선택해주세요." }, { status: 400 });
    }
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      return NextResponse.json({ error: "Rallyz 학생목록 .xlsx 파일만 지원합니다." }, { status: 400 });
    }
    if (file.size <= 0 || file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "파일은 1바이트 이상 10MB 이하여야 합니다." }, { status: 400 });
    }

    const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
    const firstSheetName = workbook.SheetNames[0];
    const sheet = firstSheetName ? workbook.Sheets[firstSheetName] : null;
    if (!sheet?.["!ref"]) {
      return NextResponse.json({ error: "첫 번째 시트에 데이터가 없습니다." }, { status: 400 });
    }

    const range = XLSX.utils.decode_range(sheet["!ref"]);
    const rowCount = range.e.r - range.s.r + 1;
    const columnCount = range.e.c - range.s.c + 1;
    if (range.s.r !== 0 || range.s.c !== 0) {
      return NextResponse.json({ error: "첫 셀부터 시작하는 Rallyz 학생목록 형식인지 확인해주세요." }, { status: 400 });
    }
    if (rowCount > MAX_ROWS || columnCount > MAX_COLUMNS) {
      return NextResponse.json({ error: "파일의 행 또는 열이 허용 한도를 초과했습니다." }, { status: 400 });
    }

    const headers = Array.from({ length: columnCount }, (_, column) =>
      cellText(sheet[XLSX.utils.encode_cell({ r: 0, c: column })])
    );
    const headerKeys = new Set(headers.map(normalizeHeader));
    if (!headerKeys.has("학생명") || !headerKeys.has("클래스명")) {
      return NextResponse.json({ error: "학생명과 클래스명이 포함된 Rallyz 학생목록 파일인지 확인해주세요." }, { status: 400 });
    }

    // 결제 및 불필요 개인정보 셀은 SheetJS worksheet에서 값 자체를 읽지 않는다.
    const grid = extractRallyzNonPaymentGrid(headers, rowCount, (rowIndex: number, column: number) => {
      const address = XLSX.utils.encode_cell({ r: rowIndex, c: column });
      return cellText(sheet[address]);
    });

    const [classes, currentStudents] = await Promise.all([
      prisma.class.findMany({
        select: { id: true, name: true, dayOfWeek: true, startTime: true },
        orderBy: [{ name: "asc" }, { dayOfWeek: "asc" }, { startTime: "asc" }],
      }),
      prisma.student.findMany({
        where: { mergedIntoStudentId: null },
        select: {
          id: true,
          name: true,
          branch: true,
          birthDate: true,
          phone: true,
          parent: { select: { phone: true } },
          guardians: { select: { phone: true } },
          enrollments: {
            select: { classId: true, status: true, class: { select: { name: true } } },
          },
        },
      }),
    ]);

    const result = previewRallyzRoster(
      grid,
      classes.map((classRow) => classRow.name),
      currentStudents.map((student) => ({
        id: student.id,
        name: student.name,
        branch: student.branch,
        birthDate: student.birthDate,
        phone: student.phone,
        parentPhone: student.parent.phone,
        guardianPhones: student.guardians.map((guardian) => guardian.phone),
        enrollments: student.enrollments.map((enrollment) => ({
          classId: enrollment.classId,
          className: enrollment.class.name,
          status: enrollment.status,
        })),
      }))
    ) as RallyzPreviewResult;

    const classesByName = new Map<string, typeof classes>();
    for (const classRow of classes) {
      const matches = classesByName.get(classRow.name) ?? [];
      matches.push(classRow);
      classesByName.set(classRow.name, matches);
    }
    const students = result.students.map((student) => ({
      ...student,
      enrollments: student.enrollments.map((enrollment) => {
        const classMatches = classesByName.get(enrollment.className) ?? [];
        const siteClass = classMatches.length === 1 ? classMatches[0] : null;
        const existingEnrollment = siteClass && student.siteMatch.siteStudentId
          ? student.siteMatch.existingEnrollments.find((item) => item.classId === siteClass.id)
          : undefined;
        return {
          ...enrollment,
          siteClassId: siteClass?.id ?? null,
          siteDayOfWeek: siteClass?.dayOfWeek ?? null,
          siteStartTime: siteClass?.startTime ?? null,
          siteEnrollmentStatus: existingEnrollment?.status ?? null,
        };
      }),
    }));

    return NextResponse.json({
      source: "RALLYZ_ACTIVE_STUDENT_EXPORT",
      readOnly: true,
      summary: {
        rowCount: result.rowCount,
        studentCount: result.studentCount,
        enrollmentCount: result.enrollmentCount,
        heldRowCount: result.heldRowCount,
        matchedCount: students.filter((student) => student.siteMatch.status === "MATCHED_REVIEW").length,
        notConfirmedCount: students.filter((student) => student.siteMatch.status !== "MATCHED_REVIEW").length,
      },
      students,
    });
  } catch {
    return NextResponse.json(
      { error: "엑셀을 읽거나 사이트 현재 자료와 대조하지 못했습니다. 파일 형식과 로그인 상태를 확인해주세요." },
      { status: 500 }
    );
  }
}
