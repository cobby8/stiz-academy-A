import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import { getAcademySettings } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        await requireAdmin();
    } catch {
        return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    try {
        const settings = await getAcademySettings().catch(() => ({} as any));

        return NextResponse.json(
            {
                settings: {
                    trialTitle: settings?.trialTitle || "체험수업 안내",
                    trialContent: settings?.trialContent || null,
                    trialFormUrl: settings?.trialFormUrl || null,
                    enrollTitle: settings?.enrollTitle || "수강신청 안내",
                    enrollContent: settings?.enrollContent || null,
                    enrollFormUrl: settings?.enrollFormUrl || null,
                    uniformFormUrl: settings?.uniformFormUrl || null,
                    useBuiltInTrialForm: settings?.useBuiltInTrialForm ?? false,
                    useBuiltInEnrollForm: settings?.useBuiltInEnrollForm ?? false,
                },
            },
            {
                headers: {
                    "Cache-Control": "no-store",
                },
            },
        );
    } catch (error) {
        console.error("[api/admin/apply/settings] failed:", error);
        return NextResponse.json({ error: "Failed to load apply settings" }, { status: 500 });
    }
}
