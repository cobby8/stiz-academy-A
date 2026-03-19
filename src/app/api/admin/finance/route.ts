import { NextRequest, NextResponse } from "next/server";
import { getPayments } from "@/lib/queries";

export async function GET(request: NextRequest) {
    const { searchParams } = request.nextUrl;
    const year = parseInt(searchParams.get("year") || "");
    const month = parseInt(searchParams.get("month") || "");

    if (!year || !month) {
        return NextResponse.json({ error: "year and month required" }, { status: 400 });
    }

    const data = await getPayments(year, month);
    return NextResponse.json(data);
}
