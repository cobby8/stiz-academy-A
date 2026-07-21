import StaffHomeClient from "./StaffHomeClient";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth-guard";
import { getKoreaDateKey, getTodayStaffClasses } from "@/lib/staff-session-queries";

export const dynamic = "force-dynamic";

export default async function StaffHomePage() {
  const staff = await requireStaff();
  if (staff.appUserRole === "DRIVER") redirect("/staff/shuttle");

  const classes = await getTodayStaffClasses();
  return <StaffHomeClient dateKey={getKoreaDateKey()} classes={classes} />;
}
