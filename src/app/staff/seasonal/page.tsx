import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth-guard";
import { getKoreaDateKey, getTodayStaffClasses, type StaffTodayClass } from "@/lib/staff-session-queries";
import StaffSeasonalClient from "./StaffSeasonalClient";

export const dynamic = "force-dynamic";

export default async function StaffSeasonalPage() {
  const staff = await requireStaff().catch(() => null);
  // bounced=1 로 목적지를 지운다. 여기로 되돌려보내면 거절 → 판별 → 거절이 무한 반복된다.
  // /staff/continue 로 가야 설치된 선생님 앱이 제 영역을 벗어나지 않는다.
  if (!staff) redirect("/staff/continue?bounced=1");

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
