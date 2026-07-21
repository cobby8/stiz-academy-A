import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { SeasonalError, type SeasonalApplicationInput } from "./contracts";
import { decideApplicantType, planApplicationItems, totalSnapshot, weekdayInSeoul } from "./planning";

const OCCUPYING_ITEM_STATUSES = ["PENDING", "APPROVED"];
type PublicOfferingRow = Prisma.SpecialProgramOfferingGetPayload<{
  include: { sessionDates: true; _count: { select: { applicationItems: true } } };
}>;
type PublicSeasonRow = Prisma.SpecialProgramSeasonGetPayload<{
  include: { offerings: { include: { sessionDates: true; _count: { select: { applicationItems: true } } } } };
}>;

function publicStatus(season: { status: string; applicationOpensAt: Date; applicationClosesAt: Date; endsAt: Date }) {
  const now = new Date();
  if (season.status !== "PUBLISHED" || now > season.endsAt) return "ENDED";
  if (now < season.applicationOpensAt) return "UPCOMING";
  if (now > season.applicationClosesAt) return "CLOSED";
  return "OPEN";
}

function publicOffering(offering: PublicOfferingRow) {
  const first = offering.sessionDates?.[0];
  const startsAt = first?.startsAt ? new Date(first.startsAt) : null;
  const endsAt = first?.endsAt ? new Date(first.endsAt) : null;
  const enrolled = offering._count?.applicationItems || 0;
  const time = (value: Date | null) => value
    ? new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hour12: false }).format(value)
    : "";
  return {
    id: offering.id,
    name: offering.title,
    dayLabel: startsAt ? new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", weekday: "short" }).format(startsAt) : "일정 미정",
    dateLabel: startsAt ? new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric" }).format(startsAt) : undefined,
    startTime: time(startsAt),
    endTime: time(endsAt),
    location: first?.location || offering.location || undefined,
    targetGrade: offering.targetGrades || undefined,
    coachName: offering.instructorName || undefined,
    capacity: offering.capacity ?? 0,
    enrolled,
    remaining: Math.max(0, (offering.capacity ?? 0) - enrolled),
    price: offering.price,
    waitlistEnabled: true,
  };
}

function publicSeason(season: PublicSeasonRow) {
  const classes = (season.offerings || []).map(publicOffering);
  return {
    id: season.id,
    slug: season.slug,
    title: season.title,
    summary: season.description || undefined,
    status: publicStatus(season),
    applicationStart: season.applicationOpensAt.toISOString(),
    applicationEnd: season.applicationClosesAt.toISOString(),
    operationStart: season.startsAt.toISOString(),
    operationEnd: season.endsAt.toISOString(),
    location: classes.find((item: { location?: string }) => item.location)?.location,
    refundPolicy: season.cancellationPolicy || undefined,
    classes,
  };
}

export async function listPublishedSeasons() {
  const seasons = await prisma.specialProgramSeason.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { startsAt: "desc" },
    include: {
      offerings: {
        where: { status: "OPEN", capacity: { not: null } },
        orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
        include: {
          sessionDates: { orderBy: { startsAt: "asc" } },
          _count: { select: { applicationItems: { where: { status: { in: OCCUPYING_ITEM_STATUSES } } } } },
        },
      },
    },
  });
  return seasons.map(publicSeason);
}

export async function getPublishedSeason(slug: string) {
  const season = await prisma.specialProgramSeason.findFirst({
    where: { slug, status: "PUBLISHED" },
    include: {
      offerings: {
        where: { status: "OPEN", capacity: { not: null } },
        orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
        include: {
          sessionDates: { orderBy: { startsAt: "asc" } },
          _count: { select: { applicationItems: { where: { status: { in: OCCUPYING_ITEM_STATUSES } } } } },
        },
      },
    },
  });
  if (!season) throw new SeasonalError("모집 중인 방학특강을 찾을 수 없습니다.", 404, "SEASON_NOT_FOUND");
  return publicSeason(season);
}

async function existingApplication(seasonId: string, idempotencyKey: string) {
  return prisma.specialProgramApplication.findUnique({
    where: { seasonId_idempotencyKey: { seasonId, idempotencyKey } },
    include: { items: true },
  });
}

