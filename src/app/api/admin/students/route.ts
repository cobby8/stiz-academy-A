import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { requireAdmin } from "@/lib/auth-guard";
import { getClasses, getStudents } from "@/lib/queries";

export const dynamic = "force-dynamic";

const getCachedStudentsPayload = unstable_cache(
    async () => {
        const [students, classes] = await Promise.all([
            getStudents(),
            getClasses(),
        ]);

        return { students, classes };
    },
    ["admin-students-v1"],
    { revalidate: 60, tags: ["admin-students", "admin-classes"] },
);

export async function GET() {
    try {
        await requireAdmin();
    } catch {
        return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    try {
        const payload = await getCachedStudentsPayload();

        return NextResponse.json(
            payload,
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
