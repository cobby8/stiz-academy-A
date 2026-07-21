import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth-guard";
import { getStaffShuttleDashboard } from "@/lib/shuttle/service";
import StaffShuttleDashboardClient from "./StaffShuttleDashboardClient";

export const dynamic = "force-dynamic";

export default async function StaffShuttlePage() {
  const staff = await requireStaff();
  const canUseShuttle =
    staff.appUserRole === "DRIVER" ||
    staff.appUserRole === "ADMIN" ||
    staff.appUserRole === "VICE_ADMIN";

  if (!canUseShuttle) redirect("/staff");

  const dashboard = await getStaffShuttleDashboard(staff);
  const canManageShuttle = staff.appUserRole === "ADMIN" || staff.appUserRole === "VICE_ADMIN";

  return <StaffShuttleDashboardClient dashboard={dashboard} canManageShuttle={canManageShuttle} />;
}
