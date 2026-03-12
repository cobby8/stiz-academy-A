import { getAcademySettings } from "@/lib/queries";
import LandingPageClient from "./LandingPageClient";

export const revalidate = 60;

export default async function Home() {
  let settings: any = null;
  try {
    settings = await getAcademySettings();
  } catch (e) {
    console.error("Failed to load settings for landing page:", e);
  }

  return <LandingPageClient initialSettings={settings} />;
}
