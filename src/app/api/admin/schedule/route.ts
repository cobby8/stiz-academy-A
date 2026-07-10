import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
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
    try {
        await requireAdmin();
    } catch {
        return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    try {
        const settings = await (getAcademySettings() as Promise<any>);
        const sheetUrl = settings?.googleSheetsScheduleUrl as string | null | undefined;

        const [overrides, coaches, customSlots, programs, slots] = await Promise.all([
            getClassSlotOverrides(),
            getCoaches(),
            getCustomClassSlots(),
            getPrograms(),
            sheetUrl ? getSheetSlotCache().then((cachedSlots) => cachedSlots ?? []) : Promise.resolve([]),
        ]);

        return NextResponse.json(
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
        return NextResponse.json({ error: "Failed to load schedule data" }, { status: 500 });
    }
}
