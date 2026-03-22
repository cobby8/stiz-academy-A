import { getAcademySettings, getClassSlotOverrides, getCoaches, getCustomClassSlots, getPrograms } from "@/lib/queries";
import { fetchSheetScheduleAdmin } from "@/lib/googleSheetsSchedule";
import ScheduleAdminClient from "./ScheduleAdminClient";

export const revalidate = 30;

export default async function AdminSchedulePage() {
    // settings와 나머지 4개 쿼리를 동시에 시작 (직렬 → 병렬 최적화)
    const [settings, overrides, coaches, customSlots, programs] = await Promise.all([
        getAcademySettings() as Promise<any>,
        getClassSlotOverrides(),
        getCoaches(),
        getCustomClassSlots(),
        getPrograms(),
    ]);

    const sheetUrl = settings?.googleSheetsScheduleUrl as string | null | undefined;

    // Google Sheets는 sheetUrl이 필요하므로 settings 완료 후 별도 호출
    // 실패 시 빈 배열 fallback 유지
    const slots = sheetUrl
        ? await fetchSheetScheduleAdmin(sheetUrl).catch(() => [])
        : [];

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
