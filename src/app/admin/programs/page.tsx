import { getPrograms, getAcademySettings } from "@/lib/queries";
import ProgramsAdminClient from "./ProgramsAdminClient";

export default async function AdminProgramsPage() {
    let programs: any[] = [];
    let termsOfService: string | null = null;
    try {
        [programs] = await Promise.all([getPrograms()]);
        const settings = await getAcademySettings() as any;
        termsOfService = settings?.termsOfService ?? null;
    } catch (e) {
        console.error("Error fetching programs page data:", e);
        try { programs = await getPrograms(); } catch {}
    }
    return <ProgramsAdminClient programs={programs} termsOfService={termsOfService} />;
}
