import ClassManagementClient from "./ClassManagementClient";
import { getCachedAdminClassesPayload } from "@/lib/adminReadPayloads";

export const revalidate = 30;

export default async function AdminClassesPage() {
    const { programs, classes } = await getCachedAdminClassesPayload();

    return <ClassManagementClient programs={programs} classes={classes} />;
}
