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
import {
  parseAndTransformCsv,
  type TransformedStudent,
} from "@/lib/importStudents";

export async function POST(request: NextRequest) {
  // 관리자 인증 확인
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "인증 필요" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { mode, csvText } = body as {
      mode: "preview" | "execute";
      csvText: string;
    };

    if (!csvText || typeof csvText !== "string") {
      return NextResponse.json(
        { error: "CSV 데이터가 없습니다." },
        { status: 400 }
      );
    }

    // CSV 파싱 및 변환
    const preview = parseAndTransformCsv(csvText);

    // 미리보기 모드: 파싱 결과만 반환
    if (mode === "preview") {
      return NextResponse.json({ preview });
    }

    // 실행 모드: DB에 삽입
    if (mode !== "execute") {
      return NextResponse.json(
        { error: "mode는 'preview' 또는 'execute'여야 합니다." },
        { status: 400 }
      );
    }

    const result = await executeImport(preview.students);
    return NextResponse.json({ result, preview: { summary: preview.summary } });
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
      "enrollDate", "referralSource", "uniformStatus", "createdAt", "updatedAt"
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())`,
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
    s.uniformStatus || null
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
