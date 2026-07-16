import { NextRequest, NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";

import { requireAdmin } from "@/lib/auth-guard";
import { ensureInvoicesForMonth, markOverduePayments, syncInvoiceStatusesForMonth } from "@/lib/payment-ledger";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type ReconcileAction = "CREATE" | "UPDATE" | "UNCHANGED" | "REVIEW";

type ReconcileSummaryRow = {
  action: ReconcileAction;
  count: number;
  amount: number;
};

type ReconcileSampleRow = {
  studentId: string;
  studentName: string;
  rowCount: number;
  paymentMethods: string[] | null;
  targetStatus: string | null;
  targetAmount: number | null;
  targetMethod: string | null;
  existingStatus: string | null;
  existingAmount: number | null;
  existingMethod: string | null;
  reviewReason: string | null;
  action: ReconcileAction;
};

type BatchRow = {
  id: string;
  createdAt: Date;
  completedAt: Date | null;
  spreadsheetTitle: string | null;
};

const PAID_METHODS_SQL = "'랠리즈', '카드결제', '카드', '현금영수증', '현금'";
const UNPAID_METHODS_SQL = "'미납', '미결제'";

function parseTarget(searchParams: URLSearchParams) {
  const now = new Date();
  const year = Number(searchParams.get("year") ?? now.getFullYear());
  const month = Number(searchParams.get("month") ?? now.getMonth() + 1);

  if (!Number.isInteger(year) || year < 2020 || year > 2035) {
    throw new Error("유효한 연도를 입력해 주세요.");
  }

  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error("유효한 월을 입력해 주세요.");
  }

  return { year, month };
}

