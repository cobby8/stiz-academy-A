import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";

import { requireAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

type ReconcileSampleRow = {
  studentId: string;
  studentName: string;
  slotKey: string;
  currentStatus?: string | null;
  targetStatus?: string | null;
};

type ReconcilePreview = {
  batchId: string | null;
  expectedActivePairs: number;
  missingEnrollments: number;
  reactivations: number;
  pauseExtras: number;
  unresolvedLedgerRows: number;
  missingClassSlots: number;
  outsideScopeActiveStudents: number;
  samples: {
    missing: ReconcileSampleRow[];
    reactivations: ReconcileSampleRow[];
    pauseExtras: ReconcileSampleRow[];
  };
};

const LATEST_BATCH_SQL = `
  SELECT id
  FROM "StudentSheetImportBatch"
  WHERE status = 'COMPLETED'
  ORDER BY "createdAt" DESC
  LIMIT 1
`;

const RECONCILE_CTE = `
  WITH latest AS (${LATEST_BATCH_SQL}),
  ledger AS (
    SELECT
      r.*,
      (
        string_to_array(
          trim(both ',' from regexp_replace(COALESCE(r."registrationMonth", ''), '[^0-9]+', ',', 'g')),
          ','
        )
      )[2]::int AS "monthNumber"
    FROM "StudentRegistrationLedger" r
    JOIN latest ON latest.id = r."batchId"
  ),
  selected_month AS (
    SELECT l."monthNumber"
    FROM ledger l
    WHERE l."monthNumber" IS NOT NULL
    GROUP BY l."monthNumber"
    ORDER BY l."monthNumber" DESC
    LIMIT 1
  ),
  target AS (
    SELECT l.*
    FROM ledger l
    JOIN selected_month sm ON sm."monthNumber" = l."monthNumber"
  ),
  expected_pairs AS (
    SELECT DISTINCT
      r."studentId",
      r."studentName",
      slot_key AS "slotKey",
      c.id AS "classId"
    FROM target r
    CROSS JOIN LATERAL jsonb_array_elements_text(
      COALESCE(NULLIF(r."selectedSlotKeysJSON", ''), '[]')::jsonb
    ) AS slot_key
    JOIN "Class" c ON c."slotKey" = slot_key
    WHERE r."studentId" IS NOT NULL
      AND r.status = 'ACTIVE'
  ),
  scoped_students AS (
    SELECT
      r."studentId",
      MAX(r."studentName") AS "studentName",
      CASE
        WHEN BOOL_OR(r.status = 'ACTIVE') THEN 'ACTIVE'
        WHEN BOOL_OR(r.status = 'PAUSED') THEN 'PAUSED'
        ELSE 'WITHDRAWN'
      END AS "targetStatus"
    FROM target r
    WHERE r."studentId" IS NOT NULL
    GROUP BY r."studentId"
  ),
  active_enrollments AS (
    SELECT
      e.id,
      e."studentId",
      s.name AS "studentName",
      e."classId",
      c."slotKey",
      e.status
    FROM "Enrollment" e
    JOIN "Class" c ON c.id = e."classId"
    JOIN "Student" s ON s.id = e."studentId"
    WHERE c."slotKey" IS NOT NULL
  ),
  missing AS (
    SELECT ep."studentId", ep."studentName", ep."slotKey", ep."classId"
    FROM expected_pairs ep
    LEFT JOIN "Enrollment" e ON e."studentId" = ep."studentId" AND e."classId" = ep."classId"
    WHERE e.id IS NULL
  ),
  reactivations AS (
    SELECT ep."studentId", ep."studentName", ep."slotKey", ep."classId", e.status AS "currentStatus"
    FROM expected_pairs ep
    JOIN "Enrollment" e ON e."studentId" = ep."studentId" AND e."classId" = ep."classId"
    WHERE e.status <> 'ACTIVE'
  ),
  pause_extras AS (
    SELECT
      ae.id,
      ae."studentId",
      ae."studentName",
      ae."slotKey",
      ae."classId",
      ae.status AS "currentStatus",
      CASE
        WHEN ss."targetStatus" IN ('PAUSED', 'WITHDRAWN') THEN ss."targetStatus"
        ELSE 'PAUSED'
      END AS "targetStatus"
    FROM active_enrollments ae
    LEFT JOIN scoped_students ss ON ss."studentId" = ae."studentId"
    LEFT JOIN expected_pairs ep ON ep."studentId" = ae."studentId" AND ep."classId" = ae."classId"
    WHERE ae.status = 'ACTIVE'
      AND ep."studentId" IS NULL
  ),
  missing_class_slots AS (
    SELECT DISTINCT slot_key AS "slotKey"
    FROM target r
    CROSS JOIN LATERAL jsonb_array_elements_text(
      COALESCE(NULLIF(r."selectedSlotKeysJSON", ''), '[]')::jsonb
    ) AS slot_key
    LEFT JOIN "Class" c ON c."slotKey" = slot_key
    WHERE r."studentId" IS NOT NULL
      AND r.status = 'ACTIVE'
      AND c.id IS NULL
  ),
  outside_scope AS (
    SELECT DISTINCT ae."studentId"
    FROM active_enrollments ae
    LEFT JOIN scoped_students ss ON ss."studentId" = ae."studentId"
    WHERE ae.status = 'ACTIVE'
      AND ss."studentId" IS NULL
  )
`;

async function getPreview(): Promise<ReconcilePreview> {
  const latestRows = await prisma.$queryRawUnsafe<{ id: string }[]>(LATEST_BATCH_SQL);
  const batchId = latestRows[0]?.id ?? null;

  if (!batchId) {
    return {
      batchId: null,
      expectedActivePairs: 0,
      missingEnrollments: 0,
      reactivations: 0,
      pauseExtras: 0,
      unresolvedLedgerRows: 0,
      missingClassSlots: 0,
      outsideScopeActiveStudents: 0,
      samples: { missing: [], reactivations: [], pauseExtras: [] },
    };
  }

  const [summaryRows, missing, reactivations, pauseExtras] = await Promise.all([
    prisma.$queryRawUnsafe<{
      expectedActivePairs: number;
      missingEnrollments: number;
      reactivations: number;
      pauseExtras: number;
      unresolvedLedgerRows: number;
      missingClassSlots: number;
      outsideScopeActiveStudents: number;
    }[]>(`
      ${RECONCILE_CTE}
      SELECT
        (SELECT COUNT(*)::int FROM expected_pairs) AS "expectedActivePairs",
        (SELECT COUNT(*)::int FROM missing) AS "missingEnrollments",
        (SELECT COUNT(*)::int FROM reactivations) AS reactivations,
        (SELECT COUNT(*)::int FROM pause_extras) AS "pauseExtras",
        (SELECT COUNT(*)::int FROM target WHERE "studentId" IS NULL) AS "unresolvedLedgerRows",
        (SELECT COUNT(*)::int FROM missing_class_slots) AS "missingClassSlots",
        (SELECT COUNT(*)::int FROM outside_scope) AS "outsideScopeActiveStudents"
    `),
    prisma.$queryRawUnsafe<ReconcileSampleRow[]>(`
      ${RECONCILE_CTE}
      SELECT "studentId", "studentName", "slotKey"
      FROM missing
      ORDER BY "slotKey", "studentName"
      LIMIT 8
    `),
    prisma.$queryRawUnsafe<ReconcileSampleRow[]>(`
      ${RECONCILE_CTE}
      SELECT "studentId", "studentName", "slotKey", "currentStatus"
      FROM reactivations
      ORDER BY "slotKey", "studentName"
      LIMIT 8
    `),
    prisma.$queryRawUnsafe<ReconcileSampleRow[]>(`
      ${RECONCILE_CTE}
      SELECT "studentId", "studentName", "slotKey", "currentStatus", "targetStatus"
      FROM pause_extras
      ORDER BY "slotKey", "studentName"
      LIMIT 8
    `),
  ]);

  const summary = summaryRows[0];
  return {
    batchId,
    expectedActivePairs: summary?.expectedActivePairs ?? 0,
    missingEnrollments: summary?.missingEnrollments ?? 0,
    reactivations: summary?.reactivations ?? 0,
    pauseExtras: summary?.pauseExtras ?? 0,
    unresolvedLedgerRows: summary?.unresolvedLedgerRows ?? 0,
    missingClassSlots: summary?.missingClassSlots ?? 0,
    outsideScopeActiveStudents: summary?.outsideScopeActiveStudents ?? 0,
    samples: { missing, reactivations, pauseExtras },
  };
}

function revalidateReconcileCaches() {
  for (const tag of ["admin-students", "admin-student-imports", "admin-classes", "admin-schedule", "admin-dashboard"]) {
    revalidateTag(tag, { expire: 0 });
  }

  revalidatePath("/admin/students");
  revalidatePath("/admin/classes");
  revalidatePath("/admin/schedule");
}

export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "인증 필요" }, { status: 401 });
  }

  try {
    return NextResponse.json(await getPreview());
  } catch (error) {
    console.error("[api/admin/import-students/reconcile] preview failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "수강 등록 정합성 점검에 실패했습니다." },
      { status: 500 },
    );
  }
}

