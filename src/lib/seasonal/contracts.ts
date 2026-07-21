export const SHUTTLE_LOCATION_SOURCES = ["MAP_PIN", "SEARCH", "CURRENT_LOCATION"] as const;
export const SHUTTLE_LOCATION_CONSENT_VERSION = "2026-07-21";
export type ShuttleLocationSource = (typeof SHUTTLE_LOCATION_SOURCES)[number];

export type SeasonalShuttleLocationInput = {
  address: string;
  roadAddress?: string;
  latitude: number;
  longitude: number;
  placeId?: string;
  source: ShuttleLocationSource;
  accuracyMeters?: number;
};

export type SeasonalApplicationInput = {
  idempotencyKey: string;
  applicantType?: "NEW" | "EXISTING";
  selectedWeekdays: SeasonalWeekday[];
  child: {
    name: string;
    birthDate: string;
    gender?: string;
    grade?: string;
    school?: string;
    phone?: string;
  };
  parent: { name: string; phone: string; relation?: string };
  address?: string;
  memo?: string;
  agreedTerms: boolean;
  agreedPrivacy: boolean;
  items: Array<{
    offeringId: string;
    shuttle?: {
      pickupLocation?: string;
      pickupTime?: string;
      dropoffLocation?: string;
      note?: string;
      pickupLocationData?: SeasonalShuttleLocationInput;
      dropoffLocationData?: SeasonalShuttleLocationInput;
      locationConsent?: true;
      locationConsentVersion?: string;
    };
  }>;
};

export const SEASONAL_WEEKDAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const;
export type SeasonalWeekday = (typeof SEASONAL_WEEKDAYS)[number];

const WEEKDAY_ALIASES: Record<string, SeasonalWeekday> = {
  MON: "MON", MONDAY: "MON", 월: "MON", 월요일: "MON",
  TUE: "TUE", TUESDAY: "TUE", 화: "TUE", 화요일: "TUE",
  WED: "WED", WEDNESDAY: "WED", 수: "WED", 수요일: "WED",
  THU: "THU", THURSDAY: "THU", 목: "THU", 목요일: "THU",
  FRI: "FRI", FRIDAY: "FRI", 금: "FRI", 금요일: "FRI",
  SAT: "SAT", SATURDAY: "SAT", 토: "SAT", 토요일: "SAT",
  SUN: "SUN", SUNDAY: "SUN", 일: "SUN", 일요일: "SUN",
};

export function normalizeSeasonalWeekdays(values: unknown): SeasonalWeekday[] {
  if (!Array.isArray(values)) return [];
  const normalized = values.map((value) => WEEKDAY_ALIASES[String(value).trim().toUpperCase()]);
  if (normalized.some((weekday) => !weekday)) throw new SeasonalError("선택 요일을 확인해 주세요.", 400, "INVALID_WEEKDAY");
  return Array.from(new Set(normalized));
}

export class SeasonalError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(
    message: string,
    status = 400,
    code = "INVALID_REQUEST",
  ) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function cleanText(value: unknown, maxLength = 500): string | undefined {
  if (typeof value !== "string") return undefined;
  const cleaned = value.trim();
  return cleaned ? cleaned.slice(0, maxLength) : undefined;
}

export function normalizePhone(value: string): string {
  return value.replace(/[^0-9]/g, "");
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function parseShuttleLocation(
  value: unknown,
  label: string,
): SeasonalShuttleLocationInput | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new SeasonalError(`${label} 위치 정보가 올바르지 않습니다.`, 400, "INVALID_SHUTTLE_LOCATION");
  }

  const location = value as Record<string, unknown>;
  const address = cleanText(location.address, 300);
  const roadAddress = cleanText(location.roadAddress, 300);
  const latitude = finiteNumber(location.latitude);
  const longitude = finiteNumber(location.longitude);
  const source = cleanText(location.source, 30);
  const accuracyMeters = location.accuracyMeters === undefined
    ? undefined
    : finiteNumber(location.accuracyMeters);

  if (!address || latitude === undefined || longitude === undefined) {
    throw new SeasonalError(`${label} 주소와 지도 좌표를 확인해 주세요.`, 400, "INVALID_SHUTTLE_LOCATION");
  }
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    throw new SeasonalError(`${label} 지도 좌표의 범위를 확인해 주세요.`, 400, "INVALID_SHUTTLE_COORDINATES");
  }
  if (!source || !SHUTTLE_LOCATION_SOURCES.includes(source as ShuttleLocationSource)) {
    throw new SeasonalError(`${label} 위치 선택 방식을 확인해 주세요.`, 400, "INVALID_SHUTTLE_LOCATION_SOURCE");
  }
  if (location.accuracyMeters !== undefined && (accuracyMeters === undefined || accuracyMeters < 0 || accuracyMeters > 100_000)) {
    throw new SeasonalError(`${label} 위치 정확도를 확인해 주세요.`, 400, "INVALID_SHUTTLE_ACCURACY");
  }

  return {
    address,
    roadAddress,
    latitude,
    longitude,
    placeId: cleanText(location.placeId, 200),
    source: source as ShuttleLocationSource,
    accuracyMeters,
  };
}

