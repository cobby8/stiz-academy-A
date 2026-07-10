import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import { fetchSheetScheduleAdmin } from "@/lib/googleSheetsSchedule";
import {
    getAcademySettings,
    getClassSlotOverrides,
    getCoaches,
    getCustomClassSlots,
    getPrograms,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

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
            sheetUrl ? fetchSheetScheduleAdmin(sheetUrl).catch(() => []) : Promise.resolve([]),
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
            { headers: { "Cache-Control": "no-store" } },
        );
    } catch (error) {
        console.error("[api/admin/schedule] failed:", error);
        return NextResponse.json({ error: "Failed to load schedule data" }, { status: 500 });
    }
}
