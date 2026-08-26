import { getOperationsRequests } from "@/app/actions/operations-sync";
import { getRallyzAttendanceSyncRuns } from "@/app/actions/rallyz-attendance-sync";
import OperationsSyncClient from "./OperationsSyncClient";

export const dynamic = "force-dynamic";

export default async function OperationsSyncPage() {
  const [requests, attendanceRuns] = await Promise.all([getOperationsRequests(), getRallyzAttendanceSyncRuns()]);
  return <OperationsSyncClient initialRequests={requests} initialAttendanceRuns={attendanceRuns} />;
}
