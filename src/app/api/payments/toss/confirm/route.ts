import { NextRequest, NextResponse } from "next/server";
import { confirmTossPayment } from "@/lib/payment-ledger";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const paymentKey = String(body?.paymentKey || "");
        const orderId = String(body?.orderId || "");
        const amount = Number(body?.amount || 0);

        if (!paymentKey || !orderId || !amount) {
            return NextResponse.json({ error: "결제 승인 정보가 부족합니다." }, { status: 400 });
        }

        const result = await confirmTossPayment({ paymentKey, orderId, amount });
        if (!result.ok) {
            return NextResponse.json(result, { status: 400 });
        }

        return NextResponse.json(result);
    } catch (error) {
        console.error("[payments/toss/confirm] failed:", error);
        return NextResponse.json({ error: "결제 승인 중 오류가 발생했습니다." }, { status: 500 });
    }
}
