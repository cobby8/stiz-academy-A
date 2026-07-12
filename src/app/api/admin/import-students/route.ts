/**
 * 수강생 이관 API — 스프레드시트 CSV를 파싱하여 DB에 삽입
 *
 * POST /api/admin/import-students
 * - mode=preview: CSV 파싱 + 미리보기 (DB 변경 없음)
 * - mode=execute: CSV 파싱 + DB 삽입 (실제 이관)
 *
 * 요청 형식: { mode: "preview" | "execute", csvText: string }
 * 응답 형식:
 *   preview → { preview: ImportPreviewResult }
 *   execute → { result: { created, skipped, failed, details } }
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { fetchStudentOperationSheets } from "@/lib/googleSheetsCsv";
import {
  parseAndTransformCsv,
  parseRegistrationSheetCsv,
  parseStudentAuxiliarySheetsCsv,
  type StudentChangeSheetRow,
  type StudentRegistrationSheetRow,
  type StudentShuttleSheetRow,
  type StudentTeamRosterSheetRow,
  type TransformedStudent,
} from "@/lib/importStudents";

export async function POST(request: NextRequest) {
  // 관리자 인증 확인
  let adminUser: Awaited<ReturnType<typeof requireAdmin>>;
  try {
    adminUser = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "인증 필요" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { mode, csvText, csvSheets, source, sheetUrl } = body as {
      mode: "preview" | "execute";
      csvText?: string;
      csvSheets?: Record<string, string>;
      source?: "csv" | "googleSheet";
      sheetUrl?: string;
    };

    let sheetMap =
      csvSheets && typeof csvSheets === "object" && !Array.isArray(csvSheets)
        ? csvSheets
        : {};
    let sourceUrl: string | null = null;
    let spreadsheetId: string | null = null;
    let fetchedSheets: string[] = [];
    let skippedSheets: { sheetName: string; reason: string }[] = [];

    if (source === "googleSheet") {
      const targetSheetUrl = sheetUrl?.trim() || await getDefaultStudentSheetUrl();
      if (!targetSheetUrl) {
        return NextResponse.json(
          { error: "구글시트 URL이 없습니다. URL을 입력하거나 설정에 저장해주세요." },
          { status: 400 }
        );
      }

      const fetched = await fetchStudentOperationSheets(targetSheetUrl);
      sheetMap = { ...fetched.csvSheets, ...sheetMap };
      sourceUrl = fetched.sourceUrl;
      spreadsheetId = fetched.spreadsheetId;
      fetchedSheets = fetched.fetchedSheets;
      skippedSheets = fetched.skippedSheets;
    }

    const registrationCsvText =
      typeof csvText === "string" && csvText.trim()
        ? csvText
        : sheetMap["등록"] || sheetMap.registration || "";

    if (!registrationCsvText && Object.keys(sheetMap).length === 0) {
      return NextResponse.json(
        { error: "CSV 데이터가 없습니다." },
        { status: 400 }
      );
    }

    // CSV 파싱 및 변환
    const preview = registrationCsvText
      ? parseAndTransformCsv(registrationCsvText)
      : emptyImportPreview();
    const registrationSheet = registrationCsvText
      ? parseRegistrationSheetCsv(registrationCsvText)
      : emptyRegistrationSheet();
    const auxiliarySheets = parseStudentAuxiliarySheetsCsv(sheetMap);

    // 미리보기 모드: 파싱 결과만 반환
    if (mode === "preview") {
      return NextResponse.json({
        preview,
        registrationSheet: {
          summary: registrationSheet.summary,
          headers: registrationSheet.headers,
          errors: registrationSheet.errors,
        },
        auxiliarySheets: {
          summary: auxiliarySheets.summary,
          errors: auxiliarySheets.errors,
        },
        source: {
          type: source === "googleSheet" ? "googleSheet" : "csv",
          spreadsheetId,
          sourceUrl,
          fetchedSheets,
          skippedSheets,
        },
      });
    }

    // 실행 모드: DB에 삽입
    if (mode !== "execute") {
      return NextResponse.json(
        { error: "mode는 'preview' 또는 'execute'여야 합니다." },
        { status: 400 }
      );
    }

    await ensureStudentSheetImportTablesAvailable();
    const result = await executeImport(preview.students);
    const sheetImport = await storeStudentSheetImport(
      {
        registrationRows: registrationSheet.rows,
        shuttleRows: auxiliarySheets.shuttleRows,
        changeRows: auxiliarySheets.changeRows,
        teamRows: auxiliarySheets.teamRows,
      },
      {
        importedBy: adminUser.appUserId,
        sourceUrl,
        spreadsheetId,
        spreadsheetTitle: source === "googleSheet" ? "수강생 운영 구글시트" : "수강생 등록 CSV",
        summary: {
          registration: registrationSheet.summary,
          auxiliary: auxiliarySheets.summary,
        },
        parseErrorCount: registrationSheet.errors.length + auxiliarySheets.errors.length,
      }
    );

    return NextResponse.json({
      result: { ...result, sheetImport },
      preview: { summary: preview.summary },
      registrationSheet: { summary: registrationSheet.summary },
      auxiliarySheets: { summary: auxiliarySheets.summary },
      source: {
        type: source === "googleSheet" ? "googleSheet" : "csv",
        spreadsheetId,
        sourceUrl,
        fetchedSheets,
        skippedSheets,
      },
    });
  } catch (err) {
    console.error("[import-students] 오류:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "이관 처리 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}

// ──────────────────────────────────────────────
// DB 삽입 로직
// ──────────────────────────────────────────────

interface ImportResult {
  created: { users: number; students: number; enrollments: number; payments: number };
  skipped: { users: number; students: number; enrollments: number; payments: number };
  failed: { rowNumber: number; name: string; reason: string }[];
}

interface RegistrationSheetImportMeta {
  importedBy: string;
  sourceUrl: string | null;
  spreadsheetId: string | null;
  spreadsheetTitle: string | null;
  summary: unknown;
  parseErrorCount: number;
}

interface StudentSheetImportRows {
  registrationRows: StudentRegistrationSheetRow[];
  shuttleRows: StudentShuttleSheetRow[];
  changeRows: StudentChangeSheetRow[];
  teamRows: StudentTeamRosterSheetRow[];
}

function emptyImportPreview() {
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
    errors: [],
  };
}

function emptyRegistrationSheet() {
  return {
    headers: [],
    rows: [],
    summary: {
      totalRows: 0,
      uniqueStudentKeys: 0,
      missingStudentKeyRows: 0,
      activeCount: 0,
      pausedCount: 0,
      withdrawnCount: 0,
    },
    errors: [],
  };
}

/**
 * 변환된 학생 데이터를 DB에 삽입
 *
 * 순서: User(학부모) → Student → Enrollment → Payment
 * 각 단계에서 중복 체크 후 INSERT
 * 개별 학생 실패해도 나머지 계속 진행
 */
