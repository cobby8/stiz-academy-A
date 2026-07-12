import type { SheetClassSlot } from "@/lib/googleSheetsSchedule";

const VALID_DAY_KEYS = new Set(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export type LegacySlotOverride = {
    slotKey: string;
    label?: string | null;
    note?: string | null;
    isHidden?: boolean | null;
    capacity?: number | null;
    coachId?: string | null;
    programId?: string | null;
    startTimeOverride?: string | null;
    endTimeOverride?: string | null;
};

export type LegacyCustomSlot = {
    id: string;
    dayKey: string;
    startTime: string;
    endTime: string;
    label: string;
    gradeRange?: string | null;
    enrolled?: number | null;
    capacity?: number | null;
    note?: string | null;
    isHidden?: boolean | null;
    coachId?: string | null;
    programId?: string | null;
};

export type ScheduleSlotImportRow = {
    slotKey: string;
    source: "GOOGLE_SHEETS" | "CUSTOM_SLOT";
    period: number | null;
    dayKey: string;
    dayLabel: string | null;
    isWeekend: boolean;
    startTime: string;
    endTime: string;
    label: string | null;
    gradeRange: string | null;
    gradesJSON: string;
    enrolledSnapshot: number;
    capacity: number;
    note: string | null;
    isHidden: boolean;
    displayOrder: number;
    coachId: string | null;
    programId: string | null;
    rawJSON: string;
};

export type ScheduleSlotImportIssue = {
    slotKey?: string;
    severity: "ERROR" | "WARNING";
    message: string;
    rawJSON?: string;
};

export type ScheduleSlotImportPlan = {
    slots: ScheduleSlotImportRow[];
    issues: ScheduleSlotImportIssue[];
    summary: {
        totalSlots: number;
        validSlots: number;
        errorCount: number;
        warningCount: number;
        enrollmentMismatchCount: number;
    };
};

type BuildImportPlanInput = {
    rawSlots: SheetClassSlot[];
    overrides: LegacySlotOverride[];
    customSlots: LegacyCustomSlot[];
    validCoachIds?: Set<string>;
    validProgramIds?: Set<string>;
    enrollmentCountsBySlotKey?: Map<string, number>;
};

function toSafeInt(value: unknown, fallback: number): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : fallback;
}

