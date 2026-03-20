import { getAnnualEvents } from "@/lib/queries";
import AnnualAdminClient from "./AnnualAdminClient";

// 30초 캐시: 아무도 수정 안 할 때 캐시 유지, Server Action 호출 시 즉시 무효화
export const revalidate = 30;

export default async function AnnualAdminPage() {
    const events = await getAnnualEvents();
    return <AnnualAdminClient events={events} />;
}
