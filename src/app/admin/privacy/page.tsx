import { getAcademySettings } from "@/lib/queries";
import { DEFAULT_PRIVACY_POLICY } from "@/lib/defaultPolicies";
import PrivacyAdminClient from "./PrivacyAdminClient";
import { Suspense } from "react";

export const revalidate = 30;

function PolicyEditorLoadingFallback() {
  return (
    <div className="space-y-6">
      <div>
        <div className="h-8 w-56 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
        <div className="mt-2 h-4 w-96 max-w-full rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
      </div>
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="h-5 w-32 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
        <div className="mt-4 h-[520px] rounded-lg bg-gray-100 dark:bg-gray-700 animate-pulse" />
        <div className="mt-4 flex justify-end gap-2">
          <div className="h-10 w-24 rounded-lg bg-gray-100 dark:bg-gray-700 animate-pulse" />
          <div className="h-10 w-24 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
        </div>
      </div>
    </div>
  );
}

async function PrivacyDataSection() {
  let privacyPolicy = DEFAULT_PRIVACY_POLICY;
  try {
    const settings = await getAcademySettings();
    privacyPolicy = (settings as any)?.privacyPolicy?.trim() || DEFAULT_PRIVACY_POLICY;
  } catch (e) {
    console.error("Error fetching privacy policy:", e);
  }

  return <PrivacyAdminClient privacyPolicy={privacyPolicy} />;
}

export default function AdminPrivacyPage() {
  return (
    <Suspense fallback={<PolicyEditorLoadingFallback />}>
      <PrivacyDataSection />
    </Suspense>
  );
}