function buildReconcileCte() {
  return `
    WITH latest AS (
      SELECT id, "createdAt", "completedAt", "spreadsheetTitle"
      FROM "StudentSheetImportBatch"
      WHERE status = 'COMPLETED'
      ORDER BY "createdAt" DESC
      LIMIT 1
    ),
    ledger AS (
      SELECT
        r.*,
        NULLIF(substring(COALESCE(r."registrationMonth", '') from '([0-9]{4})[[:space:]]*년'), '')::int AS "targetYear",
        NULLIF(substring(COALESCE(r."registrationMonth", '') from '([0-9]{1,2})[[:space:]]*월'), '')::int AS "targetMonth"
      FROM "StudentRegistrationLedger" r
      JOIN latest ON latest.id = r."batchId"
    ),
    target AS (
      SELECT *
      FROM ledger
      WHERE "targetYear" = $1
        AND "targetMonth" = $2
        AND "studentId" IS NOT NULL
    ),
    grouped AS (
      SELECT
        "studentId",
        MAX("studentName") AS "studentName",
        COUNT(*)::int AS "rowCount",
        array_remove(array_agg(DISTINCT "paymentMethod"), NULL) AS "paymentMethods",
        CASE
          WHEN BOOL_OR(status = 'ACTIVE') THEN 'ACTIVE'
          WHEN BOOL_OR(status = 'PAUSED') THEN 'PAUSED'
          ELSE 'WITHDRAWN'
        END AS "targetEnrollmentStatus",
        SUM(
          CASE
            WHEN "paymentMethod" IN (${PAID_METHODS_SQL})
            THEN COALESCE("paymentAmount", 0)
            ELSE 0
          END
        )::int AS "paidAmount",
        SUM(
          CASE
            WHEN status = 'ACTIVE' AND "paymentMethod" IN (${UNPAID_METHODS_SQL})
            THEN GREATEST(COALESCE("tuitionAmount", 0) + COALESCE("shuttleFee", 0) - COALESCE("carryOverAmount", 0), 0)
            ELSE 0
          END
        )::int AS "pendingAmount",
        BOOL_OR("paymentMethod" = '추가수강') AS "hasReviewOnlyMethod",
        BOOL_OR("paymentMethod" = '이월') AS "hasCarryOverOnlyMethod",
        MAX("paymentDate") AS "paymentDate"
      FROM target
      GROUP BY "studentId"
    ),
    targets AS (
      SELECT
        *,
        CASE
          WHEN "targetEnrollmentStatus" <> 'ACTIVE' THEN 'CANCELED'
          WHEN "paidAmount" > 0 AND "pendingAmount" = 0 THEN 'PAID'
          WHEN "pendingAmount" > 0 AND "paidAmount" = 0 THEN 'PENDING'
          WHEN "paidAmount" = 0 AND "pendingAmount" = 0 AND "hasCarryOverOnlyMethod" THEN 'CANCELED'
          ELSE NULL
        END AS "targetStatus",
        CASE
          WHEN "targetEnrollmentStatus" <> 'ACTIVE' THEN 0
          WHEN "paidAmount" > 0 AND "pendingAmount" = 0 THEN "paidAmount"
          WHEN "pendingAmount" > 0 AND "paidAmount" = 0 THEN "pendingAmount"
          WHEN "paidAmount" = 0 AND "pendingAmount" = 0 AND "hasCarryOverOnlyMethod" THEN 0
          ELSE NULL
        END AS "targetAmount",
        CASE
          WHEN "targetEnrollmentStatus" = 'PAUSED' THEN '휴원'
          WHEN "targetEnrollmentStatus" = 'WITHDRAWN' THEN '퇴원'
          WHEN "paidAmount" > 0 AND "pendingAmount" = 0 THEN
            CASE
              WHEN array_length(array_remove(array_agg_method."paidMethods", NULL), 1) > 1 THEN 'MIXED'
              WHEN '랠리즈' = ANY(array_agg_method."paidMethods") THEN 'RALLYZ'
              WHEN '카드결제' = ANY(array_agg_method."paidMethods") OR '카드' = ANY(array_agg_method."paidMethods") THEN 'CARD'
              WHEN '현금영수증' = ANY(array_agg_method."paidMethods") OR '현금' = ANY(array_agg_method."paidMethods") THEN 'CASH'
              ELSE 'PAID'
            END
          WHEN "pendingAmount" > 0 AND "paidAmount" = 0 THEN 'UNPAID'
          WHEN "paidAmount" = 0 AND "pendingAmount" = 0 AND "hasCarryOverOnlyMethod" THEN 'CARRY_OVER'
          ELSE NULL
        END AS "targetMethod",
        CASE
          WHEN "targetEnrollmentStatus" <> 'ACTIVE' THEN '휴원/퇴원 상태라 자동 청구에서 제외했습니다.'
          WHEN "paidAmount" > 0 AND "pendingAmount" > 0 THEN '납부와 미납 행이 함께 있어 수동 확인이 필요합니다.'
          WHEN "paidAmount" = 0 AND "pendingAmount" = 0 AND "hasReviewOnlyMethod" THEN '추가수강 행만 있어 수동 확인이 필요합니다.'
          WHEN "paidAmount" = 0 AND "pendingAmount" = 0 AND "hasCarryOverOnlyMethod" THEN '이월 행만 있어 청구/미납으로 반영하지 않았습니다.'
          WHEN "paidAmount" = 0 AND "pendingAmount" = 0 THEN '청구 또는 납부 금액이 없습니다.'
          ELSE NULL
        END AS "reviewReason"
      FROM grouped
      CROSS JOIN LATERAL (
        SELECT array_remove(array_agg(DISTINCT method), NULL) AS "paidMethods"
        FROM unnest(grouped."paymentMethods") AS method
        WHERE method IN (${PAID_METHODS_SQL})
      ) AS array_agg_method
    ),
    existing AS (
      SELECT DISTINCT ON (p."studentId")
        p.id,
        p."studentId",
        p.amount,
        p.status,
        p.method
      FROM "Payment" p
      WHERE p.year = $1
        AND p.month = $2
        AND p.type = 'MONTHLY'
      ORDER BY p."studentId", p."createdAt" DESC
    ),
    actions AS (
      SELECT
        t.*,
        e.id AS "paymentId",
        e.amount AS "existingAmount",
        e.status AS "existingStatus",
        e.method AS "existingMethod",
        CASE
          WHEN t."targetStatus" IS NULL THEN 'REVIEW'
          WHEN t."targetStatus" = 'CANCELED' AND e.id IS NULL THEN 'REVIEW'
          WHEN e.id IS NULL AND COALESCE(t."targetAmount", 0) > 0 THEN 'CREATE'
          WHEN e.id IS NULL THEN 'REVIEW'
          WHEN t."targetStatus" = 'CANCELED'
            AND (e.status <> 'CANCELED' OR COALESCE(e.method, '') <> COALESCE(t."targetMethod", ''))
          THEN 'UPDATE'
          WHEN t."targetStatus" = 'CANCELED' THEN 'UNCHANGED'
          WHEN t."targetStatus" = 'PENDING'
            AND e.status = 'OVERDUE'
            AND e.amount = t."targetAmount"
            AND COALESCE(e.method, '') = COALESCE(t."targetMethod", '')
          THEN 'UNCHANGED'
          WHEN e.amount <> t."targetAmount"
            OR e.status <> t."targetStatus"
            OR COALESCE(e.method, '') <> COALESCE(t."targetMethod", '')
          THEN 'UPDATE'
          ELSE 'UNCHANGED'
        END AS action
      FROM targets t
      LEFT JOIN existing e ON e."studentId" = t."studentId"
    )
  `;
}

