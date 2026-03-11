import { getAcademySettings, getClassSlotOverrides, getCoaches, getCustomClassSlots, getPrograms } from "@/lib/queries";
import { fetchSheetScheduleAdmin } from "@/lib/googleSheetsSchedule";
import ScheduleAdminClient from "./ScheduleAdminClient";

export const dynamic = "force-dynamic";

export default async function AdminSchedulePage() {
    const settings = await getAcademySettings() as any;
    const sheetUrl = settings?.googleSheetsScheduleUrl as string | null | undefined;

    const [slots, overrides, coaches, customSlots, programs] = await Promise.all([
        sheetUrl ? fetchSheetScheduleAdmin(sheetUrl) : Promise.resolve([]),
        getClassSlotOverrides(),
        getCoaches(),
        getCustomClassSlots(),
        getPrograms(),
    ]);

    return (
        <ScheduleAdminClient
            slots={slots}
            overrides={overrides as any[]}
            coaches={coaches as any[]}
            customSlots={customSlots as any[]}
            hasSheetUrl={!!sheetUrl}
            sheetUrl={sheetUrl ?? null}
            programs={programs as any[]}
        />
    );
}
