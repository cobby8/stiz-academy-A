import { getAnnualEvents, getAcademySettings } from "@/lib/queries";
import AnnualAdminClient from "./AnnualAdminClient";

// 30초 캐시: 아무도 수정 안 할 때 캐시 유지, Server Action 호출 시 즉시 무효화
export const revalidate = 30;

export default async function AnnualAdminPage() {
    // 이벤트 목록과 설정(ICS URL)을 병렬로 가져옴
    const [events, settings] = await Promise.all([
        getAnnualEvents(),
        getAcademySettings(),
    ]);
    return (
        <AnnualAdminClient
            events={events}
            initialIcsUrl={settings?.googleCalendarIcsUrl || ""}
        />
    );
}
