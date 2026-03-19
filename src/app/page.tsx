import { getAcademySettings } from "@/lib/queries";
import LandingPageClient from "./LandingPageClient";

export const revalidate = 60;

export const metadata = {
    title: "STIZ 농구교실 다산점 | 다산신도시 No.1 농구 전문 학원",
    description: "다산신도시 스티즈 농구교실입니다. 유아·초등·중등 수준별 맞춤 클래스, 전문 코치진, 셔틀 운행. 체험 수업 신청 및 수강 문의.",
};

export default async function Home() {
  let settings: any = null;
  try {
    settings = await getAcademySettings();
  } catch (e) {
    console.error("Failed to load settings for landing page:", e);
  }

  return <LandingPageClient initialSettings={settings} />;
}
