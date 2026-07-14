import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { createCheckoutSession } from "@/lib/payment-ledger";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    try {
        const user = await requireAuth();
        if (!user.email) {
            return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
        }

        const body = await req.json();
        const invoiceId = String(body?.invoiceId || "");
        if (!invoiceId) {
            return NextResponse.json({ error: "청구서 ID가 필요합니다." }, { status: 400 });
        }

        const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL?.trim();
        const origin = configuredOrigin && /^https?:\/\//i.test(configuredOrigin)
            ? new URL(configuredOrigin).origin
            : new URL(req.url).origin;
        const result = await createCheckoutSession({
            invoiceId,
            parentEmail: user.email,
            origin,
        });

        if (!result.ok) {
            return NextResponse.json(result, { status: result.alreadyPaid ? 409 : 400 });
        }

        return NextResponse.json(result);
    } catch (error) {
        console.error("[payments/checkout] failed:", error);
        return NextResponse.json({ error: "결제 준비 중 오류가 발생했습니다." }, { status: 500 });
    }
}
