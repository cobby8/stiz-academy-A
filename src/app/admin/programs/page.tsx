import { getPrograms, getAcademySettings } from "@/lib/queries";
import ProgramsAdminClient from "./ProgramsAdminClient";

// 30초 캐시: 아무도 수정 안 할 때 캐시 유지, Server Action 호출 시 즉시 무효화
export const revalidate = 30;

export default async function AdminProgramsPage() {
    let programs: any[] = [];
    let termsOfService: string | null = null;
    try {
        // 두 쿼리를 동시에 실행하여 페이지 로딩 속도 개선
        const [fetchedPrograms, settings] = await Promise.all([
            getPrograms(),
            getAcademySettings(),
        ]);
        programs = fetchedPrograms;
        termsOfService = (settings as any)?.termsOfService ?? null;
    } catch (e) {
        console.error("Error fetching programs page data:", e);
        try { programs = await getPrograms(); } catch {}
    }
    return <ProgramsAdminClient programs={programs} termsOfService={termsOfService} />;
}
