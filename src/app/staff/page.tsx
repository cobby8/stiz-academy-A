import StaffHomeClient from "./StaffHomeClient";
import { getKoreaDateKey, getTodayStaffClasses } from "@/lib/staff-session-queries";

export const dynamic = "force-dynamic";

export default async function StaffHomePage() {
  const classes = await getTodayStaffClasses();
  return <StaffHomeClient dateKey={getKoreaDateKey()} classes={classes} />;
}
