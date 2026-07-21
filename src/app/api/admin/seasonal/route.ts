import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";
import { cleanText, SeasonalError } from "@/lib/seasonal/contracts";
import { ensureInvoiceForPayment, ensurePaymentInfrastructure } from "@/lib/payment-ledger";
import { Prisma } from "@prisma/client";
import { classifyAdminAuthError } from "./auth-error";
import { syncOfferingSessionDates } from "@/lib/seasonal/session-bridge";
import { issueParentAccountClaim } from "@/lib/parent-account-claim";

const SEASON_STATUSES = new Set(["DRAFT", "PUBLISHED", "CLOSED", "ARCHIVED"]);
const OFFERING_STATUSES = new Set(["DRAFT", "OPEN", "CLOSED", "CANCELLED"]);
const APPLICATION_STATUSES = new Set(["PENDING", "PARTIALLY_WAITLISTED", "APPROVED", "REJECTED", "CANCELLED"]);
const ITEM_STATUSES = new Set(["PENDING", "WAITLISTED", "APPROVED", "REJECTED", "CANCELLED"]);
type SessionDateInput = { id?: unknown; startsAt?: unknown; endsAt?: unknown; location?: unknown; note?: unknown };
type ConversionResult = { itemId: string; studentId: string; enrollmentId: string; paymentId: string; invoiceId: string | null; activationUrl: string | null; activationRequired: boolean };
type AdminApplicationRow = Record<string, unknown> & {
  items: Array<Record<string, unknown> & { paymentId?: string | null }>;
};
type BulkItemResult = {
  itemId: string;
  ok: boolean;
  status?: string;
  applicationId?: string;
  invoiceId?: string | null;
  activationUrl?: string | null;
  activationRequired?: boolean;
  message?: string;
  code?: string;
};

async function admin() {
  try {
    return await requireAdmin();
  } catch (error) {
    const authFailure = classifyAdminAuthError(error);
    if (authFailure) {
      throw new SeasonalError(authFailure.message, authFailure.status, authFailure.code);
    }
    throw error;
  }
}

function date(value: unknown, label: string) {
  const parsed = new Date(String(value || ""));
  if (Number.isNaN(parsed.getTime())) throw new SeasonalError(`${label}을 확인해 주세요.`);
  return parsed;
}

function nonNegativeInt(value: unknown, label: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) throw new SeasonalError(`${label}은 0 이상의 정수여야 합니다.`);
  return parsed;
}

function optionalNonNegativeInt(value: unknown, label: string) {
  if (value === undefined || value === null || value === "") return null;
  return nonNegativeInt(value, label);
}

function normalizeDigits(value: string) {
  return value.replace(/[^0-9]/g, "");
}

function defaultPaymentDueDate() {
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 7);
  return dueDate;
}

async function ensureApplicationCapacity(tx: Prisma.TransactionClient, applicationId: string) {
  const items = await tx.specialProgramApplicationItem.findMany({
    where: { applicationId },
    select: { id: true, offeringId: true },
    orderBy: { offeringId: "asc" },
  });
  for (const item of items) {
    await tx.$queryRaw`SELECT id FROM "SpecialProgramOffering" WHERE id = ${item.offeringId} FOR UPDATE`;
    const [offering, occupied] = await Promise.all([
      tx.specialProgramOffering.findUnique({ where: { id: item.offeringId } }),
      tx.specialProgramApplicationItem.count({
        where: { offeringId: item.offeringId, status: { in: ["PENDING", "APPROVED"] } },
      }),
    ]);
    if (!offering || offering.capacity === null) throw new SeasonalError("정원이 정해지지 않은 반은 승인할 수 없습니다.", 409, "CAPACITY_REQUIRED");
    if (occupied > offering.capacity) throw new SeasonalError("정원이 가득 차 신청을 승인할 수 없습니다.", 409, "CAPACITY_FULL");
  }
}

function applicationStatusFromItemStatuses(statuses: string[]) {
  if (statuses.every((status) => status === "APPROVED")) return "APPROVED";
  if (statuses.every((status) => status === "REJECTED")) return "REJECTED";
  if (statuses.every((status) => status === "CANCELLED")) return "CANCELLED";
  if (statuses.includes("WAITLISTED")) return "PARTIALLY_WAITLISTED";
  return "PENDING";
}

function parseBulkItemIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map((item) => cleanText(item, 100)).filter((item): item is string => Boolean(item))));
}

function bulkErrorResult(itemId: string, error: unknown): BulkItemResult {
  if (error instanceof SeasonalError) {
    return { itemId, ok: false, message: error.message, code: error.code };
  }
  console.error("[admin seasonal bulk item]", error);
  return { itemId, ok: false, message: "처리 중 오류가 발생했습니다.", code: "BULK_ITEM_FAILED" };
}

