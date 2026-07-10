import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import { getClasses, getStudents } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        await requireAdmin();
    } catch {
        return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    try {
        const [students, classes] = await Promise.all([
            getStudents(),
            getClasses(),
        ]);

        return NextResponse.json(
            { students, classes },
            {
                headers: {
                    "Cache-Control": "no-store",
                },
            },
        );
    } catch (error) {
        console.error("[api/admin/students] failed:", error);
        return NextResponse.json({ error: "Failed to load students" }, { status: 500 });
    }
}
