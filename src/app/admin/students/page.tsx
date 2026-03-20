import { getStudents, getClasses } from "@/lib/queries";
import StudentManagementClient from "./StudentManagementClient";

// 30초 캐시: 아무도 수정 안 할 때 캐시 유지, Server Action 호출 시 즉시 무효화
export const revalidate = 30;

export default async function AdminStudentsPage() {
    const [students, classes] = await Promise.all([
        getStudents(),
        getClasses(),
    ]);
    return <StudentManagementClient students={students} classes={classes} />;
}
