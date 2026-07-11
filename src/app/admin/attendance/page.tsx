import AttendanceClient from "./AttendanceClient";
import { getCachedAdminAttendancePayload } from "@/lib/adminReadPayloads";

export const revalidate = 30;

export default async function AdminAttendancePage() {
    const { classes } = await getCachedAdminAttendancePayload();

    return <AttendanceClient classes={classes} />;
}
