import { NextRequest, NextResponse } from "next/server";
import { recordTossWebhook } from "@/lib/payment-ledger";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    try {
        const payload = await req.json();
        const result = await recordTossWebhook(payload);
        return NextResponse.json(result);
    } catch (error) {
        console.error("[payments/toss/webhook] failed:", error);
        return NextResponse.json({ error: "웹훅 처리 중 오류가 발생했습니다." }, { status: 500 });
    }
}
