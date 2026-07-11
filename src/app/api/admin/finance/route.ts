import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import { getCachedAdminFinancePayload } from "@/lib/adminReadPayloads";

const FINANCE_CACHE_HEADERS = {
    "Cache-Control": "private, max-age=30, stale-while-revalidate=120",
};

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
        const data = await getCachedAdminFinancePayload(year, month);

        return NextResponse.json(
            data,
            { headers: FINANCE_CACHE_HEADERS },
        );
    } catch (error) {
        console.error("[api/admin/finance] failed:", error);
        return NextResponse.json({ error: "Failed to load payments" }, { status: 500 });
    }
}