async function executeImport(
  students: TransformedStudent[]
): Promise<ImportResult> {
  const result: ImportResult = {
    created: { users: 0, students: 0, enrollments: 0, payments: 0 },
    skipped: { users: 0, students: 0, enrollments: 0, payments: 0 },
    failed: [],
  };

  for (const s of students) {
    try {
      // ──── 1. User(학부모) 생성 또는 조회 ────
      const userId = await findOrCreateParent(
        s.parentName,
        s.parentPhone,
        result
      );

      // ──── 2. Student 생성 또는 조회 ────
      const studentId = await findOrCreateStudent(userId, s, result);

      // ──── 3. Enrollment 생성 (slotKey → Class 매핑) ────
      for (const slotKey of s.slotKeys) {
        await createEnrollmentIfNeeded(studentId, slotKey, s.status, result);
      }

      // ──── 4. Payment 생성 (연/월 중복 체크) ────
      if (s.amount && s.year && s.month && s.paymentMethod) {
        await createPaymentIfNeeded(studentId, s, result);
      }
    } catch (err) {
      // 개별 학생 실패 — 기록하고 계속 진행
      result.failed.push({
        rowNumber: s.rowNumber,
        name: s.name,
        reason: err instanceof Error ? err.message : "알 수 없는 오류",
      });
    }
  }

  return result;
}