async function updateSpecialProgramItemStatus(
  tx: Prisma.TransactionClient,
  params: { itemId: string; status: string; actorId: string; enrollmentId?: unknown; paymentId?: unknown },
) {
  const before = await tx.specialProgramApplicationItem.findUnique({ where: { id: params.itemId }, include: { application: true } });
  if (!before) throw new SeasonalError("신청 항목을 찾을 수 없습니다.", 404);
  if (params.status === "APPROVED" && (before.application.requiresReview || before.application.reviewReasons.length > 0)) {
    throw new SeasonalError("검토 필요 사유를 먼저 확인하고 검토 완료 처리해 주세요.", 409, "APPLICATION_REVIEW_REQUIRED");
  }

  await tx.$queryRaw`SELECT id FROM "SpecialProgramOffering" WHERE id = ${before.offeringId} FOR UPDATE`;
  if (["PENDING", "APPROVED"].includes(params.status)) {
    const [offering, occupied] = await Promise.all([
      tx.specialProgramOffering.findUnique({ where: { id: before.offeringId } }),
      tx.specialProgramApplicationItem.count({ where: { offeringId: before.offeringId, id: { not: params.itemId }, status: { in: ["PENDING", "APPROVED"] } } }),
    ]);
    if (!offering || offering.capacity === null) throw new SeasonalError("정원이 정해지지 않은 반은 승인할 수 없습니다.", 409, "CAPACITY_REQUIRED");
    if (occupied >= offering.capacity) throw new SeasonalError("정원이 가득 차 승인할 수 없습니다.", 409, "CAPACITY_FULL");
  }

  let waitlistOrder = before.waitlistOrder;
  if (params.status === "WAITLISTED" && !waitlistOrder) {
    const last = await tx.specialProgramApplicationItem.aggregate({ where: { offeringId: before.offeringId, status: "WAITLISTED" }, _max: { waitlistOrder: true } });
    waitlistOrder = (last._max.waitlistOrder || 0) + 1;
  }

  const item = await tx.specialProgramApplicationItem.update({
    where: { id: params.itemId },
    data: {
      status: params.status,
      waitlistOrder: params.status === "WAITLISTED" ? waitlistOrder : null,
      enrollmentId: cleanText(params.enrollmentId, 100),
      paymentId: cleanText(params.paymentId, 100),
    },
  });
  const siblings = await tx.specialProgramApplicationItem.findMany({
    where: { applicationId: before.applicationId },
    select: { status: true },
  });
  await tx.specialProgramApplication.update({
    where: { id: before.applicationId },
    data: { status: applicationStatusFromItemStatuses(siblings.map((row) => row.status)), processedAt: new Date(), processedByUserId: params.actorId },
  });
  await tx.specialProgramAuditLog.create({
    data: {
      seasonId: before.application.seasonId,
      offeringId: item.offeringId,
      applicationId: item.applicationId,
      itemId: params.itemId,
      actorType: "ADMIN",
      actorId: params.actorId,
      action: "ITEM_STATUS_UPDATED",
      beforeJSON: before,
      afterJSON: item,
    },
  });
  return item;
}

function respondError(error: unknown) {
  if (error instanceof SeasonalError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002" && JSON.stringify(error.meta?.target ?? "").toLowerCase().includes("code")) {
    return NextResponse.json({ error: "같은 시즌에 이미 사용 중인 반 코드입니다. 다른 코드를 입력해 주세요.", code: "OFFERING_CODE_DUPLICATED" }, { status: 409 });
  }
  console.error("[admin seasonal]", error);
  return NextResponse.json({ error: "방학특강 관리 작업에 실패했습니다." }, { status: 500 });
}

