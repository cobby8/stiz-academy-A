import StudentManagementClient from "./StudentManagementClient";
import { getCachedAdminStudentsPayload } from "@/lib/adminReadPayloads";

export const revalidate = 30;

export default async function AdminStudentsPage() {
    const { students, classes, sheetImportSummary, partial } = await getCachedAdminStudentsPayload(50);

    return (
        <StudentManagementClient
            students={students}
            classes={classes}
            sheetImportSummary={sheetImportSummary}
            partial={partial}
        />
    );
}
