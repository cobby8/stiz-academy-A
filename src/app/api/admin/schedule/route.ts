import { createAdminTiming, requireTimedAdmin, timedJson } from "@/lib/adminTiming";
import {
    getAcademySettings,
    getClassSlotOverrides,
    getCoaches,
    getCustomClassSlots,
    getPrograms,
    getSheetSlotCache,
} from "@/lib/queries";
import { getScheduleSlotAdminData } from "@/lib/scheduleSlotPayload";

const SCHEDULE_CACHE_HEADERS = {
    "Cache-Control": "private, max-age=30, stale-while-revalidate=120",
};

type AdminScheduleSettings = {
    googleSheetsScheduleUrl?: string | null;
    googlesheetsscheduleurl?: string | null;
} | null;

export async function GET() {
    const timing = createAdminTiming("admin-schedule");

    try {
        await requireTimedAdmin(timing);
    } catch {
        return timedJson(timing, { error: "Authentication required" }, { status: 401 });
    }

    try {
        const [settings, dbScheduleData, coaches, programs] = await timing.measure("primary-data", () => Promise.all([
            getAcademySettings() as Promise<AdminScheduleSettings>,
            getScheduleSlotAdminData(),
            getCoaches(),
            getPrograms(),
        ]));
        const sheetUrl = settings?.googleSheetsScheduleUrl ?? settings?.googlesheetsscheduleurl ?? null;

        let scheduleData = dbScheduleData;
        if (!scheduleData) {
            const [overrides, customSlots, legacySlots] = await timing.measure("legacy-fallback-data", () => Promise.all([
                getClassSlotOverrides(),
                getCustomClassSlots(),
                sheetUrl ? getSheetSlotCache().then((cachedSlots) => cachedSlots ?? []) : Promise.resolve([]),
            ]));
            scheduleData = {
                slots: legacySlots,
                overrides,
                customSlots,
                scheduleSource: "SHEET_CACHE" as const,
            };
        }

        return timedJson(
            timing,
            {
                slots: scheduleData.slots,
                overrides: scheduleData.overrides,
                coaches,
                customSlots: scheduleData.customSlots,
                hasSheetUrl: Boolean(sheetUrl) || Boolean(dbScheduleData),
                sheetUrl: sheetUrl ?? null,
                programs,
                scheduleSource: scheduleData.scheduleSource,
            },
            { headers: SCHEDULE_CACHE_HEADERS },
        );
    } catch (error) {
        console.error("[api/admin/schedule] failed:", error);
        return timedJson(timing, { error: "Failed to load schedule data" }, { status: 500 });
    }
}
