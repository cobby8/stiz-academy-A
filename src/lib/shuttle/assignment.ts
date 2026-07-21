export type ActiveShuttleAssignment = {
  routePlanId: string;
  stopId: string;
  routePlan: { status: "DRAFT" | "CONFIRMED" | "ARCHIVED" };
};

export function chooseActiveShuttleAssignment<T extends ActiveShuttleAssignment>(
  assignments: readonly T[],
  preferredRouteId?: string,
): T | undefined {
  return assignments.find((row) => row.routePlanId === preferredRouteId)
    ?? assignments.find((row) => row.routePlan.status === "CONFIRMED")
    ?? assignments[0];
}
