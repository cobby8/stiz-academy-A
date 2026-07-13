import { NextRequest, NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";

import { requireAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import {
  cleanSheetString,
  findSheetValue,
  findStudentIdentityMatch,
  normalizePhoneDigits,
  type StudentIdentityInput,
  type StudentIdentityMatch,
} from "@/lib/studentSheetMatching";

type RelinkKind = "registration" | "shuttle" | "team";

type RelinkSourceRow = {
  kind: RelinkKind;
  id: string;
  rawRowId: string | null;
  sheetName: string;
  rowNumber: number;
  rawJSON: string | null;
  studentName?: string | null;
  studentPhone?: string | null;
  parentPhone?: string | null;
  parentName?: string | null;
  birthDate?: Date | string | null;
  grade?: string | null;
  school?: string | null;
};

type RelinkCandidate = {
  kind: RelinkKind;
  id: string;
  rawRowId: string | null;
  sheetName: string;
  rowNumber: number;
  studentName: string | null;
  studentPhone: string | null;
  parentPhone: string | null;
  match: StudentIdentityMatch;
};

type RelinkReviewRow = Omit<RelinkCandidate, "match"> & {
  match: StudentIdentityMatch | null;
};

type RelinkPreview = {
  batchId: string | null;
  scanned: Record<RelinkKind, number>;
  matched: Record<RelinkKind, number>;
  applyReady: Record<RelinkKind, number>;
  weakOnly: Record<RelinkKind, number>;
  unmatched: Record<RelinkKind, number>;
  ignored: Record<RelinkKind, number>;
  byConfidence: Record<StudentIdentityMatch["confidence"], number>;
  samples: {
    matched: RelinkCandidate[];
    unmatched: Pick<RelinkCandidate, "kind" | "id" | "sheetName" | "rowNumber" | "studentName" | "studentPhone" | "parentPhone">[];
  };
  reviewRows: RelinkReviewRow[];
};

const emptyKindCounts = (): Record<RelinkKind, number> => ({
  registration: 0,
  shuttle: 0,
  team: 0,
});

async function getLatestBatchId() {
  const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT id
     FROM "StudentSheetImportBatch"
     WHERE status = 'COMPLETED'
     ORDER BY "createdAt" DESC
     LIMIT 1`
  );
  return rows[0]?.id ?? null;
}

function parseRawJson(rawJSON: string | null) {
  if (!rawJSON) return {};
  try {
    return JSON.parse(rawJSON) as Record<string, string>;
  } catch {
    return {};
  }
}

function extractInput(row: RelinkSourceRow): StudentIdentityInput {
  const raw = parseRawJson(row.rawJSON);

  if (row.kind === "shuttle") {
    return {
      studentName: cleanSheetString(row.studentName) ?? cleanSheetString(findSheetValue(raw, "수강생 이름", "학생 이름", "이름")),
      studentPhone:
        normalizePhoneDigits(row.studentPhone) ||
        normalizePhoneDigits(findSheetValue(raw, "수강생 전화번호", "학생 전화번호")),
      parentPhone:
        normalizePhoneDigits(row.parentPhone) ||
        normalizePhoneDigits(findSheetValue(raw, "학부모 전화번호", "보호자 전화번호")),
    };
  }

  if (row.kind === "team") {
    return {
      studentName: cleanSheetString(row.studentName) ?? cleanSheetString(findSheetValue(raw, "이름", "수강생 이름")),
      studentPhone:
        normalizePhoneDigits(row.studentPhone) ||
        normalizePhoneDigits(findSheetValue(raw, "연락처", "전화번호", "수강생 전화번호")),
      parentPhone:
        normalizePhoneDigits(row.parentPhone) ||
        normalizePhoneDigits(findSheetValue(raw, "학부모 전화번호", "보호자 전화번호", "연락처", "전화번호")),
      birthDate: row.birthDate ?? findSheetValue(raw, "생년월일", "생일"),
      grade: cleanSheetString(row.grade) ?? cleanSheetString(findSheetValue(raw, "학년")),
    };
  }

  return {
    studentName: cleanSheetString(row.studentName) ?? cleanSheetString(findSheetValue(raw, "수강생 이름", "이름", "성명")),
    parentPhone:
      normalizePhoneDigits(row.parentPhone) ||
      normalizePhoneDigits(findSheetValue(raw, "학부모 전화번호(숫자만)", "학부모 전화번호", "보호자 전화번호")),
    studentPhone:
      normalizePhoneDigits(row.studentPhone) ||
      normalizePhoneDigits(findSheetValue(raw, "수강생 전화번호(숫자만)", "수강생 전화번호", "학생 전화번호")),
    parentName: cleanSheetString(row.parentName) ?? cleanSheetString(findSheetValue(raw, "학부모 이름", "보호자 이름")),
    birthDate: row.birthDate ?? findSheetValue(raw, "수강생 생년월일", "생년월일"),
    grade: cleanSheetString(row.grade) ?? cleanSheetString(findSheetValue(raw, "학년")),
    school: cleanSheetString(row.school) ?? cleanSheetString(findSheetValue(raw, "학교명", "학교")),
  };
}

function identityCacheKey(input: StudentIdentityInput) {
  return [
    input.studentName ?? "",
    normalizePhoneDigits(input.parentPhone),
    normalizePhoneDigits(input.studentPhone),
    input.parentName ?? "",
    input.birthDate instanceof Date ? input.birthDate.toISOString() : input.birthDate ?? "",
    input.grade ?? "",
    input.school ?? "",
  ].join("|");
}

function hasReviewableIdentity(input: StudentIdentityInput) {
  return Boolean(
    cleanSheetString(input.studentName) ||
      normalizePhoneDigits(input.parentPhone) ||
      normalizePhoneDigits(input.studentPhone) ||
      cleanSheetString(input.parentName) ||
      input.birthDate ||
      cleanSheetString(input.grade) ||
      cleanSheetString(input.school)
  );
}

async function readSourceRows(batchId: string): Promise<RelinkSourceRow[]> {
  const [registrations, shuttles, teams] = await Promise.all([
    prisma.$queryRawUnsafe<Omit<RelinkSourceRow, "kind">[]>(
      `SELECT id, "rawRowId", '등록' AS "sheetName", "rowNumber", "rawJSON",
              "studentName", "studentPhone", "parentPhone", "parentName",
              "birthDate", grade, school
       FROM "StudentRegistrationLedger"
       WHERE "batchId" = $1
         AND "studentId" IS NULL`,
      batchId
    ),
    prisma.$queryRawUnsafe<Omit<RelinkSourceRow, "kind">[]>(
      `SELECT sr.id, sr."rawRowId", COALESCE(rr."sheetName", sr."monthLabel") AS "sheetName",
              sr."rowNumber", sr."rawJSON", sr."studentName", sr."studentPhone", sr."parentPhone"
       FROM "StudentShuttleRide" sr
       LEFT JOIN "StudentSheetRawRow" rr ON rr.id = sr."rawRowId"
       WHERE sr."batchId" = $1
         AND sr."studentId" IS NULL`,
      batchId
    ),
    prisma.$queryRawUnsafe<Omit<RelinkSourceRow, "kind" | "parentPhone" | "parentName" | "school">[]>(
      `SELECT id, "rawRowId", '대표팀 명단' AS "sheetName", "rowNumber", "rawJSON",
              "studentName", phone AS "studentPhone", "birthDate", grade
       FROM "StudentTeamRosterEntry"
       WHERE "batchId" = $1
         AND "studentId" IS NULL`,
      batchId
    ),
  ]);

  return [
    ...registrations.map((row) => ({ ...row, kind: "registration" as const })),
    ...shuttles.map((row) => ({ ...row, kind: "shuttle" as const })),
    ...teams.map((row) => ({ ...row, kind: "team" as const, parentPhone: null })),
  ];
}

function clampReviewLimit(value: string | null) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 24;
  return Math.min(50, Math.max(0, Math.floor(parsed)));
}

async function buildPreview(batchId: string | null, reviewLimit = 24): Promise<RelinkPreview> {
  if (!batchId) {
    return {
      batchId: null,
      scanned: emptyKindCounts(),
      matched: emptyKindCounts(),
      applyReady: emptyKindCounts(),
      weakOnly: emptyKindCounts(),
      unmatched: emptyKindCounts(),
      ignored: emptyKindCounts(),
      byConfidence: { strong: 0, medium: 0, weak: 0 },
      samples: { matched: [], unmatched: [] },
      reviewRows: [],
    };
  }

  const rows = await readSourceRows(batchId);
  const scanned = emptyKindCounts();
  const matched = emptyKindCounts();
  const applyReady = emptyKindCounts();
  const weakOnly = emptyKindCounts();
  const unmatched = emptyKindCounts();
  const ignored = emptyKindCounts();
  const byConfidence: Record<StudentIdentityMatch["confidence"], number> = {
    strong: 0,
    medium: 0,
    weak: 0,
  };
  const matchCache = new Map<string, StudentIdentityMatch | null>();
  const matchedSamples: RelinkCandidate[] = [];
  const unmatchedSamples: RelinkPreview["samples"]["unmatched"] = [];
  const reviewRows: RelinkReviewRow[] = [];

  for (const row of rows) {
    scanned[row.kind]++;
    const input = extractInput(row);
    if (!hasReviewableIdentity(input)) {
      ignored[row.kind]++;
      continue;
    }

    const key = identityCacheKey(input);
    let match = matchCache.get(key);
    if (match === undefined) {
      match = await findStudentIdentityMatch(prisma, input);
      matchCache.set(key, match);
    }

    const candidateBase = {
      kind: row.kind,
      id: row.id,
      rawRowId: row.rawRowId,
      sheetName: row.sheetName,
      rowNumber: row.rowNumber,
      studentName: cleanSheetString(input.studentName),
      studentPhone: normalizePhoneDigits(input.studentPhone) || null,
      parentPhone: normalizePhoneDigits(input.parentPhone) || null,
    };

    if (match) {
      matched[row.kind]++;
      byConfidence[match.confidence]++;
      if (match.confidence === "weak") {
        weakOnly[row.kind]++;
      } else {
        applyReady[row.kind]++;
      }
      if (matchedSamples.length < 12) {
        matchedSamples.push({ ...candidateBase, match });
      }
      if (reviewRows.length < reviewLimit) {
        reviewRows.push({ ...candidateBase, match });
      }
    } else {
      unmatched[row.kind]++;
      if (unmatchedSamples.length < 12) {
        unmatchedSamples.push(candidateBase);
      }
      if (reviewRows.length < reviewLimit) {
        reviewRows.push({ ...candidateBase, match: null });
      }
    }
  }

  return {
    batchId,
    scanned,
    matched,
    applyReady,
    weakOnly,
    unmatched,
    ignored,
    byConfidence,
    samples: {
      matched: matchedSamples,
      unmatched: unmatchedSamples,
    },
    reviewRows,
  };
}

function revalidateRelinkCaches() {
  for (const tag of ["admin-students", "admin-student-imports", "admin-classes", "admin-schedule", "admin-dashboard"]) {
    revalidateTag(tag, { expire: 0 });
  }

  revalidatePath("/admin/students");
  revalidatePath("/admin/import");
  revalidatePath("/admin/schedule");
}

async function applyCandidate(batchId: string, candidate: RelinkCandidate) {
  const studentKey =
    candidate.studentName && (candidate.parentPhone || candidate.studentPhone)
      ? `${candidate.studentName}__${candidate.parentPhone || candidate.studentPhone}`
      : null;

  if (candidate.kind === "registration") {
    await prisma.$executeRawUnsafe(
      `UPDATE "StudentRegistrationLedger"
       SET "studentId" = $2, "updatedAt" = NOW()
       WHERE id = $1`,
      candidate.id,
      candidate.match.studentId
    );
  }

  if (candidate.kind === "shuttle") {
    await prisma.$executeRawUnsafe(
      `UPDATE "StudentShuttleRide"
       SET "studentId" = $2,
           "studentName" = COALESCE($3, "studentName"),
           "studentPhone" = COALESCE($4, "studentPhone"),
           "parentPhone" = COALESCE($5, "parentPhone"),
           "updatedAt" = NOW()
       WHERE id = $1`,
      candidate.id,
      candidate.match.studentId,
      candidate.studentName,
      candidate.studentPhone,
      candidate.parentPhone
    );
  }

  if (candidate.kind === "team") {
    await prisma.$executeRawUnsafe(
      `UPDATE "StudentTeamRosterEntry"
       SET "studentId" = $2,
           phone = COALESCE($3, phone),
           "updatedAt" = NOW()
       WHERE id = $1`,
      candidate.id,
      candidate.match.studentId,
      candidate.studentPhone
    );
  }

  if (candidate.rawRowId) {
    await prisma.$executeRawUnsafe(
      `UPDATE "StudentSheetRawRow"
       SET "studentId" = $2,
           "studentKey" = COALESCE($3, "studentKey")
       WHERE id = $1`,
      candidate.rawRowId,
      candidate.match.studentId,
      studentKey
    );
  }

  await prisma.$executeRawUnsafe(
    `DELETE FROM "StudentSheetImportIssue"
     WHERE "batchId" = $1
       AND "sheetName" = $2
       AND "rowNumber" = $3
       AND severity = 'WARNING'
       AND message LIKE '%Student와 연결하지 못했습니다.%'`,
    batchId,
    candidate.sheetName,
    candidate.rowNumber
  );
}

async function applyManualCandidate(batchId: string, input: unknown) {
  if (!input || typeof input !== "object") {
    throw new Error("수동 연결 정보가 없습니다.");
  }

  const body = input as { kind?: string; id?: string; studentId?: string };
  if (!["registration", "shuttle", "team"].includes(body.kind ?? "")) {
    throw new Error("알 수 없는 원본 종류입니다.");
  }
  if (!body.id || !body.studentId) {
    throw new Error("원본 행과 연결할 학생을 선택해주세요.");
  }

  const students = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT id FROM "Student" WHERE id = $1 LIMIT 1`,
    body.studentId
  );
  if (!students[0]) {
    throw new Error("선택한 학생을 찾을 수 없습니다.");
  }

  const row = (await readSourceRows(batchId)).find(
    (sourceRow) => sourceRow.kind === body.kind && sourceRow.id === body.id
  );
  if (!row) {
    throw new Error("이미 연결되었거나 최신 이관 배치에서 찾을 수 없는 행입니다.");
  }

  const extracted = extractInput(row);
  await applyCandidate(batchId, {
    kind: row.kind,
    id: row.id,
    rawRowId: row.rawRowId,
    sheetName: row.sheetName,
    rowNumber: row.rowNumber,
    studentName: cleanSheetString(extracted.studentName),
    studentPhone: normalizePhoneDigits(extracted.studentPhone) || null,
    parentPhone: normalizePhoneDigits(extracted.parentPhone) || null,
    match: {
      studentId: body.studentId,
      confidence: "strong",
      matchedBy: "manual",
    },
  });

  const applied = emptyKindCounts();
  applied[row.kind] = 1;
  return applied;
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "인증 필요" }, { status: 401 });
  }

  try {
    const reviewLimit = clampReviewLimit(request.nextUrl.searchParams.get("reviewLimit"));
    return NextResponse.json(await buildPreview(await getLatestBatchId(), reviewLimit));
  } catch (error) {
    console.error("[api/admin/import-students/relink] preview failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "학생 재연결 점검에 실패했습니다." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "인증 필요" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => null);
    const includeWeak = request.nextUrl.searchParams.get("includeWeak") === "true";
    const batchId = await getLatestBatchId();
    if (!batchId) {
      return NextResponse.json({ error: "완료된 수강생 이관 배치가 없습니다." }, { status: 400 });
    }

    if (body?.action === "manual") {
      const applied = await applyManualCandidate(batchId, body);
      await prisma.$executeRawUnsafe(
        `UPDATE "StudentSheetImportBatch"
         SET "errorRows" = (
           SELECT COUNT(*)::int
           FROM "StudentSheetImportIssue"
           WHERE "batchId" = $1
         )
         WHERE id = $1`,
        batchId
      );
      revalidateRelinkCaches();

      return NextResponse.json({
        success: true,
        manual: true,
        applied,
        after: await buildPreview(batchId),
      });
    }

    const before = await buildPreview(batchId);

    const rows = await readSourceRows(batchId);
    const matchCache = new Map<string, StudentIdentityMatch | null>();
    const applied = emptyKindCounts();

    for (const row of rows) {
      const input = extractInput(row);
      if (!hasReviewableIdentity(input)) continue;

      const key = identityCacheKey(input);
      let match = matchCache.get(key);
      if (match === undefined) {
        match = await findStudentIdentityMatch(prisma, input);
        matchCache.set(key, match);
      }
      if (!match || (!includeWeak && match.confidence === "weak")) continue;

      await applyCandidate(batchId, {
        kind: row.kind,
        id: row.id,
        rawRowId: row.rawRowId,
        sheetName: row.sheetName,
        rowNumber: row.rowNumber,
        studentName: cleanSheetString(input.studentName),
        studentPhone: normalizePhoneDigits(input.studentPhone) || null,
        parentPhone: normalizePhoneDigits(input.parentPhone) || null,
        match,
      });
      applied[row.kind]++;
    }

    await prisma.$executeRawUnsafe(
      `UPDATE "StudentSheetImportBatch"
       SET "errorRows" = (
         SELECT COUNT(*)::int
         FROM "StudentSheetImportIssue"
         WHERE "batchId" = $1
       )
       WHERE id = $1`,
      batchId
    );

    revalidateRelinkCaches();
    const after = await buildPreview(batchId);

    return NextResponse.json({
      success: true,
      includeWeak,
      applied,
      before,
      after,
    });
  } catch (error) {
    console.error("[api/admin/import-students/relink] apply failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "학생 재연결 적용에 실패했습니다." },
      { status: 500 }
    );
  }
}
