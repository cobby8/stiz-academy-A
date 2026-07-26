import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth-guard";
import { getKoreaDateKey, getTodayStaffClasses, type StaffTodayClass } from "@/lib/staff-session-queries";
import StaffSeasonalClient from "./StaffSeasonalClient";

export const dynamic = "force-dynamic";

export default async function StaffSeasonalPage() {
  const staff = await requireStaff().catch(() => null);
  if (!staff) redirect("/auth/continue?redirect=/staff/seasonal");

  // 버그#2: 홈과 동일하게 반+시간으로 묶은 seasonal 목록을 사용한다.
  // (주n회로 쪼개지지 않고, CANCELLED 반은 이미 제외된 상태로 내려온다)
  const ymd = getKoreaDateKey();
  const classes = await getTodayStaffClasses(ymd);
  const seasonal = classes.filter((c) => c.kind === "SEASONAL");
  const initial = JSON.parse(JSON.stringify({ ymd, classes: seasonal })) as {
    ymd: string;
    classes: StaffTodayClass[];
  };
  return <StaffSeasonalClient initial={initial} />;
}
