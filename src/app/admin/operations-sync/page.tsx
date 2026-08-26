import { getOperationsRequests } from "@/app/actions/operations-sync";
import { getRallyzAttendanceSyncRuns } from "@/app/actions/rallyz-attendance-sync";
import OperationsSyncClient from "./OperationsSyncClient";
import { getStudents } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function OperationsSyncPage() {
  const [requests, attendanceRuns, students] = await Promise.all([getOperationsRequests(), getRallyzAttendanceSyncRuns(), getStudents()]);
  const linkStudents = students.map((student) => ({
    id: student.id,
    name: student.name,
    grade: student.grade,
    parentPhoneLast4: student.parent?.phone?.replace(/\D/g, "").slice(-4) || null,
  }));
  return <OperationsSyncClient initialRequests={requests} initialAttendanceRuns={attendanceRuns} linkStudents={linkStudents} />;
}