async function getLatestBatch(): Promise<BatchRow | null> {
  const rows = await prisma.$queryRawUnsafe<BatchRow[]>(`
    SELECT id, "createdAt", "completedAt", "spreadsheetTitle"
    FROM "StudentSheetImportBatch"
    WHERE status = 'COMPLETED'
    ORDER BY "createdAt" DESC
    LIMIT 1
  `);

  return rows[0] ?? null;
}

async function getPreview(year: number, month: number) {
  const cte = buildReconcileCte();
  const [batch, summaryRows, samples] = await Promise.all([
    getLatestBatch(),
    prisma.$queryRawUnsafe<ReconcileSummaryRow[]>(
      `
      ${cte}
      SELECT action, COUNT(*)::int AS count, COALESCE(SUM(COALESCE("targetAmount", 0)), 0)::int AS amount
      FROM actions
      GROUP BY action
      ORDER BY action
      `,
      year,
      month,
    ),
    prisma.$queryRawUnsafe<ReconcileSampleRow[]>(
      `
      ${cte}
      SELECT
        "studentId",
        "studentName",
        "rowCount",
        "paymentMethods",
        "targetStatus",
        "targetAmount",
        "targetMethod",
        "existingStatus",
        "existingAmount",
        "existingMethod",
        "reviewReason",
        action
      FROM actions
      WHERE action <> 'UNCHANGED'
      ORDER BY
        CASE action WHEN 'UPDATE' THEN 1 WHEN 'CREATE' THEN 2 ELSE 3 END,
        "studentName"
      LIMIT 20
      `,
      year,
      month,
    ),
  ]);

  const summary = {
    create: 0,
    update: 0,
    unchanged: 0,
    review: 0,
    createAmount: 0,
    updateAmount: 0,
    reviewAmount: 0,
  };

  for (const row of summaryRows) {
    const count = Number(row.count ?? 0);
    const amount = Number(row.amount ?? 0);
    if (row.action === "CREATE") {
      summary.create = count;
      summary.createAmount = amount;
    } else if (row.action === "UPDATE") {
      summary.update = count;
      summary.updateAmount = amount;
    } else if (row.action === "UNCHANGED") {
      summary.unchanged = count;
    } else if (row.action === "REVIEW") {
      summary.review = count;
      summary.reviewAmount = amount;
    }
  }

  return {
    batch,
    year,
    month,
    summary,
    samples,
  };
}

