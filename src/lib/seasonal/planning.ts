import type { SeasonalWeekday } from "./contracts";

export type ApplicantType = "NEW" | "EXISTING";
export type ApplicantTypeDecision = {
  serverType: ApplicantType;
  pricingType: ApplicantType;
  requiresReview: boolean;
  reviewReasons: string[];
};
export type CapacityOffering = {
  id: string;
  capacity: number | null;
  price: number;
  newApplicantPrice?: number | null;
  existingApplicantPrice?: number | null;
  shuttleAvailable?: boolean;
  shuttleFee?: number;
  title: string;
};

const WEEKDAY_FROM_SHORT = new Map<string, SeasonalWeekday>([
  ["Mon", "MON"], ["Tue", "TUE"], ["Wed", "WED"], ["Thu", "THU"],
  ["Fri", "FRI"], ["Sat", "SAT"], ["Sun", "SUN"],
]);

export function weekdayInSeoul(value: Date): SeasonalWeekday {
  const short = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Seoul", weekday: "short" }).format(value);
  const weekday = WEEKDAY_FROM_SHORT.get(short);
  if (!weekday) throw new Error("WEEKDAY_RESOLUTION_FAILED");
  return weekday;
}

export function resolveOfferingPrice(offering: CapacityOffering, applicantType?: ApplicantType) {
  if (applicantType === "NEW" && offering.newApplicantPrice !== null && offering.newApplicantPrice !== undefined) {
    return offering.newApplicantPrice;
  }
  if (applicantType === "EXISTING" && offering.existingApplicantPrice !== null && offering.existingApplicantPrice !== undefined) {
    return offering.existingApplicantPrice;
  }
  return offering.price;
}

export function resolveShuttleFee(offering: CapacityOffering, shuttleRequested: boolean, isFreeHub = false) {
  if (!shuttleRequested || !offering.shuttleAvailable) return 0;
  // 무료 탑승 거점(1호점) 이용 학생은 셔틀 목록엔 포함되지만 셔틀비를 받지 않는다.
  if (isFreeHub) return 0;
  return Math.max(0, offering.shuttleFee ?? 0);
}

// 무료 탑승 거점 이용 여부 — 탑승 위치 라벨에 '무료탑승'이 들어가면 거점 이용으로 본다.
//   (배차 로직 isFreeHubLabel과 같은 기준. 순환 import 회피 위해 규칙을 여기에도 둔다.)
export function isFreeHubShuttle(shuttle: { pickupLocation?: string | null } | undefined | null): boolean {
  return (shuttle?.pickupLocation ?? "").replace(/\s/g, "").includes("무료탑승");
}

export function hasSeasonalShuttleSelection(shuttle: {
  pickupLocation?: string;
  pickupTime?: string;
  dropoffLocation?: string;
  pickupLocationData?: unknown;
  dropoffLocationData?: unknown;
} | undefined) {
  return Boolean(
    shuttle?.pickupLocation
    || shuttle?.dropoffLocation
    || shuttle?.pickupLocationData
    || shuttle?.dropoffLocationData,
  );
}

export function decideApplicantType(claimedType: ApplicantType | undefined, existingStudent: boolean): ApplicantTypeDecision {
  const serverType: ApplicantType = existingStudent ? "EXISTING" : "NEW";
  if (!claimedType) {
    return { serverType, pricingType: "NEW", requiresReview: true, reviewReasons: ["APPLICANT_TYPE_UNCONFIRMED"] };
  }
  if (claimedType !== serverType) {
    return { serverType, pricingType: "NEW", requiresReview: true, reviewReasons: ["APPLICANT_TYPE_MISMATCH"] };
  }
  return { serverType, pricingType: serverType, requiresReview: false, reviewReasons: [] };
}

export function planApplicationItems(
  offerings: CapacityOffering[],
  occupiedByOffering: ReadonlyMap<string, number>,
  maxWaitlistOrderByOffering: ReadonlyMap<string, number>,
  applicantType?: ApplicantType,
  shuttleRequestedByOffering: ReadonlySet<string> = new Set(),
) {
  return offerings.map((offering) => {
    const full = offering.capacity !== null && (occupiedByOffering.get(offering.id) || 0) >= offering.capacity;
    const tuitionPriceSnapshot = resolveOfferingPrice(offering, applicantType);
    const shuttleFeeSnapshot = resolveShuttleFee(offering, shuttleRequestedByOffering.has(offering.id));
    return {
      offeringId: offering.id,
      tuitionPriceSnapshot,
      shuttleFeeSnapshot,
      priceSnapshot: tuitionPriceSnapshot + shuttleFeeSnapshot,
      titleSnapshot: offering.title,
      status: full ? "WAITLISTED" : "PENDING",
      waitlistOrder: full ? (maxWaitlistOrderByOffering.get(offering.id) || 0) + 1 : null,
    };
  });
}

export function totalSnapshot(items: Array<{ priceSnapshot: number }>) {
  return items.reduce((sum, item) => sum + item.priceSnapshot, 0);
}