export async function GET(request: NextRequest) {
  try {
    await admin();
    const seasonId = request.nextUrl.searchParams.get("seasonId") || undefined;
    const includeApplications = request.nextUrl.searchParams.get("includeApplications") === "true";
    const seasons = await prisma.specialProgramSeason.findMany({
      where: seasonId ? { id: seasonId } : undefined,
      orderBy: { startsAt: "desc" },
      include: {
        offerings: { orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }], include: { sessionDates: { orderBy: { startsAt: "asc" } }, _count: { select: { applicationItems: true } } } },
        applications: includeApplications ? {
          orderBy: { createdAt: "desc" },
          include: {
            items: {
              include: {
                offering: { select: { title: true, code: true, linkedProgramId: true, linkedClassId: true } },
                shuttleRequest: true,
              },
            },
          },
        } : false,
      },
    });
    const applicationRows: AdminApplicationRow[] = includeApplications
      ? seasons.flatMap((season) => ((season as unknown as { applications?: AdminApplicationRow[] }).applications ?? []))
      : [];
    const paymentIds = Array.from(new Set(
      applicationRows.flatMap((application) => application.items.map((item) => item.paymentId).filter(Boolean) as string[]),
    ));
    const invoiceRows = paymentIds.length
      ? await prisma.paymentInvoice.findMany({
          where: { paymentId: { in: paymentIds } },
          select: { id: true, paymentId: true, invoiceNo: true, status: true, amount: true, dueDate: true, checkoutUrl: true },
        })
      : [];
    const invoicesByPaymentId = new Map(invoiceRows.map((invoice) => [invoice.paymentId, invoice]));
    const activationRows = invoiceRows.length
      ? await prisma.$queryRawUnsafe<Array<{ paymentId: string; activationRequired: boolean }>>(
          `SELECT i."paymentId", (u.email ~* '^(parent_[0-9]+@stiz\\.local|[0-9]+@import\\.local)$') AS "activationRequired"
             FROM "PaymentInvoice" i JOIN "User" u ON u.id = i."parentId"
            WHERE i.id = ANY($1::text[])`,
          invoiceRows.map((invoice) => invoice.id),
        )
      : [];
    const activationByPaymentId = new Map(activationRows.map((row) => [row.paymentId, row.activationRequired]));
    const applications = applicationRows.map((application) => ({
      ...application,
      items: application.items.map((item) => ({
        ...item,
        invoice: item.paymentId
          ? (() => {
              const invoice = invoicesByPaymentId.get(item.paymentId);
              return invoice ? { ...invoice, accountActivationRequired: activationByPaymentId.get(item.paymentId) ?? false } : null;
            })()
          : null,
      })),
    }));

    return NextResponse.json({
      seasons,
      applications,
    });
  } catch (error) { return respondError(error); }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await admin();
    const body = await request.json();
    const data = body?.data || {};
    if (body?.resource === "season") {
      const title = cleanText(data.title, 150);
      const slug = cleanText(data.slug, 100)?.toLowerCase();
      if (!title || !slug || !/^[a-z0-9-]+$/.test(slug)) throw new SeasonalError("시즌 이름과 영문 주소를 확인해 주세요.");
      const applicationOpensAt = date(data.applicationOpensAt, "신청 시작일");
      const applicationClosesAt = date(data.applicationClosesAt, "신청 마감일");
      const startsAt = date(data.startsAt, "수업 시작일");
      const endsAt = date(data.endsAt, "수업 종료일");
      if (applicationClosesAt <= applicationOpensAt || endsAt < startsAt) throw new SeasonalError("시작일과 종료일의 순서를 확인해 주세요.");
      const status = SEASON_STATUSES.has(data.status) ? data.status : "DRAFT";
      const season = await prisma.specialProgramSeason.create({ data: { slug, title, description: cleanText(data.description, 5000), applicationOpensAt, applicationClosesAt, startsAt, endsAt, status, termsText: cleanText(data.termsText, 10000), cancellationPolicy: cleanText(data.cancellationPolicy, 10000) } });
      await prisma.specialProgramAuditLog.create({ data: { seasonId: season.id, actorType: "ADMIN", actorId: actor.appUserId, action: "SEASON_CREATED", afterJSON: season } });
      return NextResponse.json({ season }, { status: 201 });
    }
    if (body?.resource === "offering") {
      const seasonId = cleanText(data.seasonId, 100);
      const title = cleanText(data.title, 150);
      const code = cleanText(data.code, 80)?.toUpperCase();
      if (!seasonId || !title || !code) throw new SeasonalError("시즌, 특강명, 코드는 필수입니다.");
      const capacity = optionalNonNegativeInt(data.capacity, "정원");
      const price = nonNegativeInt(data.price, "가격");
      const status = OFFERING_STATUSES.has(data.status) ? data.status : "DRAFT";
      const linkedClassId = cleanText(data.linkedClassId, 100) || null;
      const instructorId = cleanText(data.instructorId, 100) || null;
      if (status === "OPEN" && capacity === null) throw new SeasonalError("정원이 정해지지 않은 반은 공개할 수 없습니다.", 409, "CAPACITY_REQUIRED");
      const sessionDates = Array.isArray(data.sessionDates) ? (data.sessionDates as SessionDateInput[]).map((row) => ({ startsAt: date(row.startsAt, "수업 시작 시각"), endsAt: date(row.endsAt, "수업 종료 시각"), location: cleanText(row.location, 150), note: cleanText(row.note, 500) })) : [];
      if (sessionDates.some((row: { startsAt: Date; endsAt: Date }) => row.endsAt <= row.startsAt)) throw new SeasonalError("수업 종료 시각은 시작 시각보다 늦어야 합니다.");
      if (status === "OPEN" && sessionDates.length === 0) throw new SeasonalError("모집 중인 반은 수업 일정을 한 개 이상 등록해야 합니다.", 409, "SESSION_DATE_REQUIRED");
      if (status === "OPEN" && (!linkedClassId || !instructorId)) throw new SeasonalError("모집 중인 반은 연결 반과 담당 강사를 지정해야 합니다.", 409, "ATTENDANCE_LINK_REQUIRED");
      const offering = await prisma.$transaction(async (tx) => {
        const created = await tx.specialProgramOffering.create({ data: { seasonId, code, title, description: cleanText(data.description, 5000), targetGrades: cleanText(data.targetGrades, 200), instructorId, instructorName: cleanText(data.instructorName, 100), location: cleanText(data.location, 150), capacity, price, newApplicantPrice: optionalNonNegativeInt(data.newApplicantPrice, "신규 회원 가격"), existingApplicantPrice: optionalNonNegativeInt(data.existingApplicantPrice, "기존 회원 가격"), shuttleAvailable: Boolean(data.shuttleAvailable), status, displayOrder: Number.isInteger(data.displayOrder) ? data.displayOrder : 0, linkedProgramId: cleanText(data.linkedProgramId, 100), linkedClassId } });
        await syncOfferingSessionDates(tx, { offeringId: created.id, linkedClassId, instructorId, dates: sessionDates });
        return tx.specialProgramOffering.findUniqueOrThrow({ where: { id: created.id }, include: { sessionDates: { orderBy: { startsAt: "asc" } } } });
      });
      await prisma.specialProgramAuditLog.create({ data: { seasonId, offeringId: offering.id, actorType: "ADMIN", actorId: actor.appUserId, action: "OFFERING_CREATED", afterJSON: offering } });
      return NextResponse.json({ offering }, { status: 201 });
    }
    throw new SeasonalError("지원하지 않는 생성 대상입니다.");
  } catch (error) { return respondError(error); }
}