function revalidateFinance() {
  revalidatePath("/admin/finance");
  revalidatePath("/admin/stats");
  revalidatePath("/admin/students");
  revalidateTag("admin-finance", { expire: 0 });
  revalidateTag("admin-stats", { expire: 0 });
  revalidateTag("admin-students", { expire: 0 });
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const { year, month } = parseTarget(request.nextUrl.searchParams);
    return NextResponse.json(await getPreview(year, month));
  } catch (error) {
    console.error("[api/admin/finance/sheet-reconcile] preview failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "시트 기준 수납 점검에 실패했습니다." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const { year, month } = parseTarget(request.nextUrl.searchParams);
    const before = await getPreview(year, month);
    const cte = buildReconcileCte();
    const dueDate = `${year}-${String(month).padStart(2, "0")}-10`;
    const description = `${year}년 ${month}월 수강료(시트 원장 기준)`;

    const [updated, created] = await prisma.$transaction([
      prisma.$executeRawUnsafe(
        `
        ${cte},
        ready AS (
          SELECT *
          FROM actions
          WHERE action = 'UPDATE'
        )
        UPDATE "Payment" p
        SET amount = CASE
              WHEN ready."targetStatus" = 'CANCELED' THEN p.amount
              ELSE ready."targetAmount"
            END,
            status = ready."targetStatus",
            method = ready."targetMethod",
            "dueDate" = $3::timestamp,
            "paidDate" = CASE
              WHEN ready."targetStatus" = 'PAID' THEN COALESCE(ready."paymentDate", p."paidDate", NOW())
              ELSE NULL
            END,
            description = CASE
              WHEN ready."targetStatus" = 'CANCELED' AND ready."targetMethod" = 'CARRY_OVER' THEN CONCAT($4, ' - 이월 처리')
              WHEN ready."targetStatus" = 'CANCELED' THEN CONCAT($4, ' - 청구 제외')
              ELSE $4
            END,
            "autoGenerated" = false,
            "updatedAt" = NOW()
        FROM ready
        WHERE p.id = ready."paymentId"
        `,
        year,
        month,
        dueDate,
        description,
      ),
      prisma.$executeRawUnsafe(
        `
        ${cte},
        ready AS (
          SELECT *
          FROM actions
          WHERE action = 'CREATE'
        )
        INSERT INTO "Payment" (
          id, "studentId", amount, status, "dueDate", "paidDate",
          type, method, description, month, year, "autoGenerated", "createdAt", "updatedAt"
        )
        SELECT
          gen_random_uuid()::text,
          "studentId",
          "targetAmount",
          "targetStatus",
          $3::timestamp,
          CASE WHEN "targetStatus" = 'PAID' THEN COALESCE("paymentDate", NOW()) ELSE NULL END,
          'MONTHLY',
          "targetMethod",
          $4,
          $2,
          $1,
          false,
          NOW(),
          NOW()
        FROM ready
        `,
        year,
        month,
        dueDate,
        description,
      ),
    ]);

    const invoiceResult = await ensureInvoicesForMonth(year, month);
    const overdueResult = await markOverduePayments();
    const invoiceSyncResult = await syncInvoiceStatusesForMonth(year, month);

    revalidateFinance();
    const after = await getPreview(year, month);

    return NextResponse.json({
      success: true,
      applied: {
        updated,
        created,
        invoices: invoiceResult.invoiceCount,
        overdue: overdueResult.updated,
        invoiceStatusSynced: invoiceSyncResult.updated,
      },
      before,
      after,
    });
  } catch (error) {
    console.error("[api/admin/finance/sheet-reconcile] apply failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "시트 기준 수납 적용에 실패했습니다." },
      { status: 500 },
    );
  }
}
