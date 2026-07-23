import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { isSmsProviderConfigured } from "@/lib/sms";

export const dynamic = "force-dynamic";

type AutomationRow = {
    id: string;
    name: string;
    description: string | null;
    audienceScope: string;
    isActive: boolean;
    requestedChannel: string;
    fallbackEnabled: boolean;
    fallbackChannel: string | null;
};

function unitCost(channel: string) {
    if (channel === "KAKAO_ALIMTALK" || channel === "ALIMTALK" || channel === "RCS") return 13;
    if (channel === "LMS") return 45;
    return 18;
}

function channelConfigured(channel: string) {
    if (channel === "KAKAO_ALIMTALK" || channel === "ALIMTALK") {
        // 승인 템플릿의 변수 계약 연결은 다음 단계이므로 현재 자동 발송 준비 완료로 표시하지 않는다.
        return false;
    }
    if (channel === "RCS") {
        return false;
    }
    return isSmsProviderConfigured();
}

export async function GET() {
    try {
        await requireAdmin();
    } catch {
        return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    try {
        const rows = await prisma.$queryRawUnsafe<AutomationRow[]>(
            `SELECT id, name, description, "audienceScope", "isActive",
                    "requestedChannel", "fallbackEnabled", "fallbackChannel"
             FROM "MessageAutomationRule"
             ORDER BY
               CASE "audienceScope" WHEN 'INTERNAL' THEN 1 WHEN 'EXTERNAL' THEN 2 ELSE 3 END,
               name`,
        );
        const rules = rows.map((row) => {
            const requested = row.requestedChannel === "KAKAO_ALIMTALK"
                ? "ALIMTALK"
                : row.requestedChannel === "AUTO" ? "SMS" : row.requestedChannel;
            const primaryChannel = ["ALIMTALK", "SMS", "LMS", "RCS"].includes(requested)
                ? requested
                : "SMS";
            const locked = row.audienceScope === "SECURITY";
            return {
                id: row.id,
                name: row.name,
                description: row.description || "",
                audience: row.audienceScope,
                isActive: locked ? true : row.isActive,
                locked,
                primaryChannel,
                fallbackChannel: row.fallbackEnabled && row.fallbackChannel
                    ? row.fallbackChannel
                    : "NONE",
                configured: channelConfigured(primaryChannel),
                estimatedUnitCost: unitCost(primaryChannel),
            };
        });
        return NextResponse.json({ rules }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
        console.error("[api/admin/sms/automations] failed:", error);
        return NextResponse.json({ error: "Failed to load message automations" }, { status: 500 });
    }
}
