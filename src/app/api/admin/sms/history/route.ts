import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function maskPhone(value: string | null) {
    if (!value) return "보호됨";
    const digits = value.replace(/\D/g, "");
    if (digits.length < 8) return "보호됨";
    return `${digits.slice(0, 3)}-****-${digits.slice(-4)}`;
}

export async function GET(request: NextRequest) {
    try {
        await requireAdmin();
    } catch {
        return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const requestedLimit = Number(request.nextUrl.searchParams.get("limit") || 50);
    const limit = Math.max(1, Math.min(Number.isFinite(requestedLimit) ? requestedLimit : 50, 100));
    try {
        const rows = await prisma.$queryRawUnsafe<Array<{
            id: string;
            sentAt: Date | null;
            createdAt: Date;
            trigger: string | null;
            eventType: string;
            audienceScope: string | null;
            channel: string;
            messageType: string | null;
            status: string;
            recipientPhone: string | null;
        }>>(
            `SELECT id, "sentAt", "createdAt", trigger, "eventType", "audienceScope",
                    channel, "messageType", status, "recipientPhone"
               FROM "NotificationDelivery"
              WHERE channel IN ('SMS', 'LMS', 'ALIMTALK', 'KAKAO_ALIMTALK', 'RCS')
                 OR "messageType" IN ('SMS', 'LMS', 'ALIMTALK', 'KAKAO_ALIMTALK', 'RCS')
              ORDER BY "createdAt" DESC
              LIMIT $1`,
            limit,
        );
        const deliveries = rows.map((row) => ({
            id: row.id,
            sentAt: (row.sentAt || row.createdAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }),
            name: row.trigger || row.eventType,
            audience: row.audienceScope === "INTERNAL" || row.audienceScope === "SECURITY"
                ? row.audienceScope
                : "EXTERNAL",
            channel: row.messageType === "KAKAO_ALIMTALK" ? "ALIMTALK"
                : row.messageType || (row.channel === "KAKAO_ALIMTALK" ? "ALIMTALK" : row.channel),
            status: row.status === "SENT" || row.status === "FAILED" || row.status === "PENDING"
                ? row.status
                : "SKIPPED",
            recipient: maskPhone(row.recipientPhone),
        }));
        return NextResponse.json({ deliveries }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
        console.error("[api/admin/sms/history] failed:", error);
        return NextResponse.json({ error: "Failed to load message history" }, { status: 500 });
    }
}
