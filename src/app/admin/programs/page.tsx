import { getPrograms } from "@/lib/queries";
import ProgramsAdminClient from "./ProgramsAdminClient";

// 30초 캐시: 아무도 수정 안 할 때 캐시 유지, Server Action 호출 시 즉시 무효화
export const revalidate = 30;

export default async function AdminProgramsPage() {
    let programs: any[] = [];
    try {
        programs = await getPrograms();
    } catch (e) {
        console.error("Error fetching programs:", e);
    }
    return <ProgramsAdminClient programs={programs} />;
}