async function hasMatchingExistingStudent(input: SeasonalApplicationInput) {
  const birthDate = new Date(input.child.birthDate);
  const rows = await prisma.$queryRaw<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1
        FROM "Student" student
        JOIN "User" parent ON parent.id = student."parentId"
       WHERE student.name = ${input.child.name}
         AND ((student."birthDate" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Seoul')::date = (${birthDate}::timestamptz AT TIME ZONE 'Asia/Seoul')::date
         AND (
           regexp_replace(COALESCE(parent.phone, ''), '[^0-9]', '', 'g') = ${input.parent.phone}
           OR EXISTS (
             SELECT 1 FROM "Guardian" guardian
              WHERE guardian."studentId" = student.id
                AND regexp_replace(COALESCE(guardian.phone, ''), '[^0-9]', '', 'g') = ${input.parent.phone}
           )
         )
    ) AS exists
  `;
  return rows[0]?.exists === true;
}

function applicationResponse(application: Awaited<ReturnType<typeof existingApplication>>, duplicate: boolean) {
  if (!application) throw new SeasonalError("신청 저장 결과를 확인할 수 없습니다.", 500, "SAVE_FAILED");
  return {
    applicationId: application.id,
    status: application.status,
    totalPriceSnapshot: application.totalPriceSnapshot,
    duplicate,
    items: application.items.map((item) => ({
      offeringId: item.offeringId,
      status: item.status,
      priceSnapshot: item.priceSnapshot,
      waitlistOrder: item.waitlistOrder,
    })),
  };
}

export async function submitSeasonalApplication(slug: string, input: SeasonalApplicationInput, retryCount = 0) {
  const season = await prisma.specialProgramSeason.findUnique({ where: { slug } });
  if (!season || season.status !== "PUBLISHED") throw new SeasonalError("신청할 수 없는 방학특강입니다.", 404, "SEASON_NOT_FOUND");
  const now = new Date();
  if (now < season.applicationOpensAt || now > season.applicationClosesAt) {
    throw new SeasonalError("현재는 신청 기간이 아닙니다.", 409, "APPLICATION_CLOSED");
  }

  const duplicate = await existingApplication(season.id, input.idempotencyKey);
  if (duplicate) return applicationResponse(duplicate, true);
  const applicantDecision = decideApplicantType(input.applicantType, await hasMatchingExistingStudent(input));

  try {
    const created = await prisma.$transaction(async (tx) => {
      const ids = input.items.map((item) => item.offeringId);

      // 같은 상품을 동시에 신청할 때 정원 계산이 엇갈리지 않도록 행 잠금을 잡는다.
      await tx.$queryRaw`SELECT id FROM "SpecialProgramOffering" WHERE id IN (${Prisma.join(ids)}) ORDER BY id FOR UPDATE`;
      const offerings = await tx.specialProgramOffering.findMany({
        where: { id: { in: ids }, seasonId: season.id },
        include: { sessionDates: { select: { startsAt: true } } },
      });
      if (offerings.length !== ids.length || offerings.some((offering) => offering.status !== "OPEN" || offering.capacity === null)) {
        throw new SeasonalError("마감되었거나 존재하지 않는 특강이 포함되어 있습니다.", 409, "OFFERING_UNAVAILABLE");
      }
      const availableWeekdays = new Set(offerings.flatMap((offering) => offering.sessionDates.map((session) => weekdayInSeoul(session.startsAt))));
      const invalidWeekdays = input.selectedWeekdays.filter((weekday) => !availableWeekdays.has(weekday));
      if (invalidWeekdays.length > 0) {
        throw new SeasonalError("선택한 요일과 실제 특강 일정이 일치하지 않습니다.", 409, "WEEKDAY_NOT_OFFERED");
      }

      const counts = await tx.specialProgramApplicationItem.groupBy({
        by: ["offeringId"],
        where: { offeringId: { in: ids }, status: { in: OCCUPYING_ITEM_STATUSES } },
        _count: { _all: true },
      });
      const occupied = new Map(counts.map((row) => [row.offeringId, row._count._all]));
      const waitlistMax = await tx.specialProgramApplicationItem.groupBy({
        by: ["offeringId"],
        where: { offeringId: { in: ids }, status: "WAITLISTED" },
        _max: { waitlistOrder: true },
      });
      const maxOrders = new Map(waitlistMax.map((row) => [row.offeringId, row._max.waitlistOrder || 0]));
      const byId = new Map(offerings.map((offering) => [offering.id, offering]));
      const placement = planApplicationItems(
        input.items.map((requested) => ({ ...byId.get(requested.offeringId)!, capacity: byId.get(requested.offeringId)!.capacity! })),
        occupied,
        maxOrders,
        applicantDecision.pricingType,
      );
      const itemPlans = input.items.map((requested, index) => ({
        requested,
        offering: byId.get(requested.offeringId)!,
        ...placement[index],
      }));
      const totalPriceSnapshot = totalSnapshot(itemPlans);
      const status = itemPlans.some((item) => item.status === "WAITLISTED") ? "PARTIALLY_WAITLISTED" : "PENDING";

      const application = await tx.specialProgramApplication.create({
        data: {
          seasonId: season.id,
          idempotencyKey: input.idempotencyKey,
          applicantType: applicantDecision.serverType,
          selectedWeekdays: input.selectedWeekdays,
          requiresReview: applicantDecision.requiresReview,
          reviewReasons: applicantDecision.reviewReasons,
          childName: input.child.name,
          childBirthDate: new Date(input.child.birthDate),
          childGender: input.child.gender,
          childGrade: input.child.grade,
          childSchool: input.child.school,
          childPhone: input.child.phone,
          parentName: input.parent.name,
          parentPhone: input.parent.phone,
          parentRelation: input.parent.relation,
          address: input.address,
          memo: input.memo,
          agreedTerms: input.agreedTerms,
          agreedPrivacy: input.agreedPrivacy,
          status,
          totalPriceSnapshot,
          items: {
            create: itemPlans.map((plan) => ({
              offeringId: plan.offering.id,
              priceSnapshot: plan.priceSnapshot,
              titleSnapshot: plan.offering.title,
              status: plan.status,
              waitlistOrder: plan.waitlistOrder,
            })),
          },
        },
        include: { items: true },
      });

      // 중첩 생성에서는 applicationId를 알기 전이므로 셔틀 요청은 항목 생성 후 저장한다.
      for (const item of application.items) {
        const requested = input.items.find((candidate) => candidate.offeringId === item.offeringId);
        if (!requested?.shuttle || !byId.get(item.offeringId)?.shuttleAvailable) continue;
        const pickup = requested.shuttle.pickupLocationData;
        const dropoff = requested.shuttle.dropoffLocationData;
        const confirmedAt = pickup || dropoff ? new Date() : undefined;
        await tx.specialProgramShuttleRequest.create({
          data: {
            applicationId: application.id,
            applicationItemId: item.id,
            pickupLocation: requested.shuttle.pickupLocation,
            pickupTime: requested.shuttle.pickupTime,
            dropoffLocation: requested.shuttle.dropoffLocation,
            note: requested.shuttle.note,
            pickupAddress: pickup?.address,
            pickupRoadAddress: pickup?.roadAddress,
            pickupLatitude: pickup?.latitude,
            pickupLongitude: pickup?.longitude,
            pickupPlaceId: pickup?.placeId,
            pickupLocationSource: pickup?.source,
            pickupAccuracyMeters: pickup?.accuracyMeters,
            pickupConfirmedAt: pickup ? confirmedAt : undefined,
            dropoffAddress: dropoff?.address,
            dropoffRoadAddress: dropoff?.roadAddress,
            dropoffLatitude: dropoff?.latitude,
            dropoffLongitude: dropoff?.longitude,
            dropoffPlaceId: dropoff?.placeId,
            dropoffLocationSource: dropoff?.source,
            dropoffAccuracyMeters: dropoff?.accuracyMeters,
            dropoffConfirmedAt: dropoff ? confirmedAt : undefined,
            locationConsentVersion: requested.shuttle.locationConsentVersion,
          },
        });
      }

      await tx.specialProgramAuditLog.create({
        data: { seasonId: season.id, applicationId: application.id, actorType: "PUBLIC", action: "APPLICATION_CREATED", afterJSON: { status, totalPriceSnapshot } },
      });
      return application;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return applicationResponse(created, false);
  } catch (error) {
    if (error instanceof SeasonalError) throw error;
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const duplicateAfterRace = await existingApplication(season.id, input.idempotencyKey);
      if (duplicateAfterRace) return applicationResponse(duplicateAfterRace, true);
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034" && retryCount < 2) {
      return submitSeasonalApplication(slug, input, retryCount + 1);
    }
    throw error;
  }
}
