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

export async function GET() {
    const timing = createAdminTiming("admin-schedule");

    try {
        await requireTimedAdmin(timing);
    } catch {
        return timedJson(timing, { error: "Authentication required" }, { status: 401 });
    }

    try {
        const settings = await timing.measure("settings", () => getAcademySettings() as Promise<any>);
        const sheetUrl = settings?.googleSheetsScheduleUrl as string | null | undefined;

        const [overrides, coaches, customSlots, programs, legacySlots, dbScheduleData] = await timing.measure("data", () => Promise.all([
            getClassSlotOverrides(),
            getCoaches(),
            getCustomClassSlots(),
            getPrograms(),
            sheetUrl ? getSheetSlotCache().then((cachedSlots) => cachedSlots ?? []) : Promise.resolve([]),
            getScheduleSlotAdminData(),
        ]));
        const scheduleData = dbScheduleData ?? {
            slots: legacySlots,
            overrides,
            customSlots,
            scheduleSource: "SHEET_CACHE" as const,
        };

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
