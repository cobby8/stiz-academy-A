import { getAcademySettings, getClassSlotOverrides, getCoaches, getCustomClassSlots, getPrograms } from "@/lib/queries";
import { fetchSheetScheduleAdmin } from "@/lib/googleSheetsSchedule";
import ScheduleAdminClient from "./ScheduleAdminClient";

export const revalidate = 30;

export default async function AdminSchedulePage() {
    // 1단계: settings만 먼저 가져옴 (Google Sheets URL이 필요하므로)
    const settings = await (getAcademySettings() as Promise<any>);
    const sheetUrl = settings?.googleSheetsScheduleUrl as string | null | undefined;

    // 2단계: 나머지 DB 쿼리 4개 + Google Sheets를 모두 병렬로 동시 실행
    // Google Sheets는 외부 네트워크 호출(500ms~2초)이므로 DB 쿼리와 동시에 실행하면 대기 시간 절감
    const [overrides, coaches, customSlots, programs, slots] = await Promise.all([
        getClassSlotOverrides(),
        getCoaches(),
        getCustomClassSlots(),
        getPrograms(),
        sheetUrl
            ? fetchSheetScheduleAdmin(sheetUrl).catch(() => [])
            : Promise.resolve([]),
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
