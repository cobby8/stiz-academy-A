import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function maskPhoneLast4(value: string | null) {
    // 이력 API는 원문 전화번호를 읽지 않고, 장부에 따로 보관한 끝 4자리만 표시합니다.
    if (!value || !/^\d{4}$/.test(value)) return "보호됨";
    return `***-****-${value}`;
}

function normalizeChannel(value: string | null) {
    if (!value) return null;
    return value === "KAKAO_ALIMTALK" ? "ALIMTALK" : value;
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
            requestedChannel: string | null;
            messageType: string | null;
            status: string;
            provider: string | null;
            providerStatus: string | null;
            fallbackUsed: boolean;
            fallbackChannel: string | null;
            unitCost: string | number | null;
            currency: string;
            errorCode: string | null;
            source: string | null;
            batchId: string | null;
            recipientPhoneLast4: string | null;
            batchStatus: string | null;
            batchTotalCount: number | null;
            batchSuccessCount: number | null;
            batchFailureCount: number | null;
        }>>(
            `SELECT d.id, d."sentAt", d."createdAt", d.trigger, d."eventType", d."audienceScope",
                    d.channel, d."requestedChannel", d."messageType", d.status,
                    d.provider, d."providerStatus", d."fallbackUsed", d."fallbackChannel",
                    d."unitCost", d.currency, d."errorCode",
                    COALESCE(d.source, b.source) AS source,
                    d."batchId", d."recipientPhoneLast4",
                    b.status AS "batchStatus", b."totalCount" AS "batchTotalCount",
                    b."successCount" AS "batchSuccessCount", b."failureCount" AS "batchFailureCount"
               FROM "NotificationDelivery" d
               LEFT JOIN "MessageDeliveryBatch" b ON b.id = d."batchId"
              WHERE d.channel IN ('SMS', 'LMS', 'ALIMTALK', 'KAKAO_ALIMTALK', 'RCS')
                 OR d."requestedChannel" IN ('SMS', 'LMS', 'ALIMTALK', 'KAKAO_ALIMTALK', 'RCS')
                 OR d."messageType" IN ('SMS', 'LMS', 'ALIMTALK', 'KAKAO_ALIMTALK', 'RCS')
              ORDER BY d."createdAt" DESC
              LIMIT $1`,
            limit,
        );
        const now = Date.now();
        const deliveries = rows.map((row) => {
            const createdAt = new Date(row.createdAt);
            const isStaleSending = row.status === "SENDING"
                && now - createdAt.getTime() >= 10 * 60 * 1000;
            const isUncertain = isStaleSending
                || row.status === "UNCERTAIN"
                || row.errorCode === "FAILED_DELIVERY_UNCERTAIN"
                || (row.status === "SENDING" && row.providerStatus === "ACCEPTED");
            const actualChannel = normalizeChannel(row.messageType || row.channel) || "SMS";
            const requestedChannel = normalizeChannel(row.requestedChannel) || actualChannel;

            return {
                id: row.id,
                batchId: row.batchId,
                sentAt: (row.sentAt || createdAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }),
                name: row.trigger || row.eventType,
                source: row.source || "AUTO",
                audience: row.audienceScope === "INTERNAL" || row.audienceScope === "SECURITY"
                    ? row.audienceScope
                    : "EXTERNAL",
                requestedChannel,
                channel: actualChannel,
                provider: row.provider,
                providerStatus: row.providerStatus,
                status: isUncertain ? "UNCERTAIN" : row.status,
                isUncertain,
                isStaleSending,
                fallbackUsed: row.fallbackUsed,
                fallbackChannel: normalizeChannel(row.fallbackChannel),
                unitCost: row.unitCost === null ? null : Number(row.unitCost),
                currency: row.currency,
                errorCode: row.errorCode,
                recipient: maskPhoneLast4(row.recipientPhoneLast4),
                batch: row.batchId ? {
                    status: row.batchStatus,
                    totalCount: row.batchTotalCount ?? 0,
                    successCount: row.batchSuccessCount ?? 0,
                    failureCount: row.batchFailureCount ?? 0,
                } : null,
            };
        });
        return NextResponse.json({ deliveries }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
        console.error("[api/admin/sms/history] failed:", error);
        return NextResponse.json({ error: "Failed to load message history" }, { status: 500 });
    }
}
