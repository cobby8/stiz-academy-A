import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";
import { cleanText, SeasonalError } from "@/lib/seasonal/contracts";
import { Prisma } from "@prisma/client";

const SEASON_STATUSES = new Set(["DRAFT", "PUBLISHED", "CLOSED", "ARCHIVED"]);
const OFFERING_STATUSES = new Set(["DRAFT", "OPEN", "CLOSED", "CANCELLED"]);
const APPLICATION_STATUSES = new Set(["PENDING", "PARTIALLY_WAITLISTED", "APPROVED", "REJECTED", "CANCELLED"]);
const ITEM_STATUSES = new Set(["PENDING", "WAITLISTED", "APPROVED", "REJECTED", "CANCELLED"]);
type SessionDateInput = { startsAt?: unknown; endsAt?: unknown; location?: unknown; note?: unknown };

async function admin() {
  try { return await requireAdmin(); } catch { throw new SeasonalError("관리자 권한이 필요합니다.", 401, "UNAUTHORIZED"); }
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

function respondError(error: unknown) {
  if (error instanceof SeasonalError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
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
        applications: includeApplications ? { orderBy: { createdAt: "desc" }, include: { items: { include: { offering: { select: { title: true, code: true } }, shuttleRequest: true } } } } : false,
      },
    });
    return NextResponse.json({
      seasons,
      applications: includeApplications ? seasons.flatMap((season) => season.applications) : [],
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
      const capacity = nonNegativeInt(data.capacity, "정원");
      const price = nonNegativeInt(data.price, "가격");
      const status = OFFERING_STATUSES.has(data.status) ? data.status : "DRAFT";
      const sessionDates = Array.isArray(data.sessionDates) ? (data.sessionDates as SessionDateInput[]).map((row) => ({ startsAt: date(row.startsAt, "수업 시작 시각"), endsAt: date(row.endsAt, "수업 종료 시각"), location: cleanText(row.location, 150), note: cleanText(row.note, 500) })) : [];
      if (sessionDates.some((row: { startsAt: Date; endsAt: Date }) => row.endsAt <= row.startsAt)) throw new SeasonalError("수업 종료 시각은 시작 시각보다 늦어야 합니다.");
      const offering = await prisma.specialProgramOffering.create({ data: { seasonId, code, title, description: cleanText(data.description, 5000), targetGrades: cleanText(data.targetGrades, 200), instructorId: cleanText(data.instructorId, 100), instructorName: cleanText(data.instructorName, 100), location: cleanText(data.location, 150), capacity, price, shuttleAvailable: Boolean(data.shuttleAvailable), status, displayOrder: Number.isInteger(data.displayOrder) ? data.displayOrder : 0, linkedProgramId: cleanText(data.linkedProgramId, 100), linkedClassId: cleanText(data.linkedClassId, 100), sessionDates: { create: sessionDates } }, include: { sessionDates: true } });
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
    const id = cleanText(body?.id, 100);
    const data = body?.data || {};
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
      for (const key of ["title", "description", "targetGrades", "instructorId", "instructorName", "location", "linkedProgramId", "linkedClassId"] as const) if (data[key] !== undefined) update[key] = cleanText(data[key], key === "description" ? 5000 : 200) || null;
      if (data.capacity !== undefined) update.capacity = nonNegativeInt(data.capacity, "정원");
      if (data.price !== undefined) update.price = nonNegativeInt(data.price, "가격");
      if (data.status !== undefined) { if (!OFFERING_STATUSES.has(data.status)) throw new SeasonalError("특강 상태가 올바르지 않습니다."); update.status = data.status; }
      if (data.shuttleAvailable !== undefined) update.shuttleAvailable = Boolean(data.shuttleAvailable);
      if (data.displayOrder !== undefined) update.displayOrder = Number(data.displayOrder) || 0;
      const replacementDates = Array.isArray(data.sessionDates)
        ? (data.sessionDates as SessionDateInput[]).map((row) => ({
            startsAt: date(row.startsAt, "수업 시작 시각"),
            endsAt: date(row.endsAt, "수업 종료 시각"),
            location: cleanText(row.location, 150),
            note: cleanText(row.note, 500),
          }))
        : null;
      if (replacementDates?.some((row: { startsAt: Date; endsAt: Date }) => row.endsAt <= row.startsAt)) throw new SeasonalError("수업 종료 시각은 시작 시각보다 늦어야 합니다.");
      const offering = await prisma.$transaction(async (tx) => {
        const updated = await tx.specialProgramOffering.update({ where: { id }, data: update });
        if (replacementDates) {
          await tx.specialProgramSessionDate.deleteMany({ where: { offeringId: id } });
          if (replacementDates.length) await tx.specialProgramSessionDate.createMany({ data: replacementDates.map((row: { startsAt: Date; endsAt: Date; location?: string; note?: string }) => ({ offeringId: id, ...row })) });
        }
        return updated;
      });
      await prisma.specialProgramAuditLog.create({ data: { seasonId: offering.seasonId, offeringId: id, actorType: "ADMIN", actorId: actor.appUserId, action: "OFFERING_UPDATED", beforeJSON: before, afterJSON: offering } });
      return NextResponse.json({ offering });
    }

    if (body.resource === "application") {
      if (!APPLICATION_STATUSES.has(data.status)) throw new SeasonalError("신청 상태가 올바르지 않습니다.");
      const before = await prisma.specialProgramApplication.findUnique({ where: { id } });
      if (!before) throw new SeasonalError("신청서를 찾을 수 없습니다.", 404);
      const application = await prisma.specialProgramApplication.update({ where: { id }, data: { status: data.status, processedAt: new Date(), processedByUserId: actor.appUserId, processedNote: cleanText(data.processedNote, 1000) } });
      await prisma.specialProgramAuditLog.create({ data: { seasonId: application.seasonId, applicationId: id, actorType: "ADMIN", actorId: actor.appUserId, action: "APPLICATION_STATUS_UPDATED", beforeJSON: before, afterJSON: application } });
      return NextResponse.json({ application });
    }

    if (body.resource === "item") {
      if (!ITEM_STATUSES.has(data.status)) throw new SeasonalError("신청 항목 상태가 올바르지 않습니다.");
      const before = await prisma.specialProgramApplicationItem.findUnique({ where: { id }, include: { application: true } });
      if (!before) throw new SeasonalError("신청 항목을 찾을 수 없습니다.", 404);
      const item = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "SpecialProgramOffering" WHERE id = ${before.offeringId} FOR UPDATE`;
        if (["PENDING", "APPROVED"].includes(data.status) && !["PENDING", "APPROVED"].includes(before.status)) {
          const [offering, occupied] = await Promise.all([
            tx.specialProgramOffering.findUnique({ where: { id: before.offeringId } }),
            tx.specialProgramApplicationItem.count({ where: { offeringId: before.offeringId, id: { not: id }, status: { in: ["PENDING", "APPROVED"] } } }),
          ]);
          if (!offering || occupied >= offering.capacity) throw new SeasonalError("정원이 가득 차 승인할 수 없습니다.", 409, "CAPACITY_FULL");
        }
        let waitlistOrder = before.waitlistOrder;
        if (data.status === "WAITLISTED" && !waitlistOrder) {
          const last = await tx.specialProgramApplicationItem.aggregate({ where: { offeringId: before.offeringId, status: "WAITLISTED" }, _max: { waitlistOrder: true } });
          waitlistOrder = (last._max.waitlistOrder || 0) + 1;
        }
        const updated = await tx.specialProgramApplicationItem.update({ where: { id }, data: { status: data.status, waitlistOrder: data.status === "WAITLISTED" ? waitlistOrder : null, enrollmentId: cleanText(data.enrollmentId, 100), paymentId: cleanText(data.paymentId, 100) } });
        const siblings = await tx.specialProgramApplicationItem.findMany({
          where: { applicationId: before.applicationId },
          select: { status: true },
        });
        const statuses = siblings.map((row) => row.status);
        const applicationStatus = statuses.every((status) => status === "APPROVED")
          ? "APPROVED"
          : statuses.every((status) => status === "REJECTED")
            ? "REJECTED"
            : statuses.every((status) => status === "CANCELLED")
              ? "CANCELLED"
              : statuses.includes("WAITLISTED")
                ? "PARTIALLY_WAITLISTED"
                : "PENDING";
        await tx.specialProgramApplication.update({
          where: { id: before.applicationId },
          data: { status: applicationStatus, processedAt: new Date(), processedByUserId: actor.appUserId },
        });
        return updated;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      await prisma.specialProgramAuditLog.create({ data: { seasonId: before.application.seasonId, offeringId: item.offeringId, applicationId: item.applicationId, itemId: id, actorType: "ADMIN", actorId: actor.appUserId, action: "ITEM_STATUS_UPDATED", beforeJSON: before, afterJSON: item } });
      return NextResponse.json({ item });
    }
    throw new SeasonalError("지원하지 않는 수정 대상입니다.");
  } catch (error) { return respondError(error); }
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
      await prisma.specialProgramOffering.delete({ where: { id } });
      await prisma.specialProgramAuditLog.create({ data: { seasonId: offering.seasonId, actorType: "ADMIN", actorId: actor.appUserId, action: "OFFERING_DELETED", beforeJSON: offering } });
      return NextResponse.json({ success: true });
    }
    const season = await prisma.specialProgramSeason.findUnique({ where: { id }, include: { _count: { select: { applications: true } } } });
    if (!season) throw new SeasonalError("시즌을 찾을 수 없습니다.", 404);
    if (season._count.applications > 0) throw new SeasonalError("신청 이력이 있는 시즌은 삭제 대신 보관 처리해 주세요.", 409);
    await prisma.specialProgramAuditLog.create({ data: { seasonId: id, actorType: "ADMIN", actorId: actor.appUserId, action: "SEASON_DELETED", beforeJSON: season } });
    await prisma.specialProgramSeason.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) { return respondError(error); }
}
