export type SeasonalClass = {
  id: string;
  name: string;
  dayLabel: string;
  dateLabel?: string;
  startTime: string;
  endTime: string;
  location?: string;
  targetGrade?: string;
  coachName?: string;
  capacity: number;
  enrolled: number;
  remaining: number;
  price: number;
  waitlistEnabled?: boolean;
  weekdays: Array<"MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT" | "SUN">;
};

export type SeasonalProgram = {
  id: string;
  slug: string;
  title: string;
  summary?: string;
  status: "UPCOMING" | "OPEN" | "CLOSED" | "ENDED";
  applicationStart?: string;
  applicationEnd?: string;
  operationStart?: string;
  operationEnd?: string;
  location?: string;
  shuttleNotice?: string;
  refundPolicy?: string;
  classes: SeasonalClass[];
  offerings?: SeasonalClass[];
};

export type SeasonalListResponse = { programs?: unknown[]; seasons?: unknown[] } | unknown[];

export function extractPrograms(payload: SeasonalListResponse): SeasonalProgram[] {
  const rows = Array.isArray(payload) ? payload : payload.programs ?? payload.seasons ?? [];
  return rows.map(normalizeProgram);
}

export function formatWon(value: number) {
  return `${new Intl.NumberFormat("ko-KR").format(value)}원`;
}

export function statusLabel(status: SeasonalProgram["status"]) {
  return { UPCOMING: "모집 예정", OPEN: "신청 가능", CLOSED: "모집 마감", ENDED: "운영 종료" }[status];
}

export function programClasses(program: SeasonalProgram) {
  return program.offerings ?? program.classes ?? [];
}

type ApiRecord = Record<string, unknown>;

export function normalizeProgram(value: unknown): SeasonalProgram {
  const row = value as ApiRecord;
  const now = Date.now();
  const opens = String(row.applicationOpensAt ?? row.applicationStart ?? "");
  const closes = String(row.applicationClosesAt ?? row.applicationEnd ?? "");
  const isOpen = (!opens || new Date(opens).getTime() <= now) && (!closes || now <= new Date(closes).getTime());
  const rawStatus = String(row.status ?? "PUBLISHED");
  const offerings = ((row.offerings ?? row.classes ?? []) as ApiRecord[]).map(normalizeOffering);
  return {
    id: String(row.id ?? ""), slug: String(row.slug ?? ""), title: String(row.title ?? row.name ?? "방학특강"),
    summary: stringOrUndefined(row.description ?? row.summary),
    status: rawStatus === "PUBLISHED" ? isOpen ? "OPEN" : closes && now > new Date(closes).getTime() ? "CLOSED" : "UPCOMING" : rawStatus === "ARCHIVED" ? "ENDED" : rawStatus as SeasonalProgram["status"],
    applicationStart: opens || undefined, applicationEnd: closes || undefined,
    operationStart: stringOrUndefined(row.startsAt ?? row.operationStart), operationEnd: stringOrUndefined(row.endsAt ?? row.operationEnd),
    location: stringOrUndefined(row.location), shuttleNotice: stringOrUndefined(row.shuttleNotice),
    refundPolicy: stringOrUndefined(row.cancellationPolicy ?? row.refundPolicy), classes: offerings, offerings,
  };
}

function normalizeOffering(row: ApiRecord): SeasonalClass {
  const dates = (row.sessionDates ?? []) as ApiRecord[];
  const first = dates[0];
  const starts = first?.startsAt ? new Date(String(first.startsAt)) : null;
  const ends = first?.endsAt ? new Date(String(first.endsAt)) : null;
  const remaining = Number(row.remainingCapacity ?? row.remaining ?? Math.max(0, Number(row.capacity ?? 0) - Number(row.enrolled ?? 0)));
  const weekdayByLabel = { 월: "MON", 화: "TUE", 수: "WED", 목: "THU", 금: "FRI", 토: "SAT", 일: "SUN" } as const;
  const weekdays = Array.from(new Set(dates.flatMap((date) => {
    if (!date.startsAt) return [];
    const label = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", weekday: "short" }).format(new Date(String(date.startsAt))).slice(0, 1);
    return weekdayByLabel[label as keyof typeof weekdayByLabel] ? [weekdayByLabel[label as keyof typeof weekdayByLabel]] : [];
  })));
  return {
    id: String(row.id ?? ""), name: String(row.title ?? row.name ?? "특강반"),
    dayLabel: String(row.dayLabel ?? (starts ? new Intl.DateTimeFormat("ko-KR", { weekday: "short" }).format(starts) : "일정")),
    dateLabel: starts ? new Intl.DateTimeFormat("ko-KR", { month: "numeric", day: "numeric" }).format(starts) : undefined,
    startTime: String(row.startTime ?? (starts ? starts.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false }) : "")),
    endTime: String(row.endTime ?? (ends ? ends.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false }) : "")),
    location: stringOrUndefined(row.location ?? first?.location), targetGrade: stringOrUndefined(row.targetGrades ?? row.targetGrade),
    coachName: stringOrUndefined(row.instructorName ?? row.coachName), capacity: Number(row.capacity ?? 0),
    enrolled: Math.max(0, Number(row.capacity ?? 0) - remaining), remaining, price: Number(row.price ?? 0),
    waitlistEnabled: row.waitlistEnabled === false ? false : true,
    weekdays,
  };
}

function stringOrUndefined(value: unknown) { return value == null || value === "" ? undefined : String(value); }
