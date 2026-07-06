import { getAcademySettings } from "@/lib/queries";
import { DEFAULT_PRIVACY_POLICY } from "@/lib/defaultPolicies";
import PrivacyAdminClient from "./PrivacyAdminClient";

export const revalidate = 30;

export default async function AdminPrivacyPage() {
  let privacyPolicy = DEFAULT_PRIVACY_POLICY;
  try {
    const settings = await getAcademySettings();
    privacyPolicy = (settings as any)?.privacyPolicy?.trim() || DEFAULT_PRIVACY_POLICY;
  } catch (e) {
    console.error("Error fetching privacy policy:", e);
  }

  return <PrivacyAdminClient privacyPolicy={privacyPolicy} />;
}
