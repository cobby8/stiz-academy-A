import StudentManagementClient from "./StudentManagementClient";

// The full student list is intentionally loaded in the browser after entry.
export const revalidate = 30;

export default function AdminStudentsPage() {
    return <StudentManagementClient />;
}
