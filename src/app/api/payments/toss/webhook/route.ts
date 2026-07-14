import { NextRequest, NextResponse } from "next/server";
import { recordTossWebhook } from "@/lib/payment-ledger";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    try {
        const contentLength = Number(req.headers.get("content-length") || 0);
        if (contentLength > 64 * 1024) {
            return NextResponse.json({ error: "웹훅 본문이 너무 큽니다." }, { status: 413 });
        }
        const rawBody = await req.text();
        if (Buffer.byteLength(rawBody, "utf8") > 64 * 1024) {
            return NextResponse.json({ error: "웹훅 본문이 너무 큽니다." }, { status: 413 });
        }
        let payload: unknown;
        try {
            payload = JSON.parse(rawBody);
        } catch {
            return NextResponse.json({ error: "올바른 JSON 웹훅이 아닙니다." }, { status: 400 });
        }
        const result = await recordTossWebhook(payload);
        return NextResponse.json(result, { status: result.retryable ? 503 : 200 });
    } catch (error) {
        console.error("[payments/toss/webhook] failed:", error);
        return NextResponse.json({ error: "웹훅 처리 중 오류가 발생했습니다." }, { status: 500 });
    }
}
