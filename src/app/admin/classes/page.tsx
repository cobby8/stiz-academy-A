import { getPrograms, getClasses } from "@/lib/queries";
import ClassManagementClient from "./ClassManagementClient";

export const dynamic = "force-dynamic";

export default async function AdminClassesPage() {
    const [programs, classes] = await Promise.all([
        getPrograms(),
        getClasses(),
    ]);
    return <ClassManagementClient programs={programs} classes={classes} />;
}
