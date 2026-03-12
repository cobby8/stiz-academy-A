import { getCoaches } from "@/lib/queries";
import CoachesAdminClient from "./CoachesAdminClient";

export default async function AdminCoachesPage() {
    const coaches = await getCoaches();
    return <CoachesAdminClient initialCoaches={coaches as any[]} />;
}