function toNullableText(value: unknown): string | null {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

function compareTime(left: string, right: string): number {
    return left.localeCompare(right);
}

function validateSlot(
    slot: ScheduleSlotImportRow,
    seenSlotKeys: Set<string>,
    validCoachIds?: Set<string>,
    validProgramIds?: Set<string>,
    enrollmentCountsBySlotKey?: Map<string, number>,
): ScheduleSlotImportIssue[] {
    const issues: ScheduleSlotImportIssue[] = [];
    const rawJSON = slot.rawJSON;

    if (!slot.slotKey) {
        issues.push({ severity: "ERROR", message: "slotKey가 없습니다.", rawJSON });
    } else if (seenSlotKeys.has(slot.slotKey)) {
        issues.push({ slotKey: slot.slotKey, severity: "ERROR", message: "중복된 slotKey입니다.", rawJSON });
    }

    if (!VALID_DAY_KEYS.has(slot.dayKey)) {
        issues.push({ slotKey: slot.slotKey, severity: "ERROR", message: `알 수 없는 요일 코드입니다: ${slot.dayKey}`, rawJSON });
    }

    if (!TIME_PATTERN.test(slot.startTime) || !TIME_PATTERN.test(slot.endTime)) {
        issues.push({ slotKey: slot.slotKey, severity: "ERROR", message: "수업 시간이 HH:MM 형식이 아닙니다.", rawJSON });
    } else if (compareTime(slot.startTime, slot.endTime) >= 0) {
        issues.push({ slotKey: slot.slotKey, severity: "ERROR", message: "종료 시간이 시작 시간보다 빠르거나 같습니다.", rawJSON });
    }

    if (slot.capacity < 1) {
        issues.push({ slotKey: slot.slotKey, severity: "ERROR", message: "정원은 1명 이상이어야 합니다.", rawJSON });
    }

    if (slot.enrolledSnapshot > slot.capacity) {
        issues.push({ slotKey: slot.slotKey, severity: "WARNING", message: "이관 시점 인원이 정원보다 많습니다.", rawJSON });
    }

    const currentEnrollmentCount = enrollmentCountsBySlotKey?.get(slot.slotKey);
    if (currentEnrollmentCount != null && currentEnrollmentCount !== slot.enrolledSnapshot) {
        issues.push({
            slotKey: slot.slotKey,
            severity: "WARNING",
            message: `시트 인원(${slot.enrolledSnapshot}명)과 현재 등록 인원(${currentEnrollmentCount}명)이 다릅니다. 실제 운영 인원은 등록 데이터를 기준으로 계산됩니다.`,
            rawJSON,
        });
    }

    if (slot.coachId && validCoachIds && !validCoachIds.has(slot.coachId)) {
        issues.push({ slotKey: slot.slotKey, severity: "WARNING", message: "존재하지 않는 코치 ID가 연결되어 있습니다.", rawJSON });
    }

    if (slot.programId && validProgramIds && !validProgramIds.has(slot.programId)) {
        issues.push({ slotKey: slot.slotKey, severity: "WARNING", message: "존재하지 않는 프로그램 ID가 연결되어 있습니다.", rawJSON });
    }

    return issues;
}

export function buildScheduleSlotImportPlan({
    rawSlots,
    overrides,
    customSlots,
    validCoachIds,
    validProgramIds,
    enrollmentCountsBySlotKey,
}: BuildImportPlanInput): ScheduleSlotImportPlan {
    const overrideMap = new Map(overrides.map((override) => [override.slotKey, override]));
    const seenSlotKeys = new Set<string>();
    const slots: ScheduleSlotImportRow[] = [];
    const issues: ScheduleSlotImportIssue[] = [];

    for (const sheetSlot of rawSlots) {
        const override = overrideMap.get(sheetSlot.slotKey);
        const startTime = toNullableText(override?.startTimeOverride) ?? sheetSlot.startTime;
        const endTime = toNullableText(override?.endTimeOverride) ?? sheetSlot.endTime;
        const capacity = toSafeInt(override?.capacity, 12);
        const row: ScheduleSlotImportRow = {
            slotKey: sheetSlot.slotKey,
            source: "GOOGLE_SHEETS",
            period: sheetSlot.period,
            dayKey: sheetSlot.dayKey,
            dayLabel: sheetSlot.dayLabel,
            isWeekend: sheetSlot.isWeekend,
            startTime,
            endTime,
            label: toNullableText(override?.label),
            gradeRange: toNullableText(sheetSlot.gradeRange),
            gradesJSON: JSON.stringify(sheetSlot.grades ?? []),
            enrolledSnapshot: toSafeInt(sheetSlot.enrolled, 0),
            capacity,
            note: toNullableText(override?.note),
            isHidden: Boolean(override?.isHidden),
            displayOrder: (sheetSlot.period ?? 0) * 10,
            coachId: toNullableText(override?.coachId),
            programId: toNullableText(override?.programId),
            rawJSON: JSON.stringify({ sheetSlot, override: override ?? null }),
        };

        const rowIssues = validateSlot(row, seenSlotKeys, validCoachIds, validProgramIds, enrollmentCountsBySlotKey);
        issues.push(...rowIssues);
        if (!rowIssues.some((issue) => issue.severity === "ERROR")) {
            slots.push(row);
            seenSlotKeys.add(row.slotKey);
        }
    }

    for (const customSlot of customSlots) {
        const row: ScheduleSlotImportRow = {
            slotKey: `custom-${customSlot.id}`,
            source: "CUSTOM_SLOT",
            period: null,
            dayKey: customSlot.dayKey,
            dayLabel: null,
            isWeekend: customSlot.dayKey === "Sat" || customSlot.dayKey === "Sun",
            startTime: customSlot.startTime,
            endTime: customSlot.endTime,
            label: customSlot.label,
            gradeRange: toNullableText(customSlot.gradeRange),
            gradesJSON: "[]",
            enrolledSnapshot: toSafeInt(customSlot.enrolled, 0),
            capacity: toSafeInt(customSlot.capacity, 12),
            note: toNullableText(customSlot.note),
            isHidden: Boolean(customSlot.isHidden),
            displayOrder: 1000 + slots.length * 10,
            coachId: toNullableText(customSlot.coachId),
            programId: toNullableText(customSlot.programId),
            rawJSON: JSON.stringify({ customSlot }),
        };

        const rowIssues = validateSlot(row, seenSlotKeys, validCoachIds, validProgramIds, enrollmentCountsBySlotKey);
        issues.push(...rowIssues);
        if (!rowIssues.some((issue) => issue.severity === "ERROR")) {
            slots.push(row);
            seenSlotKeys.add(row.slotKey);
        }
    }

    const errorCount = issues.filter((issue) => issue.severity === "ERROR").length;
    const warningCount = issues.filter((issue) => issue.severity === "WARNING").length;
    const enrollmentMismatchCount = issues.filter((issue) => issue.message.includes("현재 등록 인원")).length;

    return {
        slots,
        issues,
        summary: {
            totalSlots: rawSlots.length + customSlots.length,
            validSlots: slots.length,
            errorCount,
            warningCount,
            enrollmentMismatchCount,
        },
    };
}
