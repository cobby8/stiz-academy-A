import { getStudents, getClasses } from "@/lib/queries";
import StudentManagementClient from "./StudentManagementClient";

export const dynamic = "force-dynamic";

export default async function AdminStudentsPage() {
    const [students, classes] = await Promise.all([
        getStudents(),
        getClasses(),
    ]);
    return <StudentManagementClient students={students} classes={classes} />;
}
