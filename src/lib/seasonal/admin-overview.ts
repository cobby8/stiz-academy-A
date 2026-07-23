import { prisma } from "@/lib/prisma";

export type SeasonalAdminStats = {
  pending: number;
  confirmed: number;
  unpaid: number;
  waitlisted: number;
  shuttleUnassigned: number;
};

export async function getSeasonalAdminStats(): Promise<SeasonalAdminStats> {
  const rows = await prisma.$queryRawUnsafe<Array<{
    pending: number | string | null;
    confirmed: number | string | null;
    unpaid: number | string | null;
    waitlisted: number | string | null;
    shuttleUnassigned: number | string | null;
  }>>(
    `SELECT
        COUNT(DISTINCT app.id) FILTER (WHERE item.status = 'PENDING')::int AS pending,
        COUNT(DISTINCT app.id) FILTER (WHERE item.status = 'APPROVED')::int AS confirmed,
        COUNT(DISTINCT app.id) FILTER (
          WHERE item.status = 'APPROVED'
            AND NOT (payment.status IN ('PAID','COMPLETED') OR invoice.status IN ('PAID','COMPLETED'))
        )::int AS unpaid,
        COUNT(DISTINCT app.id) FILTER (WHERE item.status = 'WAITLISTED' OR app.status = 'PARTIALLY_WAITLISTED')::int AS waitlisted,
        COUNT(DISTINCT app.id) FILTER (
          WHERE shuttle.id IS NOT NULL
            AND (shuttle."assignedRouteId" IS NULL OR shuttle."assignedStopId" IS NULL)
        )::int AS "shuttleUnassigned"
       FROM "SpecialProgramApplication" app
       LEFT JOIN "SpecialProgramApplicationItem" item ON item."applicationId" = app.id
       LEFT JOIN "Payment" payment ON payment.id = item."paymentId"
       LEFT JOIN "PaymentInvoice" invoice ON invoice."paymentId" = item."paymentId"
       LEFT JOIN "SpecialProgramShuttleRequest" shuttle ON shuttle."applicationItemId" = item.id`,
  );
  const row = rows[0] ?? {};

  return {
    pending: Number(row.pending ?? 0),
    confirmed: Number(row.confirmed ?? 0),
    unpaid: Number(row.unpaid ?? 0),
    waitlisted: Number(row.waitlisted ?? 0),
    shuttleUnassigned: Number(row.shuttleUnassigned ?? 0),
  };
}

export async function getSeasonalAdminOverview(seasonId?: string) {
  const [seasons, stats] = await Promise.all([
    prisma.specialProgramSeason.findMany({
      where: seasonId ? { id: seasonId } : undefined,
      orderBy: { startsAt: "desc" },
      include: {
        offerings: {
          orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
          include: {
            sessionDates: { orderBy: { startsAt: "asc" } },
            _count: { select: { applicationItems: true } },
          },
        },
      },
    }),
    getSeasonalAdminStats(),
  ]);

  return { seasons, applications: [], stats };
}