export async function PATCH(request: NextRequest) {
  try {
    const actor = await admin();
    const body = await request.json();
    const data = body?.data || {};
    if (body.resource === "bulkItems") {
      const status = cleanText(data.status, 30);
      if (!status || !ITEM_STATUSES.has(status)) throw new SeasonalError("일괄 처리 상태가 올바르지 않습니다.");
      const itemIds = parseBulkItemIds(data.itemIds);
      if (itemIds.length === 0) throw new SeasonalError("선택된 신청 항목이 없습니다.");
      if (itemIds.length > 100) throw new SeasonalError("한 번에 100개까지만 처리할 수 있습니다.", 413, "BULK_LIMIT_EXCEEDED");

      const results: BulkItemResult[] = [];
      for (const itemId of itemIds) {
        try {
          const item = await prisma.$transaction(
            (tx) => updateSpecialProgramItemStatus(tx, { itemId, status, actorId: actor.appUserId }),
            { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
          );
          results.push({ itemId, ok: true, status: item.status, applicationId: item.applicationId });
        } catch (error) {
          results.push(bulkErrorResult(itemId, error));
        }
      }

      const summary = {
        total: results.length,
        succeeded: results.filter((result) => result.ok).length,
        failed: results.filter((result) => !result.ok).length,
      };
      return NextResponse.json({ success: summary.failed === 0, summary, results });
    }

    if (body.resource === "bulkConversion") {
      const itemIds = parseBulkItemIds(data.itemIds);
      if (itemIds.length === 0) throw new SeasonalError("선택된 신청 항목이 없습니다.");
      if (itemIds.length > 50) throw new SeasonalError("수강·청구 생성은 한 번에 50개까지만 처리할 수 있습니다.", 413, "BULK_CONVERSION_LIMIT_EXCEEDED");

      const results: BulkItemResult[] = [];
      for (const itemId of itemIds) {
        try {
          const result = await convertApprovedItemToEnrollmentAndInvoice(itemId, actor.appUserId);
          results.push({
            itemId,
            ok: true,
            invoiceId: result.invoiceId,
            activationUrl: result.activationUrl,
            activationRequired: result.activationRequired,
          });
        } catch (error) {
          results.push(bulkErrorResult(itemId, error));
        }
      }

      const summary = {
        total: results.length,
        succeeded: results.filter((result) => result.ok).length,
        failed: results.filter((result) => !result.ok).length,
      };
      return NextResponse.json({ success: summary.failed === 0, summary, results });
    }

    const id = cleanText(body?.id, 100);
    if (!id) throw new SeasonalError("수정 대상 ID가 필요합니다.");

    if (body.resource === "season") {
      const before = await prisma.specialProgramSeason.findUnique({ where: { id } });
      if (!before) throw new SeasonalError("시즌을 찾을 수 없습니다.", 404);
      const update: Record<string, unknown> = {};
      if (data.title !== undefined) update.title = cleanText(data.title, 150);
      if (data.description !== undefined) update.description = cleanText(data.description, 5000) || null;
      if (data.status !== undefined) { if (!SEASON_STATUSES.has(data.status)) throw new SeasonalError("시즌 상태가 올바르지 않습니다."); update.status = data.status; }
      for (const key of ["applicationOpensAt", "applicationClosesAt", "startsAt", "endsAt"] as const) if (data[key] !== undefined) update[key] = date(data[key], key);
      if (data.termsText !== undefined) update.termsText = cleanText(data.termsText, 10000) || null;
      if (data.cancellationPolicy !== undefined) update.cancellationPolicy = cleanText(data.cancellationPolicy, 10000) || null;
      const season = await prisma.specialProgramSeason.update({ where: { id }, data: update });
      await prisma.specialProgramAuditLog.create({ data: { seasonId: id, actorType: "ADMIN", actorId: actor.appUserId, action: "SEASON_UPDATED", beforeJSON: before, afterJSON: season } });
      return NextResponse.json({ season });
    }

    if (body.resource === "offering") {
      const before = await prisma.specialProgramOffering.findUnique({ where: { id } });
      if (!before) throw new SeasonalError("특강을 찾을 수 없습니다.", 404);
      const update: Record<string, unknown> = {};
      if (data.code !== undefined) {
        const code = cleanText(data.code, 80)?.toUpperCase();
        if (!code) throw new SeasonalError("반 코드를 입력해 주세요.");
        update.code = code;
      }
      for (const key of ["title", "description", "targetGrades", "instructorId", "instructorName", "location", "linkedProgramId", "linkedClassId"] as const) if (data[key] !== undefined) update[key] = cleanText(data[key], key === "description" ? 5000 : 200) || null;
      if (data.capacity !== undefined) update.capacity = optionalNonNegativeInt(data.capacity, "정원");
      if (data.price !== undefined) update.price = nonNegativeInt(data.price, "가격");
      if (data.newApplicantPrice !== undefined) update.newApplicantPrice = optionalNonNegativeInt(data.newApplicantPrice, "신규 회원 가격");
      if (data.existingApplicantPrice !== undefined) update.existingApplicantPrice = optionalNonNegativeInt(data.existingApplicantPrice, "기존 회원 가격");
      if (data.status !== undefined) { if (!OFFERING_STATUSES.has(data.status)) throw new SeasonalError("특강 상태가 올바르지 않습니다."); update.status = data.status; }
      const nextStatus = (update.status as string | undefined) ?? before.status;
      const nextCapacity = update.capacity === undefined ? before.capacity : update.capacity;
      if (nextStatus === "OPEN" && nextCapacity === null) throw new SeasonalError("정원이 정해지지 않은 반은 공개할 수 없습니다.", 409, "CAPACITY_REQUIRED");
      const nextLinkedClassId = (update.linkedClassId === undefined ? before.linkedClassId : update.linkedClassId) as string | null;
      const nextInstructorId = (update.instructorId === undefined ? before.instructorId : update.instructorId) as string | null;
      if (nextStatus === "OPEN" && (!nextLinkedClassId || !nextInstructorId)) throw new SeasonalError("모집 중인 반은 연결 반과 담당 강사를 지정해야 합니다.", 409, "ATTENDANCE_LINK_REQUIRED");
      if (data.shuttleAvailable !== undefined) update.shuttleAvailable = Boolean(data.shuttleAvailable);
      if (data.displayOrder !== undefined) update.displayOrder = Number(data.displayOrder) || 0;
      const replacementDates = Array.isArray(data.sessionDates)
        ? (data.sessionDates as SessionDateInput[]).map((row) => ({
            id: cleanText(row.id, 100) || null,
            startsAt: date(row.startsAt, "수업 시작 시각"),
            endsAt: date(row.endsAt, "수업 종료 시각"),
            location: cleanText(row.location, 150),
            note: cleanText(row.note, 500),
          }))
        : null;
      if (replacementDates?.some((row: { startsAt: Date; endsAt: Date }) => row.endsAt <= row.startsAt)) throw new SeasonalError("수업 종료 시각은 시작 시각보다 늦어야 합니다.");
      if (nextStatus === "OPEN") {
        const sessionDateCount = replacementDates?.length ?? await prisma.specialProgramSessionDate.count({ where: { offeringId: id } });
        if (sessionDateCount === 0) throw new SeasonalError("모집 중인 반은 수업 일정을 한 개 이상 등록해야 합니다.", 409, "SESSION_DATE_REQUIRED");
      }
      const offering = await prisma.$transaction(async (tx) => {
        const updated = await tx.specialProgramOffering.update({ where: { id }, data: update });
        if (replacementDates || data.linkedClassId !== undefined || data.instructorId !== undefined) {
          const dates = replacementDates ?? await tx.specialProgramSessionDate.findMany({
            where: { offeringId: id },
            orderBy: { startsAt: "asc" },
            select: { id: true, startsAt: true, endsAt: true, location: true, note: true },
          });
          await syncOfferingSessionDates(tx, { offeringId: id, linkedClassId: nextLinkedClassId, instructorId: nextInstructorId, dates });
        }
        return tx.specialProgramOffering.findUniqueOrThrow({ where: { id: updated.id }, include: { sessionDates: { orderBy: { startsAt: "asc" } } } });
      });
      await prisma.specialProgramAuditLog.create({ data: { seasonId: offering.seasonId, offeringId: id, actorType: "ADMIN", actorId: actor.appUserId, action: "OFFERING_UPDATED", beforeJSON: before, afterJSON: offering } });
      return NextResponse.json({ offering });
    }

    if (body.resource === "applicationReview") {
      if (data.action !== "CLEAR") throw new SeasonalError("검토 완료 동작을 확인해 주세요.");
      const reviewNote = cleanText(data.reviewNote, 1000);
      if (!reviewNote) throw new SeasonalError("검토한 근거를 메모로 남겨 주세요.", 400, "REVIEW_NOTE_REQUIRED");
      const before = await prisma.specialProgramApplication.findUnique({ where: { id } });
      if (!before) throw new SeasonalError("신청서를 찾을 수 없습니다.", 404);
      const application = await prisma.$transaction(async (tx) => {
        const updated = await tx.specialProgramApplication.update({
          where: { id },
          data: { requiresReview: false, reviewReasons: [], processedAt: new Date(), processedByUserId: actor.appUserId, processedNote: reviewNote },
        });
        await tx.specialProgramAuditLog.create({
          data: {
            seasonId: updated.seasonId,
            applicationId: id,
            actorType: "ADMIN",
            actorId: actor.appUserId,
            action: "APPLICATION_REVIEW_CLEARED",
            beforeJSON: { requiresReview: before.requiresReview, reviewReasons: before.reviewReasons },
            afterJSON: { requiresReview: false, reviewReasons: [], reviewNote },
          },
        });
        return updated;
      });
      return NextResponse.json({ application });
    }

    if (body.resource === "application") {
      if (!APPLICATION_STATUSES.has(data.status)) throw new SeasonalError("신청 상태가 올바르지 않습니다.");
      const before = await prisma.specialProgramApplication.findUnique({ where: { id } });
      if (!before) throw new SeasonalError("신청서를 찾을 수 없습니다.", 404);
      if (data.status === "APPROVED" && (before.requiresReview || before.reviewReasons.length > 0)) {
        throw new SeasonalError("검토 필요 사유를 먼저 확인하고 검토 완료 처리해 주세요.", 409, "APPLICATION_REVIEW_REQUIRED");
      }
      const application = await prisma.$transaction(async (tx) => {
        if (data.status === "APPROVED") await ensureApplicationCapacity(tx, id);
        return tx.specialProgramApplication.update({ where: { id }, data: { status: data.status, processedAt: new Date(), processedByUserId: actor.appUserId, processedNote: cleanText(data.processedNote, 1000) } });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      await prisma.specialProgramAuditLog.create({ data: { seasonId: application.seasonId, applicationId: id, actorType: "ADMIN", actorId: actor.appUserId, action: "APPLICATION_STATUS_UPDATED", beforeJSON: before, afterJSON: application } });
      return NextResponse.json({ application });
    }

    if (body.resource === "item") {
      const status = cleanText(data.status, 30);
      if (!status || !ITEM_STATUSES.has(status)) throw new SeasonalError("신청 항목 상태가 올바르지 않습니다.");
      const item = await prisma.$transaction(
        (tx) => updateSpecialProgramItemStatus(tx, { itemId: id, status, actorId: actor.appUserId, enrollmentId: data.enrollmentId, paymentId: data.paymentId }),
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      return NextResponse.json({ item });
    }

    if (body.resource === "conversion") {
      const result = await convertApprovedItemToEnrollmentAndInvoice(id, actor.appUserId);
      return NextResponse.json({ success: true, ...result });
    }

    if (body.resource === "accountActivation") {
      if (data.action !== "reissue") throw new SeasonalError("지원하지 않는 계정 활성화 작업입니다.");
      const activation = await issueAccountClaimForItem(id);
      if (!activation.activationRequired || !activation.activationUrl) {
        throw new SeasonalError("이미 로그인 가능한 보호자 계정입니다.", 409, "ACCOUNT_ALREADY_ACTIVE");
      }
      const auditTarget = await prisma.specialProgramApplicationItem.findUnique({
        where: { id },
        select: { applicationId: true, offeringId: true, application: { select: { seasonId: true } } },
      });
      if (auditTarget) {
        await prisma.specialProgramAuditLog.create({
          data: {
            seasonId: auditTarget.application.seasonId,
            offeringId: auditTarget.offeringId,
            applicationId: auditTarget.applicationId,
            itemId: id,
            actorType: "ADMIN",
            actorId: actor.appUserId,
            action: "PARENT_ACCOUNT_ACTIVATION_REISSUED",
            afterJSON: { activationRequired: true },
          },
        });
      }
      return NextResponse.json({ success: true, ...activation });
    }
    throw new SeasonalError("지원하지 않는 수정 대상입니다.");
  } catch (error) { return respondError(error); }
}

async function convertApprovedItemToEnrollmentAndInvoice(itemId: string, actorId: string): Promise<ConversionResult> {
  await ensurePaymentInfrastructure();

  const converted = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "SpecialProgramApplicationItem" WHERE id = ${itemId} FOR UPDATE`;
    const item = await tx.specialProgramApplicationItem.findUnique({
      where: { id: itemId },
      include: {
        application: true,
        offering: { include: { season: true } },
      },
    });
    if (!item) throw new SeasonalError("신청 항목을 찾을 수 없습니다.", 404);
    if (item.status !== "APPROVED") throw new SeasonalError("승인된 신청 항목만 수강·청구로 전환할 수 있습니다.", 409, "ITEM_NOT_APPROVED");
    if (item.application.requiresReview || item.application.reviewReasons.length > 0) {
      throw new SeasonalError("검토 필요 사유를 먼저 확인하고 검토 완료 처리해 주세요.", 409, "APPLICATION_REVIEW_REQUIRED");
    }
    if (!item.offering.linkedClassId) throw new SeasonalError("먼저 특강 반을 기존 정규 반과 연결해 주세요.", 409, "CLASS_NOT_LINKED");

    const parentPhone = normalizeDigits(item.application.parentPhone);
    if (parentPhone.length < 10) throw new SeasonalError("보호자 연락처를 확인해 주세요.");
    const parentName = item.application.parentName || "학부모";
    const parentEmail = `parent_${parentPhone}@stiz.local`;

    const existingParents = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM "User"
       WHERE role = 'PARENT'
         AND regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g') = ${parentPhone}
       LIMIT 1
    `;
    let parentId = existingParents[0]?.id;
    if (!parentId) {
      const parents = await tx.$queryRaw<{ id: string }[]>`
        INSERT INTO "User" (id, email, name, phone, role, "createdAt", "updatedAt")
        VALUES (gen_random_uuid()::text, ${parentEmail}, ${parentName}, ${parentPhone}, 'PARENT', NOW(), NOW())
        ON CONFLICT (email) DO UPDATE SET
          name = COALESCE("User".name, EXCLUDED.name),
          phone = COALESCE("User".phone, EXCLUDED.phone),
          "updatedAt" = NOW()
        RETURNING id
      `;
      parentId = parents[0]?.id;
    }
    if (!parentId) throw new SeasonalError("학부모 계정을 준비하지 못했습니다.", 500, "PARENT_SAVE_FAILED");

    const existingStudents = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM "Student"
       WHERE name = ${item.application.childName}
         AND "parentId" = ${parentId}
         AND (("birthDate" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Seoul')::date = (${item.application.childBirthDate}::timestamptz AT TIME ZONE 'Asia/Seoul')::date
       LIMIT 1
    `;
    let studentId = existingStudents[0]?.id;
    if (studentId) {
      await tx.$executeRaw`
        UPDATE "Student" SET
          gender = COALESCE(${item.application.childGender}, gender),
          grade = COALESCE(${item.application.childGrade}, grade),
          school = COALESCE(${item.application.childSchool}, school),
          phone = COALESCE(${item.application.childPhone}, phone),
          address = COALESCE(${item.application.address}, address),
          "updatedAt" = NOW()
        WHERE id = ${studentId}
      `;
    } else {
      const students = await tx.$queryRaw<{ id: string }[]>`
        INSERT INTO "Student" (
          id, name, "birthDate", gender, grade, school, phone, address,
          "parentId", "enrollDate", "createdAt", "updatedAt"
        )
        VALUES (
          gen_random_uuid()::text, ${item.application.childName}, ${item.application.childBirthDate},
          ${item.application.childGender}, ${item.application.childGrade}, ${item.application.childSchool},
          ${item.application.childPhone}, ${item.application.address}, ${parentId}, NOW(), NOW(), NOW()
        )
        RETURNING id
      `;
      studentId = students[0]?.id;
    }
    if (!studentId) throw new SeasonalError("학생 정보를 준비하지 못했습니다.", 500, "STUDENT_SAVE_FAILED");

    const relation = item.application.parentRelation || "보호자";
    const guardianRows = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM "Guardian"
       WHERE "studentId" = ${studentId}
         AND COALESCE(phone, '') = ${parentPhone}
       LIMIT 1
    `;
    if (guardianRows.length === 0) {
      await tx.$executeRaw`
        INSERT INTO "Guardian" (id, "studentId", relation, name, phone, "isPrimary", "createdAt", "updatedAt")
        VALUES (gen_random_uuid()::text, ${studentId}, ${relation}, ${parentName}, ${parentPhone}, true, NOW(), NOW())
      `;
    }

    const enrollments = await tx.$queryRaw<{ id: string }[]>`
      INSERT INTO "Enrollment" (id, "studentId", "classId", status, "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, ${studentId}, ${item.offering.linkedClassId}, 'ACTIVE', NOW(), NOW())
      ON CONFLICT ("studentId", "classId") DO UPDATE SET status = 'ACTIVE', "updatedAt" = NOW()
      RETURNING id
    `;
    const enrollmentId = item.enrollmentId || enrollments[0]?.id;
    if (!enrollmentId) throw new SeasonalError("수강 등록을 준비하지 못했습니다.", 500, "ENROLLMENT_SAVE_FAILED");

    let paymentId = item.paymentId || null;
    if (paymentId) {
      const payments = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "Payment" WHERE id = ${paymentId} LIMIT 1`;
      if (payments.length === 0) paymentId = null;
    }
    if (!paymentId) {
      const dueDate = defaultPaymentDueDate();
      const year = dueDate.getFullYear();
      const month = dueDate.getMonth() + 1;
      const description = `${item.offering.season.title} · ${item.titleSnapshot}`;
      const payments = await tx.$queryRaw<{ id: string }[]>`
        INSERT INTO "Payment" (
          id, "studentId", "classId", amount, status, "dueDate",
          type, method, description, month, year, "autoGenerated", "createdAt", "updatedAt"
        )
        VALUES (
          gen_random_uuid()::text, ${studentId}, ${item.offering.linkedClassId}, ${item.priceSnapshot}, 'PENDING', ${dueDate},
          'SPECIAL', 'UNPAID', ${description}, ${month}, ${year}, false, NOW(), NOW()
        )
        RETURNING id
      `;
      paymentId = payments[0]?.id || null;
    }
    if (!paymentId) throw new SeasonalError("청구 정보를 준비하지 못했습니다.", 500, "PAYMENT_SAVE_FAILED");

    const updated = await tx.specialProgramApplicationItem.update({
      where: { id: item.id },
      data: { enrollmentId, paymentId, conversionStatus: "INVOICE_PENDING", conversionError: null },
    });
    await tx.specialProgramApplication.update({
      where: { id: item.applicationId },
      data: { convertedStudentId: studentId, processedAt: new Date(), processedByUserId: actorId },
    });
    await tx.specialProgramAuditLog.create({
      data: {
        seasonId: item.application.seasonId,
        offeringId: item.offeringId,
        applicationId: item.applicationId,
        itemId: item.id,
        actorType: "ADMIN",
        actorId,
        action: "ITEM_CONVERTED_TO_ENROLLMENT_PAYMENT",
        afterJSON: { studentId, enrollmentId, paymentId, linkedClassId: item.offering.linkedClassId },
      },
    });

    return { itemId: updated.id, studentId, enrollmentId, paymentId, parentId, applicationId: item.applicationId };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  let invoice: Awaited<ReturnType<typeof ensureInvoiceForPayment>>;
  try {
    invoice = await ensureInvoiceForPayment(converted.paymentId);
    if (!invoice) throw new Error("INVOICE_NOT_CREATED");
    await prisma.specialProgramApplicationItem.update({
      where: { id: converted.itemId },
      data: { conversionStatus: "COMPLETED", conversionError: null },
    });
  } catch (error) {
    await prisma.specialProgramApplicationItem.update({
      where: { id: converted.itemId },
      data: { conversionStatus: "INVOICE_RETRY_REQUIRED", conversionError: "INVOICE_CREATION_FAILED" },
    });
    await prisma.specialProgramAuditLog.create({
      data: {
        itemId: converted.itemId,
        actorType: "ADMIN",
        actorId,
        action: "INVOICE_CREATION_FAILED",
        afterJSON: { paymentId: converted.paymentId, retryable: true },
      },
    });
    console.error("[admin seasonal invoice]", error);
    throw new SeasonalError("수강 등록과 결제 정보는 저장됐지만 청구서 생성에 실패했습니다. 다시 시도해 주세요.", 503, "INVOICE_RETRY_REQUIRED");
  }

  const activation = await issueParentAccountClaim({
    parentId: converted.parentId,
    applicationId: converted.applicationId,
    invoiceId: invoice.id,
    redirectPath: `/payments/${encodeURIComponent(invoice.id)}`,
  });
  return {
    itemId: converted.itemId,
    studentId: converted.studentId,
    enrollmentId: converted.enrollmentId,
    paymentId: converted.paymentId,
    invoiceId: invoice.id,
    ...activation,
  };
}

async function issueAccountClaimForItem(itemId: string) {
  const rows = await prisma.$queryRawUnsafe<Array<{ parentId: string; applicationId: string; invoiceId: string }>>(
    `SELECT i."parentId", item."applicationId", i.id AS "invoiceId"
       FROM "SpecialProgramApplicationItem" item
       JOIN "PaymentInvoice" i ON i."paymentId" = item."paymentId"
      WHERE item.id = $1 LIMIT 1`,
    itemId,
  );
  const target = rows[0];
  if (!target) throw new SeasonalError("계정 활성화 대상 청구서를 찾을 수 없습니다.", 404, "ACCOUNT_CLAIM_TARGET_NOT_FOUND");
  return issueParentAccountClaim({
    parentId: target.parentId,
    applicationId: target.applicationId,
    invoiceId: target.invoiceId,
    redirectPath: `/payments/${encodeURIComponent(target.invoiceId)}`,
    enforceCooldown: true,
  });
}

export async function DELETE(request: NextRequest) {
  try {
    const actor = await admin();
    const resource = request.nextUrl.searchParams.get("resource");
    const id = request.nextUrl.searchParams.get("id");
    if (!id || (resource !== "season" && resource !== "offering")) throw new SeasonalError("삭제 대상이 올바르지 않습니다.");
    if (resource === "offering") {
      const offering = await prisma.specialProgramOffering.findUnique({ where: { id }, include: { _count: { select: { applicationItems: true } } } });
      if (!offering) throw new SeasonalError("특강을 찾을 수 없습니다.", 404);
      if (offering._count.applicationItems > 0) throw new SeasonalError("신청 이력이 있는 특강은 삭제 대신 취소 처리해 주세요.", 409);
      const protectedSessions = await prisma.session.count({
        where: {
          specialProgramSessionDate: { offeringId: id },
          OR: [{ status: { not: "PLANNED" } }, { attendances: { some: {} } }],
        },
      });
      if (protectedSessions > 0) throw new SeasonalError("이미 시작했거나 출석 기록이 있는 특강은 삭제 대신 취소 처리해 주세요.", 409, "SEASONAL_SESSION_PROTECTED");
      await prisma.$transaction(async (tx) => {
        await tx.specialProgramAuditLog.create({ data: { seasonId: offering.seasonId, offeringId: id, actorType: "ADMIN", actorId: actor.appUserId, action: "OFFERING_DELETED", beforeJSON: offering } });
        await tx.session.deleteMany({ where: { specialProgramSessionDate: { offeringId: id } } });
        await tx.specialProgramOffering.delete({ where: { id } });
      });
      return NextResponse.json({ success: true });
    }
    const season = await prisma.specialProgramSeason.findUnique({ where: { id }, include: { _count: { select: { applications: true } } } });
    if (!season) throw new SeasonalError("시즌을 찾을 수 없습니다.", 404);
    if (season._count.applications > 0) throw new SeasonalError("신청 이력이 있는 시즌은 삭제 대신 보관 처리해 주세요.", 409);
    const protectedSessions = await prisma.session.count({
      where: {
        specialProgramSessionDate: { offering: { seasonId: id } },
        OR: [{ status: { not: "PLANNED" } }, { attendances: { some: {} } }],
      },
    });
    if (protectedSessions > 0) throw new SeasonalError("이미 시작했거나 출석 기록이 있는 특강 시즌은 삭제 대신 보관 처리해 주세요.", 409, "SEASONAL_SESSION_PROTECTED");
    await prisma.$transaction(async (tx) => {
      await tx.specialProgramAuditLog.create({ data: { seasonId: id, actorType: "ADMIN", actorId: actor.appUserId, action: "SEASON_DELETED", beforeJSON: season } });
      await tx.session.deleteMany({ where: { specialProgramSessionDate: { offering: { seasonId: id } } } });
      await tx.specialProgramSeason.delete({ where: { id } });
    });
    return NextResponse.json({ success: true });
  } catch (error) { return respondError(error); }
}
