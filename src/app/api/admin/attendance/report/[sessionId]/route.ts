import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import { getCoaches, getSessionReport } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ sessionId: string }> },
) {
    try {
        await requireAdmin();
    } catch {
        return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { sessionId } = await params;

    try {
        const [report, coaches] = await Promise.all([
            getSessionReport(sessionId),
            getCoaches(),
        ]);

        if (!report) {
            return NextResponse.json({ error: "Report not found" }, { status: 404 });
        }

        return NextResponse.json(
            { report, coaches },
            { headers: { "Cache-Control": "no-store" } },
        );
    } catch (error) {
        console.error("[api/admin/attendance/report/[sessionId]] failed:", error);
        return NextResponse.json({ error: "Failed to load report" }, { status: 500 });
    }
}
