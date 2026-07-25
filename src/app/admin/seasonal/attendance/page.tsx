import SeasonalAttendanceClient from "./SeasonalAttendanceClient";
import SeasonalSectionTabs from "../SeasonalSectionTabs";
import { getSeasonalAttendanceBootstrap } from "@/lib/seasonal/attendance";

export const dynamic = "force-dynamic";

export default async function SeasonalAttendancePage() {
  const bootstrap = await getSeasonalAttendanceBootstrap();
  const initial = JSON.parse(JSON.stringify(bootstrap)) as {
    seasons: Array<{ id: string; title: string; status: string }>;
    offerings: Array<{
      id: string; seasonId: string; title: string; capacity: number | null;
      targetGrades: string | null; instructorName: string | null; dateCount: number; enrolledSlots: number;
    }>;
  };
  return (
    <>
      <SeasonalSectionTabs />
      <SeasonalAttendanceClient initial={initial} />
    </>
  );
}
