import { getPrograms, getClasses, getAcademySettings, getCoaches } from "@/app/actions/admin";
import LandingPageClient from "./LandingPageClient";

export default async function Home() {
  let programs: any[] = [];
  let classes: any[] = [];
  let settings: any = null;
  let coaches: any[] = [];

  try {
    programs = await getPrograms();
    classes = await getClasses();
    settings = await getAcademySettings();
    coaches = await getCoaches();
  } catch (e) {
    console.error("Failed to load data for landing page:", e);
  }

  // Create a default fallback if coaches is empty (like DB not pushed yet)
  const displayCoaches = coaches.length > 0 ? coaches : [
    { id: '1', name: "김스티즈", role: "대표 원장", description: "전직 프로농구 선수 출신/10년 경력 유소년 지도자" },
    { id: '2', name: "이농구", role: "수석 코치", description: "현직 아마추어 리그 MVP/유소년 스포츠 지도사" }
  ];

  const daysInfo = [
    { value: "Mon", label: "월요일" },
    { value: "Tue", label: "화요일" },
    { value: "Wed", label: "수요일" },
    { value: "Thu", label: "목요일" },
    { value: "Fri", label: "금요일" },
    { value: "Sat", label: "토요일" },
    { value: "Sun", label: "일요일" }
  ];

  return <LandingPageClient
    initialSettings={settings}
    programs={programs}
    classes={classes}
    displayCoaches={displayCoaches}
    daysInfo={daysInfo}
  />;
}
function Check(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
