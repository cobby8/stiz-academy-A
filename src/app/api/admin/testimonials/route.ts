import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import { getAcademySettings, getAllTestimonials } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        await requireAdmin();
    } catch {
        return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    try {
        const [testimonials, settings] = await Promise.all([
            getAllTestimonials(),
            getAcademySettings(),
        ]);

        return NextResponse.json(
            {
                testimonials,
                naverPlaceUrl: settings?.naverPlaceUrl || "",
            },
            { headers: { "Cache-Control": "no-store" } },
        );
    } catch (error) {
        console.error("[api/admin/testimonials] failed:", error);
        return NextResponse.json({ error: "Failed to load testimonials" }, { status: 500 });
    }
}
