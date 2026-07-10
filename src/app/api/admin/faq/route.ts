import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { requireAdmin } from "@/lib/auth-guard";
import { getAllFaqs } from "@/lib/queries";

export const dynamic = "force-dynamic";

const getCachedFaqs = unstable_cache(
    () => getAllFaqs(),
    ["admin-faq-v1"],
    { revalidate: 60, tags: ["admin-faq"] },
);

export async function GET() {
    try {
        await requireAdmin();
    } catch {
        return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    try {
        const faqs = await getCachedFaqs();

        return NextResponse.json(
            { faqs },
            { headers: { "Cache-Control": "no-store" } },
        );
    } catch (error) {
        console.error("[api/admin/faq] failed:", error);
        return NextResponse.json({ error: "Failed to load FAQs" }, { status: 500 });
    }
}
