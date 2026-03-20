import { getCoaches } from "@/lib/queries";
import CoachesAdminClient from "./CoachesAdminClient";

// 30초 캐시: 아무도 수정 안 할 때 캐시 유지, Server Action 호출 시 즉시 무효화
export const revalidate = 30;

export default async function AdminCoachesPage() {
    const coaches = await getCoaches();
    return <CoachesAdminClient initialCoaches={coaches as any[]} />;
}
