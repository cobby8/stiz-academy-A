import PrivacyAdminClient from "./PrivacyAdminClient";
import { getCachedAdminSettingsPayload } from "@/lib/adminReadPayloads";

export const revalidate = 30;

export default async function AdminPrivacyPage() {
  const { settings } = await getCachedAdminSettingsPayload();

  return <PrivacyAdminClient privacyPolicy={settings?.privacyPolicy ?? undefined} />;
}
