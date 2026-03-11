import { getAcademySettings } from "@/lib/queries";
import ApplyAdminClient from "./ApplyAdminClient";

export default async function AdminApplyPage() {
    let settings: any = {};
    try {
        settings = (await getAcademySettings()) as any;
    } catch {
        // ignore
    }

    return (
        <ApplyAdminClient
            initialSettings={{
                trialTitle: settings?.trialTitle || "체험수업 안내",
                trialContent: settings?.trialContent || null,
                trialFormUrl: settings?.trialFormUrl || null,
                enrollTitle: settings?.enrollTitle || "수강신청 안내",
                enrollContent: settings?.enrollContent || null,
                enrollFormUrl: settings?.enrollFormUrl || null,
            }}
        />
    );
}
