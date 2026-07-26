import RegularShuttleClient from "./RegularShuttleClient";
import ShuttleSectionTabs from "../ShuttleSectionTabs";
import SeasonalHeader from "../../seasonal/SeasonalHeader";
import { getRegularShuttleStops } from "@/lib/shuttle/regularImport";
import { getSettings } from "@/lib/seasonal/shuttle-optimize";

export const dynamic = "force-dynamic";

const DEFAULT_SHEET_URL = "https://docs.google.com/spreadsheets/d/12xfQWT6OYa0hH2Ajei7E48CF2aUh6vZ8WWeFeocZrzY/edit?gid=1953491915";

// 정규 셔틀 — 구글 시트에서 앱 DB로 이관한 요일별 운행리스트 + 요일·수업별 배차 지도.
export default async function RegularShuttlePage() {
  const [data, geo] = await Promise.all([getRegularShuttleStops(), getSettings()]);
  const initial = JSON.parse(JSON.stringify(data)) as typeof data;
  const geoPlain = JSON.parse(JSON.stringify(geo)) as typeof geo;

  return (
    <>
      <SeasonalHeader />
      <ShuttleSectionTabs />
      <RegularShuttleClient initialStops={initial.stops} importedAt={initial.importedAt} defaultSheetUrl={DEFAULT_SHEET_URL} geo={geoPlain} />
    </>
  );
}
