import { getAcademySettings } from "@/lib/queries";
import ApplyAdminClient from "./ApplyAdminClient";

// 30초 캐시: 아무도 수정 안 할 때 캐시 유지, Server Action 호출 시 즉시 무효화
export const revalidate = 30;

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
                uniformFormUrl: settings?.uniformFormUrl || null,
            }}
        />
    );
}
