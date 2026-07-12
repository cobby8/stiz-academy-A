import { createAdminTiming, requireTimedAdmin, timedJson } from "@/lib/adminTiming";
import {
    getAcademySettings,
    getClassSlotOverrides,
    getCoaches,
    getCustomClassSlots,
    getPrograms,
    getSheetSlotCache,
} from "@/lib/queries";

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

        const [overrides, coaches, customSlots, programs, slots] = await timing.measure("data", () => Promise.all([
            getClassSlotOverrides(),
            getCoaches(),
            getCustomClassSlots(),
            getPrograms(),
            sheetUrl ? getSheetSlotCache().then((cachedSlots) => cachedSlots ?? []) : Promise.resolve([]),
        ]));

        return timedJson(
            timing,
            {
                slots,
                overrides,
                coaches,
                customSlots,
                hasSheetUrl: Boolean(sheetUrl),
                sheetUrl: sheetUrl ?? null,
                programs,
            },
            { headers: SCHEDULE_CACHE_HEADERS },
        );
    } catch (error) {
        console.error("[api/admin/schedule] failed:", error);
        return timedJson(timing, { error: "Failed to load schedule data" }, { status: 500 });
    }
}
