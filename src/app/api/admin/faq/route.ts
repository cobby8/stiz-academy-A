import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import { getAllFaqs } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        await requireAdmin();
    } catch {
        return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    try {
        const faqs = await getAllFaqs();

        return NextResponse.json(
            { faqs },
            { headers: { "Cache-Control": "no-store" } },
        );
    } catch (error) {
        console.error("[api/admin/faq] failed:", error);
        return NextResponse.json({ error: "Failed to load FAQs" }, { status: 500 });
    }
}
