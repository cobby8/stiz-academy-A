import { getAcademySettings, getClassSlotOverrides, getCoaches } from "@/lib/queries";
import { fetchSheetScheduleAdmin } from "@/lib/googleSheetsSchedule";
import ScheduleAdminClient from "./ScheduleAdminClient";

export default async function AdminSchedulePage() {
    const settings = await getAcademySettings() as any;
    const sheetUrl = settings?.googleSheetsScheduleUrl as string | null | undefined;

    const [slots, overrides, coaches] = await Promise.all([
        sheetUrl ? fetchSheetScheduleAdmin(sheetUrl) : Promise.resolve([]),
        getClassSlotOverrides(),
        getCoaches(),
    ]);

    return (
        <ScheduleAdminClient
            slots={slots}
            overrides={overrides as any[]}
            coaches={coaches as any[]}
            hasSheetUrl={!!sheetUrl}
        />
    );
}
