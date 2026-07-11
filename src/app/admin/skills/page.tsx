import SkillsClient from "./SkillsClient";
import { getCachedAdminSkillsPayload } from "@/lib/adminReadPayloads";

// Keep the admin page cache policy while letting the shell render first.
export const revalidate = 30;

export default async function AdminSkillsPage() {
    const { categories } = await getCachedAdminSkillsPayload();

    return <SkillsClient categories={categories} />;
}