/**
 * 학부모 User를 찾거나 새로 생성
 * - 학부모이름+전화번호로 기존 User 검색
 * - 없으면 새 User INSERT (role=PARENT, email=phone@import.local)
 */
async function findOrCreateParent(
  name: string,
  phone: string,
  result: ImportResult
): Promise<string> {
  // 전화번호로 기존 User 검색 (같은 학부모가 여러 자녀를 가질 수 있음)
  const existing = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT id FROM "User" WHERE phone = $1 AND role = 'PARENT' LIMIT 1`,
    phone
  );

  if (existing.length > 0) {
    result.skipped.users++;
    return existing[0].id;
  }

  // 새 User 생성 — 이메일은 전화번호 기반 임시 이메일 (Supabase Auth와 무관)
  const id = crypto.randomUUID();
  const email = `${phone}@import.local`;

  await prisma.$executeRawUnsafe(
    `INSERT INTO "User" (id, email, name, phone, role, "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, 'PARENT', NOW(), NOW())
     ON CONFLICT (email) DO NOTHING`,
    id,
    email,
    name,
    phone
  );

  result.created.users++;
  return id;
}

/**
 * 학생을 찾거나 새로 생성
 * - 이름+parentId로 기존 Student 검색
 * - 없으면 INSERT (모든 필드 포함)
 */
async function findOrCreateStudent(
  parentId: string,
  s: TransformedStudent,
  result: ImportResult
): Promise<string> {
  // 같은 학부모의 같은 이름 학생이 이미 있는지 확인
  const existing = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT id FROM "Student" WHERE name = $1 AND "parentId" = $2 LIMIT 1`,
    s.name,
    parentId
  );

  if (existing.length > 0) {
    result.skipped.students++;
    return existing[0].id;
  }

  // 새 Student 생성
  const id = crypto.randomUUID();
  // birthDate가 null이면 기본값으로 2000-01-01 사용 (NOT NULL 제약 때문)
  const birthDate = s.birthDate || new Date(2000, 0, 1);

  await prisma.$executeRawUnsafe(
    `INSERT INTO "Student" (
      id, name, "birthDate", "parentId", phone, school, grade, address,
      "enrollDate", "referralSource", "uniformStatus", gender, "createdAt", "updatedAt"
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())`,
    id,
    s.name,
    birthDate,
    parentId,
    s.phone || null,
    s.school || null,
    s.grade || null,
    s.address || null,
    s.enrollDate || null,
    s.referralSource || null,
    s.uniformStatus || null,
    s.gender || null
  );

  result.created.students++;
  return id;
}

/**
 * 수강(Enrollment) 생성 — slotKey로 Class를 찾아 연결
 * - slotKey로 Class.id 조회
 * - studentId+classId 중복이면 건너뛰기
 */
async function createEnrollmentIfNeeded(
  studentId: string,
  slotKey: string,
  status: string,
  result: ImportResult
): Promise<void> {
  // slotKey로 Class 조회
  const classes = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT id FROM "Class" WHERE "slotKey" = $1 LIMIT 1`,
    slotKey
  );

  if (classes.length === 0) {
    // 해당 slotKey에 매칭되는 Class가 없음 — 건너뛰기
    return;
  }

  const classId = classes[0].id;

  // 중복 체크
  const existing = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT id FROM "Enrollment" WHERE "studentId" = $1 AND "classId" = $2 LIMIT 1`,
    studentId,
    classId
  );

  if (existing.length > 0) {
    result.skipped.enrollments++;
    return;
  }

  // INSERT
  const id = crypto.randomUUID();
  await prisma.$executeRawUnsafe(
    `INSERT INTO "Enrollment" (id, "studentId", "classId", status, "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, NOW(), NOW())`,
    id,
    studentId,
    classId,
    status
  );

  result.created.enrollments++;
}