export async function POST() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "인증 필요" }, { status: 401 });
  }

  try {
    const before = await getPreview();
    if (!before.batchId) {
      return NextResponse.json({ error: "완료된 수강생 이관 배치가 없습니다." }, { status: 400 });
    }

    const [created, reactivated, paused] = await prisma.$transaction([
      prisma.$executeRawUnsafe(`
        ${RECONCILE_CTE}
        INSERT INTO "Enrollment" (id, "studentId", "classId", status, "createdAt", "updatedAt")
        SELECT gen_random_uuid()::text, "studentId", "classId", 'ACTIVE', NOW(), NOW()
        FROM missing
      `),
      prisma.$executeRawUnsafe(`
        ${RECONCILE_CTE}
        UPDATE "Enrollment" e
        SET status = 'ACTIVE', "updatedAt" = NOW()
        FROM reactivations r
        WHERE e."studentId" = r."studentId"
          AND e."classId" = r."classId"
      `),
      prisma.$executeRawUnsafe(`
        ${RECONCILE_CTE}
        UPDATE "Enrollment" e
        SET status = p."targetStatus", "updatedAt" = NOW()
        FROM pause_extras p
        WHERE e.id = p.id
      `),
    ]);

    revalidateReconcileCaches();
    const after = await getPreview();

    return NextResponse.json({
      success: true,
      batchId: before.batchId,
      applied: {
        created,
        reactivated,
        paused,
      },
      before,
      after,
    });
  } catch (error) {
    console.error("[api/admin/import-students/reconcile] apply failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "수강 등록 정합성 적용에 실패했습니다." },
      { status: 500 },
    );
  }
}
