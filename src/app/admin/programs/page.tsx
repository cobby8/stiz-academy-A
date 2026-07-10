import ProgramsAdminClient from "./ProgramsAdminClient";
import { getCachedAdminProgramsPayload } from "@/lib/adminReadPayloads";

export const revalidate = 30;

export default async function AdminProgramsPage() {
    const { programs } = await getCachedAdminProgramsPayload();

    return <ProgramsAdminClient programs={programs} />;
}
