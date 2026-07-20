export type CapacityOffering = { id: string; capacity: number; price: number; title: string };

export function planApplicationItems(
  offerings: CapacityOffering[],
  occupiedByOffering: ReadonlyMap<string, number>,
  maxWaitlistOrderByOffering: ReadonlyMap<string, number>,
) {
  return offerings.map((offering) => {
    const full = (occupiedByOffering.get(offering.id) || 0) >= offering.capacity;
    return {
      offeringId: offering.id,
      priceSnapshot: offering.price,
      titleSnapshot: offering.title,
      status: full ? "WAITLISTED" : "PENDING",
      waitlistOrder: full ? (maxWaitlistOrderByOffering.get(offering.id) || 0) + 1 : null,
    };
  });
}

export function totalSnapshot(items: Array<{ priceSnapshot: number }>) {
  return items.reduce((sum, item) => sum + item.priceSnapshot, 0);
}

