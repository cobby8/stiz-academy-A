import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { requireAdmin } from "@/lib/auth-guard";
import { getTrialLeads, getTrialStats } from "@/lib/queries";

export const dynamic = "force-dynamic";

const getCachedTrialPayload = unstable_cache(
    async () => {
        const [leads, stats] = await Promise.all([
            getTrialLeads(),
            getTrialStats(),
        ]);

        return { leads, stats };
    },
    ["admin-trial-v1"],
    { revalidate: 30, tags: ["admin-trial"] },
);

export async function GET() {
    try {
        await requireAdmin();
    } catch {
        return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    try {
        const payload = await getCachedTrialPayload();

        return NextResponse.json(
            payload,
            {
                headers: {
                    "Cache-Control": "no-store",
                },
            },
        );
    } catch (error) {
        console.error("[api/admin/trial] failed:", error);
        return NextResponse.json({ error: "Failed to load trial leads" }, { status: 500 });
    }
}