/**
 * 결제(Payment) 생성 — 연/월 중복 체크
 * - studentId+year+month로 기존 Payment 검색
 * - 없으면 INSERT
 */
async function createPaymentIfNeeded(
  studentId: string,
  s: TransformedStudent,
  result: ImportResult
): Promise<void> {
  // 중복 체크 (같은 학생의 같은 연/월 결제)
  const existing = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT id FROM "Payment" WHERE "studentId" = $1 AND year = $2 AND month = $3 LIMIT 1`,
    studentId,
    s.year,
    s.month
  );

  if (existing.length > 0) {
    result.skipped.payments++;
    return;
  }

  // 결제 상태 결정: 결제수단이 UNPAID면 PENDING, 나머지는 PAID
  const paymentStatus = s.paymentMethod === "UNPAID" ? "PENDING" : "PAID";

  // 납부기한: 해당 월 10일
  const dueDate = new Date(s.year!, s.month! - 1, 10);

  const id = crypto.randomUUID();
  await prisma.$executeRawUnsafe(
    `INSERT INTO "Payment" (
      id, "studentId", amount, status, method, "dueDate", year, month,
      type, description, "autoGenerated", "createdAt", "updatedAt"
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'MONTHLY', $9, false, NOW(), NOW())`,
    id,
    studentId,
    s.amount || 0,
    paymentStatus,
    s.paymentMethod,
    dueDate,
    s.year,
    s.month,
    `${s.year}년 ${s.month}월 수강료 (이관)`
  );

  result.created.payments++;
}

async function ensureStudentSheetImportTablesAvailable() {
  const rows = await prisma.$queryRawUnsafe<{ exists: boolean }[]>(
    `SELECT to_regclass('"StudentSheetImportBatch"') IS NOT NULL
        AND to_regclass('"StudentSheetRawRow"') IS NOT NULL
        AND to_regclass('"StudentRegistrationLedger"') IS NOT NULL
        AND to_regclass('"StudentShuttleRide"') IS NOT NULL
        AND to_regclass('"StudentChangeLog"') IS NOT NULL
        AND to_regclass('"StudentTeamRosterEntry"') IS NOT NULL
        AND to_regclass('"StudentSheetImportIssue"') IS NOT NULL
      AS exists`
  );

  if (!rows[0]?.exists) {
    throw new Error("수강생 시트 이관 DB 테이블이 아직 적용되지 않았습니다. prisma/sql/add_student_sheet_import.sql을 먼저 적용해주세요.");
  }
}

async function getDefaultStudentSheetUrl() {
  const rows = await prisma.$queryRawUnsafe<{ googleSheetsScheduleUrl?: string | null; googlesheetsscheduleurl?: string | null }[]>(
    `SELECT "googleSheetsScheduleUrl" FROM "AcademySettings" WHERE id = 'singleton' LIMIT 1`
  );
  return rows[0]?.googleSheetsScheduleUrl ?? rows[0]?.googlesheetsscheduleurl ?? null;
}

async function storeStudentSheetImport(
  rows: StudentSheetImportRows,
  meta: RegistrationSheetImportMeta
) {
  const totalRows =
    rows.registrationRows.length +
    rows.shuttleRows.length +
    rows.changeRows.length +
    rows.teamRows.length;

  const batchRows = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `INSERT INTO "StudentSheetImportBatch" (
       id, source, "spreadsheetId", "spreadsheetTitle", "sourceUrl", "importedBy",
       status, "totalRows", "registrationRows", "vehicleRows", "changeRows", "teamRows",
       "errorRows", "rawSummaryJSON",
       message, "createdAt"
     )
     VALUES (
       gen_random_uuid()::text, 'GOOGLE_SHEETS_CSV', $1, $2, $3, $4,
       'RUNNING', $5, $6, $7, $8, $9, $10, $11, '수강생 시트 CSV 이관 진행', NOW()
     )
     RETURNING id`,
    meta.spreadsheetId,
    meta.spreadsheetTitle,
    meta.sourceUrl,
    meta.importedBy,
    totalRows,
    rows.registrationRows.length,
    rows.shuttleRows.length,
    rows.changeRows.length,
    rows.teamRows.length,
    meta.parseErrorCount,
    JSON.stringify(meta.summary)
  );

  const batchId = batchRows[0]?.id;
  if (!batchId) {
    throw new Error("수강생 시트 이관 배치를 생성하지 못했습니다.");
  }

  let rawRows = 0;
  let ledgerRows = 0;
  let shuttleRows = 0;
  let changeRows = 0;
  let teamRows = 0;
  let issues = meta.parseErrorCount;

  for (const row of rows.registrationRows) {
    const studentId = await findStudentIdForRegistration(row);
    const rawJSON = JSON.stringify(row.raw);
    const normalizedJSON = JSON.stringify({
      studentKey: row.studentKey,
      branch: row.branch,
      registrationMonth: row.registrationMonth,
      selectedSlotKeys: row.selectedSlotKeys,
      paymentAmount: row.paymentAmount,
      tuitionAmount: row.tuitionAmount,
      shuttleFee: row.shuttleFee,
      carryOverAmount: row.carryOverAmount,
      shuttleNeeded: row.shuttleNeeded,
      status: row.status,
    });

    const rawRow = await prisma.$queryRawUnsafe<{ id: string }[]>(
      `INSERT INTO "StudentSheetRawRow" (
         id, "batchId", "sheetName", "rowNumber", "rowHash", "studentKey",
         "studentId", "rawJSON", "normalizedJSON", "createdAt"
       )
       VALUES (gen_random_uuid()::text, $1, '등록', $2, $3, $4, $5, $6, $7, NOW())
       RETURNING id`,
      batchId,
      row.rowNumber,
      row.rowHash,
      row.studentKey,
      studentId,
      rawJSON,
      normalizedJSON
    );
    rawRows++;

    const rawRowId = rawRow[0]?.id ?? null;
    await prisma.$executeRawUnsafe(
      `INSERT INTO "StudentRegistrationLedger" (
         id, "batchId", "rawRowId", "studentId", "rowNumber", "studentKey",
         branch, "applicationAt", "paymentDate", "registrationMonth",
         "studentName", "studentGender", grade, "uniformStatus", "paymentMethod",
         "paymentAmount", "tuitionAmount", "shuttleFee", "carryOverAmount",
         "shuttleNeeded", "shuttlePickup", "shuttlePreferredTime", "shuttleDropoff",
         "selectedSlotKeysJSON", "birthDate", "parentName", "studentPhone", "parentPhone",
         address, school, "basketballExp", "hopeNote", "referralSource",
         "agreedPrivacy", "agreedTerms", "agreementJSON", "enrollmentPeriod",
         status, "rawJSON", "createdAt", "updatedAt"
       )
       VALUES (
         gen_random_uuid()::text, $1, $2, $3, $4, $5,
         $6, $7, $8, $9,
         $10, $11, $12, $13, $14,
         $15, $16, $17, $18,
         $19, $20, $21, $22,
         $23, $24, $25, $26, $27,
         $28, $29, $30, $31, $32,
         $33, $34, $35, $36,
         $37, $38, NOW(), NOW()
       )`,
      batchId,
      rawRowId,
      studentId,
      row.rowNumber,
      row.studentKey,
      row.branch,
      row.applicationAt,
      row.paymentDate,
      row.registrationMonth,
      row.studentName,
      row.studentGender,
      row.grade,
      row.uniformStatus,
      row.paymentMethod,
      row.paymentAmount,
      row.tuitionAmount,
      row.shuttleFee,
      row.carryOverAmount,
      row.shuttleNeeded,
      row.shuttlePickup,
      row.shuttlePreferredTime,
      row.shuttleDropoff,
      JSON.stringify(row.selectedSlotKeys),
      row.birthDate,
      row.parentName,
      row.studentPhone,
      row.parentPhone,
      row.address,
      row.school,
      row.basketballExp,
      row.hopeNote,
      row.referralSource,
      row.agreedPrivacy,
      row.agreedTerms,
      JSON.stringify(row.agreementJSON),
      row.enrollmentPeriod,
      row.status,
      rawJSON
    );
    ledgerRows++;

    if (studentId) {
      await updateStudentFromRegistrationRow(studentId, rawRowId, row);
    } else {
      await createImportIssue(
        batchId,
        "등록",
        row.rowNumber,
        "WARNING",
        row.studentKey
          ? "원본 등록 행은 저장했지만 기존/신규 Student와 연결하지 못했습니다."
          : "원본 등록 행은 저장했지만 학생 이름 또는 학부모 전화번호가 부족해 Student 연결키를 만들지 못했습니다.",
        rawJSON
      );
      issues++;
    }
  }

  for (const row of rows.shuttleRows) {
    const studentId = await findStudentIdByNameAndPhones(
      row.studentName,
      row.parentPhone,
      row.studentPhone
    );
    const rawJSON = JSON.stringify(row.raw);
    const normalizedJSON = JSON.stringify({
      studentKey: row.studentKey,
      monthLabel: row.monthLabel,
      dayLabel: row.dayLabel,
      classTime: row.classTime,
      arrivalTime: row.arrivalTime,
      destination: row.destination,
    });
    const rawRowId = await insertStudentSheetRawRow({
      batchId,
      sheetName: row.sheetName,
      rowNumber: row.rowNumber,
      rowHash: row.rowHash,
      studentKey: row.studentKey,
      studentId,
      rawJSON,
      normalizedJSON,
    });
    rawRows++;

    await prisma.$executeRawUnsafe(
      `INSERT INTO "StudentShuttleRide" (
         id, "batchId", "rawRowId", "studentId", "monthLabel", "rowNumber",
         "studentName", "studentPhone", "parentPhone", "dayLabel", "classTime",
         "arrivalTime", destination, note, memo, "rawJSON", "createdAt", "updatedAt"
       )
       VALUES (
         gen_random_uuid()::text, $1, $2, $3, $4, $5,
         $6, $7, $8, $9, $10,
         $11, $12, $13, $14, $15, NOW(), NOW()
       )`,
      batchId,
      rawRowId,
      studentId,
      row.monthLabel,
      row.rowNumber,
      row.studentName,
      row.studentPhone,
      row.parentPhone,
      row.dayLabel,
      row.classTime,
      row.arrivalTime,
      row.destination,
      row.note,
      row.memo,
      rawJSON
    );
    shuttleRows++;

    if (!studentId) {
      await createImportIssue(
        batchId,
        row.sheetName,
        row.rowNumber,
        "WARNING",
        "차량 행은 저장했지만 Student와 연결하지 못했습니다.",
        rawJSON
      );
      issues++;
    }
  }

  for (const row of rows.changeRows) {
    const rawJSON = JSON.stringify(row.raw);
    const normalizedJSON = JSON.stringify({
      occurredAt: row.occurredAt,
      changeSummary: row.changeSummary,
      registrationReflected: row.registrationReflected,
      rallyzReflected: row.rallyzReflected,
      vehicleReflected: row.vehicleReflected,
    });
    const rawRowId = await insertStudentSheetRawRow({
      batchId,
      sheetName: row.sheetName,
      rowNumber: row.rowNumber,
      rowHash: row.rowHash,
      studentKey: null,
      studentId: null,
      rawJSON,
      normalizedJSON,
    });
    rawRows++;

    await prisma.$executeRawUnsafe(
      `INSERT INTO "StudentChangeLog" (
         id, "batchId", "rawRowId", "rowNumber", "occurredAt", "changeSummary",
         "registrationReflected", "rallyzReflected", "vehicleReflected",
         "alarmStatus", note, "rawJSON", "createdAt"
       )
       VALUES (
         gen_random_uuid()::text, $1, $2, $3, $4, $5,
         $6, $7, $8,
         $9, $10, $11, NOW()
       )`,
      batchId,
      rawRowId,
      row.rowNumber,
      row.occurredAt,
      row.changeSummary,
      row.registrationReflected,
      row.rallyzReflected,
      row.vehicleReflected,
      row.alarmStatus,
      row.note,
      rawJSON
    );
    changeRows++;
  }

  for (const row of rows.teamRows) {
    const studentId = await findStudentIdByNameAndPhones(
      row.studentName,
      row.phone,
      row.phone
    );
    const rawJSON = JSON.stringify(row.raw);
    const normalizedJSON = JSON.stringify({
      studentKey: row.studentKey,
      jerseyNumber: row.jerseyNumber,
      grade: row.grade,
      branch: row.branch,
      eventColumnsJSON: row.eventColumnsJSON,
    });
    const rawRowId = await insertStudentSheetRawRow({
      batchId,
      sheetName: row.sheetName,
      rowNumber: row.rowNumber,
      rowHash: row.rowHash,
      studentKey: row.studentKey,
      studentId,
      rawJSON,
      normalizedJSON,
    });
    rawRows++;

    await prisma.$executeRawUnsafe(
      `INSERT INTO "StudentTeamRosterEntry" (
         id, "batchId", "rawRowId", "studentId", "rowNumber", "studentName",
         "birthDate", "jerseyNumber", phone, grade, branch, "eventColumnsJSON",
         "rawJSON", "createdAt", "updatedAt"
       )
       VALUES (
         gen_random_uuid()::text, $1, $2, $3, $4, $5,
         $6, $7, $8, $9, $10, $11,
         $12, NOW(), NOW()
       )`,
      batchId,
      rawRowId,
      studentId,
      row.rowNumber,
      row.studentName,
      row.birthDate,
      row.jerseyNumber,
      row.phone,
      row.grade,
      row.branch,
      JSON.stringify(row.eventColumnsJSON),
      rawJSON
    );
    teamRows++;

    if (!studentId) {
      await createImportIssue(
        batchId,
        row.sheetName,
        row.rowNumber,
        "WARNING",
        "대표팀 명단 행은 저장했지만 Student와 연결하지 못했습니다.",
        rawJSON
      );
      issues++;
    }
  }

  await prisma.$executeRawUnsafe(
    `UPDATE "StudentSheetImportBatch"
     SET status = 'COMPLETED',
         "totalRows" = $2,
         "registrationRows" = $3,
         "vehicleRows" = $4,
         "changeRows" = $5,
         "teamRows" = $6,
         "errorRows" = $7,
         message = $8,
         "completedAt" = NOW()
     WHERE id = $1`,
    batchId,
    totalRows,
    ledgerRows,
    shuttleRows,
    changeRows,
    teamRows,
    issues,
    `원본 ${rawRows}행, 등록 ${ledgerRows}행, 차량 ${shuttleRows}행, 변동 ${changeRows}행, 대표팀 ${teamRows}행 저장 완료`
  );

  return {
    batchId,
    rawRows,
    registrationRows: ledgerRows,
    shuttleRows,
    changeRows,
    teamRows,
    issues,
  };
}

async function findStudentIdForRegistration(row: StudentRegistrationSheetRow) {
  if (!row.studentName || !row.parentPhone) return null;
  const found = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT s.id
     FROM "Student" s
     INNER JOIN "User" u ON u.id = s."parentId"
     WHERE s.name = $1
       AND regexp_replace(COALESCE(u.phone, ''), '[^0-9]', '', 'g') = $2
     LIMIT 1`,
    row.studentName,
    row.parentPhone
  );
  return found[0]?.id ?? null;
}

