import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { requireAdmin } from "@/lib/auth-guard";
import { getPayments, getPaymentSummary } from "@/lib/queries";

const FINANCE_CACHE_HEADERS = {
    "Cache-Control": "private, max-age=30, stale-while-revalidate=120",
};

function getCachedFinanceData(year: number, month: number) {
    return unstable_cache(
        async () => {
            const [payments, summary] = await Promise.all([
                getPayments(year, month),
                getPaymentSummary(year, month),
            ]);

            return { payments, summary };
        },
        ["admin-finance", String(year), String(month)],
        { revalidate: 30, tags: ["admin-finance", "admin-stats"] },
    )();
}

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
        const data = await getCachedFinanceData(year, month);

        return NextResponse.json(
            data,
            { headers: FINANCE_CACHE_HEADERS },
        );
    } catch (error) {
        console.error("[api/admin/finance] failed:", error);
        return NextResponse.json({ error: "Failed to load payments" }, { status: 500 });
    }
}
