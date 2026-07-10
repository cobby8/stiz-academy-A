import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { requireAdmin } from "@/lib/auth-guard";
import { getBillingTemplates, getPrograms } from "@/lib/queries";

export const dynamic = "force-dynamic";

const getCachedBillingPayload = unstable_cache(
    async () => {
        const [templates, programs] = await Promise.all([
            getBillingTemplates(),
            getPrograms(),
        ]);

        return { templates, programs };
    },
    ["admin-finance-billing-v1"],
    { revalidate: 60, tags: ["admin-finance-billing", "admin-programs"] },
);

export async function GET() {
    try {
        await requireAdmin();
    } catch {
        return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    try {
        const payload = await getCachedBillingPayload();

        return NextResponse.json(
            payload,
            { headers: { "Cache-Control": "no-store" } },
        );
    } catch (error) {
        console.error("[api/admin/finance/billing] failed:", error);
        return NextResponse.json({ error: "Failed to load billing templates" }, { status: 500 });
    }
}
