import { getPrograms, getClasses } from "@/lib/queries";
import ClassManagementClient from "./ClassManagementClient";

// 30초 캐시: 아무도 수정 안 할 때 캐시 유지, Server Action 호출 시 즉시 무효화
export const revalidate = 30;

export default async function AdminClassesPage() {
    const [programs, classes] = await Promise.all([
        getPrograms(),
        getClasses(),
    ]);
    return <ClassManagementClient programs={programs} classes={classes} />;
}
