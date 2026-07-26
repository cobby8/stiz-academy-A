import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth-guard";
import { getSeasonalDatesForStaff } from "@/lib/seasonal/attendance";
import StaffSeasonalClient from "./StaffSeasonalClient";

export const dynamic = "force-dynamic";

export default async function StaffSeasonalPage() {
  const staff = await requireStaff().catch(() => null);
  if (!staff) redirect("/auth/continue?redirect=/staff/seasonal");
  const today = await getSeasonalDatesForStaff(staff.appUserId, staff.appUserRole);
  const initial = JSON.parse(JSON.stringify(today)) as {
    ymd: string;
    dates: Array<{ sessionDateId: string; offeringTitle: string; dateLabel: string; dayLabel: string; startTime: string; endTime: string; capacity: number | null; instructorName: string | null; scheduled: number; unchecked: number; linkedClassId: string | null; sessionId: string | null; sessionStatus: "PLANNED" | "IN_PROGRESS" | "COMPLETED" | null }>;
  };
  return <StaffSeasonalClient initial={initial} />;
}
