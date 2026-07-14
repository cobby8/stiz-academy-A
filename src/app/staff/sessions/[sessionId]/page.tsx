import { notFound } from "next/navigation";
import SessionInProgressClient from "./SessionInProgressClient";
import { getStaffSessionDetail, getStaffSessionStudents } from "@/lib/staff-session-queries";

export const dynamic = "force-dynamic";

export default async function StaffSessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const { sessionId } = await params;
  const session = await getStaffSessionDetail(sessionId);
  if (!session) notFound();
  const [students, query] = await Promise.all([
    getStaffSessionStudents(sessionId, session.classId),
    searchParams,
  ]);
  return (
    <SessionInProgressClient
      session={session}
      initialStudents={students}
      initialView={query.view === "attendance" ? "attendance" : "main"}
    />
  );
}
