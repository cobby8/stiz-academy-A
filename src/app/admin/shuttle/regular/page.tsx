import RegularShuttleClient from "./RegularShuttleClient";
import ShuttleSectionTabs from "../ShuttleSectionTabs";
import SeasonalHeader from "../../seasonal/SeasonalHeader";
import { getRegularShuttleStops } from "@/lib/shuttle/regularImport";

export const dynamic = "force-dynamic";

const DEFAULT_SHEET_URL = "https://docs.google.com/spreadsheets/d/12xfQWT6OYa0hH2Ajei7E48CF2aUh6vZ8WWeFeocZrzY/edit?gid=1953491915";

// 정규 셔틀 — 구글 시트에서 앱 DB로 이관한 요일별 운행리스트.
export default async function RegularShuttlePage() {
  const data = await getRegularShuttleStops();
  const initial = JSON.parse(JSON.stringify(data)) as typeof data;

  return (
    <>
      <SeasonalHeader />
      <ShuttleSectionTabs />
      <RegularShuttleClient initialStops={initial.stops} importedAt={initial.importedAt} defaultSheetUrl={DEFAULT_SHEET_URL} />
    </>
  );
}
