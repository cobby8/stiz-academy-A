import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import { getPayments, getPaymentSummary } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    try {
        await requireAdmin();
    } catch {
        return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const year = parseInt(searchParams.get("year") || "");
    const month = parseInt(searchParams.get("month") || "");

    if (!year || !month) {
        return NextResponse.json({ error: "year and month required" }, { status: 400 });
    }

    try {
        const [payments, summary] = await Promise.all([
            getPayments(year, month),
            getPaymentSummary(year, month),
        ]);

        return NextResponse.json(
            { payments, summary },
            {
                headers: {
                    "Cache-Control": "no-store",
                },
            },
        );
    } catch (error) {
        console.error("[api/admin/finance] failed:", error);
        return NextResponse.json({ error: "Failed to load payments" }, { status: 500 });
    }
}
