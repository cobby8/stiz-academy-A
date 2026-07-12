"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import type { SheetClassSlot } from "@/lib/googleSheetsSchedule";
import {
    buildScheduleSlotImportPlan,
    type LegacyCustomSlot,
    type LegacySlotOverride,
    type ScheduleSlotImportIssue,
    type ScheduleSlotImportPlan,
    type ScheduleSlotImportRow,
} from "@/lib/scheduleSlotImport";

type ImportActionResult = {
    success: boolean;
    batchId: string | null;
    imported: number;
    summary: ScheduleSlotImportPlan["summary"];
    issues: ScheduleSlotImportIssue[];
    message: string;
};

function normalizeBool(value: unknown): boolean {
    return value === true || value === "true";
}

function normalizeText(value: unknown): string | null {
    return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function loadLegacyScheduleInputs() {
    const [cacheRows, overridesRows, customRows, coachRows, programRows] = await Promise.all([
        prisma.$queryRawUnsafe<any[]>(`SELECT "slotsJson" FROM "SheetSlotCache" WHERE id = 'singleton' LIMIT 1`),
        prisma.$queryRawUnsafe<any[]>(
            `SELECT "slotKey", label, note, "isHidden", capacity, "coachId", "programId",
                    "startTimeOverride", "endTimeOverride"
             FROM "ClassSlotOverride"`
        ),
        prisma.$queryRawUnsafe<any[]>(
            `SELECT id, "dayKey", "startTime", "endTime", label, "gradeRange",
                    enrolled, capacity, note, "isHidden", "coachId", "programId"
             FROM "CustomClassSlot"`
        ),
        prisma.$queryRawUnsafe<{ id: string }[]>(`SELECT id FROM "Coach"`),
        prisma.$queryRawUnsafe<{ id: string }[]>(`SELECT id FROM "Program"`),
    ]);

    const rawSlots: SheetClassSlot[] = cacheRows[0]
        ? JSON.parse(cacheRows[0].slotsJson ?? cacheRows[0].slotsjson ?? "[]")
        : [];

    const overrides: LegacySlotOverride[] = overridesRows.map((row) => ({
        slotKey: row.slotKey ?? row.slotkey,
        label: normalizeText(row.label),
        note: normalizeText(row.note),
        isHidden: normalizeBool(row.isHidden ?? row.ishidden),
        capacity: row.capacity != null ? Number(row.capacity) : null,
        coachId: normalizeText(row.coachId ?? row.coachid),
        programId: normalizeText(row.programId ?? row.programid),
        startTimeOverride: normalizeText(row.startTimeOverride ?? row.starttimeoverride),
        endTimeOverride: normalizeText(row.endTimeOverride ?? row.endtimeoverride),
    }));

    const customSlots: LegacyCustomSlot[] = customRows.map((row) => ({
        id: row.id,
        dayKey: row.dayKey ?? row.daykey,
        startTime: row.startTime ?? row.starttime,
        endTime: row.endTime ?? row.endtime,
        label: row.label ?? "",
        gradeRange: normalizeText(row.gradeRange ?? row.graderange),
        enrolled: row.enrolled != null ? Number(row.enrolled) : null,
        capacity: row.capacity != null ? Number(row.capacity) : null,
        note: normalizeText(row.note),
        isHidden: normalizeBool(row.isHidden ?? row.ishidden),
        coachId: normalizeText(row.coachId ?? row.coachid),
        programId: normalizeText(row.programId ?? row.programid),
    }));

    return {
        rawSlots,
        overrides,
        customSlots,
        validCoachIds: new Set(coachRows.map((row) => row.id)),
        validProgramIds: new Set(programRows.map((row) => row.id)),
    };
}

async function insertIssue(batchId: string, issue: ScheduleSlotImportIssue) {
    await prisma.$executeRawUnsafe(
        `INSERT INTO "ScheduleImportIssue" (
            id, "batchId", "slotKey", severity, message, "rawJSON", "createdAt"
        ) VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, NOW())`,
        batchId,
        issue.slotKey ?? null,
        issue.severity,
        issue.message,
        issue.rawJSON ?? null,
    );
}

async function upsertScheduleSlot(row: ScheduleSlotImportRow, batchId: string) {
    await prisma.$executeRawUnsafe(
        `INSERT INTO "ScheduleSlot" (
            id, "slotKey", source, period, "dayKey", "dayLabel", "isWeekend",
            "startTime", "endTime", label, "gradeRange", "gradesJSON",
            "enrolledSnapshot", capacity, note, "isHidden", "displayOrder",
            "coachId", "programId", "importBatchId", "rawJSON", "createdAt", "updatedAt"
        ) VALUES (
            gen_random_uuid()::text, $1, $2, $3, $4, $5, $6,
            $7, $8, $9, $10, $11,
            $12, $13, $14, $15, $16,
            $17, $18, $19, $20, NOW(), NOW()
        )
        ON CONFLICT ("slotKey") DO UPDATE SET
            source = EXCLUDED.source,
            period = EXCLUDED.period,
            "dayKey" = EXCLUDED."dayKey",
            "dayLabel" = EXCLUDED."dayLabel",
            "isWeekend" = EXCLUDED."isWeekend",
            "startTime" = EXCLUDED."startTime",
            "endTime" = EXCLUDED."endTime",
            label = EXCLUDED.label,
            "gradeRange" = EXCLUDED."gradeRange",
            "gradesJSON" = EXCLUDED."gradesJSON",
            "enrolledSnapshot" = EXCLUDED."enrolledSnapshot",
            capacity = EXCLUDED.capacity,
            note = EXCLUDED.note,
            "isHidden" = EXCLUDED."isHidden",
            "displayOrder" = EXCLUDED."displayOrder",
            "coachId" = EXCLUDED."coachId",
            "programId" = EXCLUDED."programId",
            "importBatchId" = EXCLUDED."importBatchId",
            "rawJSON" = EXCLUDED."rawJSON",
            "updatedAt" = NOW()`,
        row.slotKey,
        row.source,
        row.period,
        row.dayKey,
        row.dayLabel,
        row.isWeekend,
        row.startTime,
        row.endTime,
        row.label,
        row.gradeRange,
        row.gradesJSON,
        row.enrolledSnapshot,
        row.capacity,
        row.note,
        row.isHidden,
        row.displayOrder,
        row.coachId,
        row.programId,
        batchId,
        row.rawJSON,
    );
}

export async function previewLegacyScheduleSlotImport(): Promise<ScheduleSlotImportPlan> {
    await requireAdmin();
    const inputs = await loadLegacyScheduleInputs();
    return buildScheduleSlotImportPlan(inputs);
}

export async function importLegacyScheduleSlotsToDb(): Promise<ImportActionResult> {
    await requireAdmin();
    const inputs = await loadLegacyScheduleInputs();
    const plan = buildScheduleSlotImportPlan(inputs);
    const batchId = crypto.randomUUID();
    const hasErrors = plan.summary.errorCount > 0;

    await prisma.$executeRawUnsafe(
        `INSERT INTO "ScheduleImportBatch" (
            id, source, status, "totalRows", "validRows", "errorRows",
            message, "rawSummaryJSON", "createdAt", "completedAt"
        ) VALUES ($1, 'LEGACY_SHEET_CACHE', $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
        batchId,
        hasErrors ? "BLOCKED" : "IMPORTED",
        plan.summary.totalSlots,
        plan.summary.validSlots,
        plan.summary.errorCount,
        hasErrors
            ? "오류가 있어 ScheduleSlot 반영을 중단했습니다."
            : "기존 시간표 데이터를 ScheduleSlot으로 이관했습니다.",
        JSON.stringify(plan.summary),
    );

    for (const issue of plan.issues) {
        await insertIssue(batchId, issue);
    }

    if (hasErrors) {
        return {
            success: false,
            batchId,
            imported: 0,
            summary: plan.summary,
            issues: plan.issues,
            message: "오류가 있어 새 시간표 DB에는 반영하지 않았습니다.",
        };
    }

    for (const row of plan.slots) {
        await upsertScheduleSlot(row, batchId);
    }

    revalidatePath("/admin/schedule");
    revalidatePath("/schedule");
    revalidatePath("/simulator");

    return {
        success: true,
        batchId,
        imported: plan.slots.length,
        summary: plan.summary,
        issues: plan.issues,
        message: `${plan.slots.length}개 시간표 슬롯을 새 DB 원본으로 이관했습니다.`,
    };
}
