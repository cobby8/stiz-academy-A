import { getPrograms } from "@/lib/queries";
import ProgramsAdminClient from "./ProgramsAdminClient";

export default async function AdminProgramsPage() {
    let programs: any[] = [];
    try {
        programs = await getPrograms();
    } catch (e) {
        console.error("Error fetching programs:", e);
    }
    return <ProgramsAdminClient programs={programs} />;
}
