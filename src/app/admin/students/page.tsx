import StudentManagementClient from "./StudentManagementClient";
import { getCachedAdminStudentsPayload } from "@/lib/adminReadPayloads";

export const revalidate = 30;

export default async function AdminStudentsPage() {
    const { students, classes } = await getCachedAdminStudentsPayload();

    return <StudentManagementClient students={students} classes={classes} />;
}