export function parseApplicationInput(value: unknown): SeasonalApplicationInput {
  const body = value as Partial<SeasonalApplicationInput> | null;
  const key = cleanText(body?.idempotencyKey, 120);
  const childName = cleanText(body?.child?.name, 80);
  const parentName = cleanText(body?.parent?.name, 80);
  const parentPhone = normalizePhone(cleanText(body?.parent?.phone, 30) || "");
  const birthDate = cleanText(body?.child?.birthDate, 30);
  const birth = birthDate ? new Date(birthDate) : null;
  const applicantType = body?.applicantType;
  if (applicantType !== undefined && applicantType !== "NEW" && applicantType !== "EXISTING") {
    throw new SeasonalError("신청자 구분을 확인해 주세요.");
  }
  const selectedWeekdays = normalizeSeasonalWeekdays(body?.selectedWeekdays);

  if (!key) throw new SeasonalError("중복 제출 방지 키가 필요합니다.");
  if (!childName || !birth || Number.isNaN(birth.getTime())) throw new SeasonalError("학생 이름과 생년월일을 확인해 주세요.");
  if (!parentName || parentPhone.length < 10 || parentPhone.length > 11) throw new SeasonalError("보호자 이름과 연락처를 확인해 주세요.");
  if (!body?.agreedTerms || !body?.agreedPrivacy) throw new SeasonalError("약관과 개인정보 처리에 동의해 주세요.");
  if (!Array.isArray(body.items) || body.items.length === 0) throw new SeasonalError("특강을 한 개 이상 선택해 주세요.");
  if (body.items.length > 20) throw new SeasonalError("특강은 한 번에 최대 20개까지 신청할 수 있습니다.", 413, "TOO_MANY_ITEMS");
  if (selectedWeekdays.length === 0) throw new SeasonalError("수강할 요일을 한 개 이상 선택해 주세요.", 400, "WEEKDAY_REQUIRED");

  const seen = new Set<string>();
  const items = body.items.map((item) => {
    const offeringId = cleanText(item?.offeringId, 100);
    if (!offeringId || seen.has(offeringId)) throw new SeasonalError("특강 선택 항목이 올바르지 않습니다.");
    seen.add(offeringId);
    const pickupLocationData = parseShuttleLocation(item.shuttle?.pickupLocationData, "탑승");
    const dropoffLocationData = parseShuttleLocation(item.shuttle?.dropoffLocationData, "하차");
    const hasMapLocation = Boolean(pickupLocationData || dropoffLocationData);
    const locationConsentVersion = cleanText(item.shuttle?.locationConsentVersion, 80);
    if (hasMapLocation && (
      item.shuttle?.locationConsent !== true
      || locationConsentVersion !== SHUTTLE_LOCATION_CONSENT_VERSION
    )) {
      throw new SeasonalError(
        "셔틀 위치정보 수집 및 이용에 동의해 주세요.",
        400,
        "SHUTTLE_LOCATION_CONSENT_REQUIRED",
      );
    }

    return {
      offeringId,
      shuttle: item.shuttle
        ? {
            pickupLocation: cleanText(item.shuttle.pickupLocation, 200),
            pickupTime: cleanText(item.shuttle.pickupTime, 30),
            dropoffLocation: cleanText(item.shuttle.dropoffLocation, 200),
            note: cleanText(item.shuttle.note, 500),
            pickupLocationData,
            dropoffLocationData,
            locationConsent: hasMapLocation ? true as const : undefined,
            locationConsentVersion: hasMapLocation ? locationConsentVersion : undefined,
          }
        : undefined,
    };
  });

  return {
    idempotencyKey: key,
    applicantType,
    selectedWeekdays,
    child: {
      name: childName,
      birthDate: birth.toISOString(),
      gender: cleanText(body.child?.gender, 30),
      grade: cleanText(body.child?.grade, 50),
      school: cleanText(body.child?.school, 100),
      phone: cleanText(body.child?.phone, 30),
    },
    parent: { name: parentName, phone: parentPhone, relation: cleanText(body.parent?.relation, 30) },
    address: cleanText(body.address, 300),
    memo: cleanText(body.memo, 1000),
    agreedTerms: true,
    agreedPrivacy: true,
    items,
  };
}
