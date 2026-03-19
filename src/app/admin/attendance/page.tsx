import { getClasses } from "@/lib/queries";
import AttendanceClient from "./AttendanceClient";

export const dynamic = "force-dynamic";

export default async function AdminAttendancePage() {
    const classes = await getClasses();
    return <AttendanceClient classes={classes} />;
}