async function findStudentIdByNameAndPhones(
  studentName: string | null,
  parentPhone: string | null,
  studentPhone: string | null
) {
  if (!studentName || studentName === "(이름 없음)") return null;

  const normalizedParentPhone = (parentPhone || "").replace(/[^0-9]/g, "");
  const normalizedStudentPhone = (studentPhone || "").replace(/[^0-9]/g, "");
  if (!normalizedParentPhone && !normalizedStudentPhone) return null;

  const found = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT s.id
     FROM "Student" s
     INNER JOIN "User" u ON u.id = s."parentId"
     WHERE s.name = $1
       AND (
         ($2 <> '' AND regexp_replace(COALESCE(u.phone, ''), '[^0-9]', '', 'g') = $2)
         OR ($3 <> '' AND regexp_replace(COALESCE(s.phone, ''), '[^0-9]', '', 'g') = $3)
       )
     LIMIT 1`,
    studentName,
    normalizedParentPhone,
    normalizedStudentPhone
  );
  return found[0]?.id ?? null;
}

async function insertStudentSheetRawRow(input: {
  batchId: string;
  sheetName: string;
  rowNumber: number;
  rowHash: string | null;
  studentKey: string | null;
  studentId: string | null;
  rawJSON: string;
  normalizedJSON: string | null;
}) {
  const rawRow = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `INSERT INTO "StudentSheetRawRow" (
       id, "batchId", "sheetName", "rowNumber", "rowHash", "studentKey",
       "studentId", "rawJSON", "normalizedJSON", "createdAt"
     )
     VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, NOW())
     RETURNING id`,
    input.batchId,
    input.sheetName,
    input.rowNumber,
    input.rowHash,
    input.studentKey,
    input.studentId,
    input.rawJSON,
    input.normalizedJSON
  );
  return rawRow[0]?.id ?? null;
}

async function updateStudentFromRegistrationRow(
  studentId: string,
  rawRowId: string | null,
  row: StudentRegistrationSheetRow
) {
  await prisma.$executeRawUnsafe(
    `UPDATE "Student"
     SET branch = COALESCE($2, branch),
         gender = COALESCE($3, gender),
         phone = COALESCE($4, phone),
         school = COALESCE($5, school),
         grade = COALESCE($6, grade),
         address = COALESCE($7, address),
         "birthDate" = COALESCE($8::timestamp, "birthDate"),
         "referralSource" = COALESCE($9, "referralSource"),
         "uniformStatus" = COALESCE($10, "uniformStatus"),
         "basketballExp" = COALESCE($11, "basketballExp"),
         "hopeNote" = COALESCE($12, "hopeNote"),
         "agreementsJSON" = $13,
         "sourceImportRowId" = COALESCE($14, "sourceImportRowId"),
         "updatedAt" = NOW()
     WHERE id = $1`,
    studentId,
    row.branch,
    row.studentGender,
    row.studentPhone,
    row.school,
    row.grade,
    row.address,
    row.birthDate,
    row.referralSource,
    row.uniformStatus,
    row.basketballExp,
    row.hopeNote,
    JSON.stringify(row.agreementJSON),
    rawRowId
  );
}

async function createImportIssue(
  batchId: string,
  sheetName: string,
  rowNumber: number,
  severity: "WARNING" | "ERROR",
  message: string,
  rawJSON: string
) {
  await prisma.$executeRawUnsafe(
    `INSERT INTO "StudentSheetImportIssue" (
       id, "batchId", "sheetName", "rowNumber", severity, message, "rawJSON", "createdAt"
     )
     VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, NOW())`,
    batchId,
    sheetName,
    rowNumber,
    severity,
    message,
    rawJSON
  );
}
