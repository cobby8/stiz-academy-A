import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type CoachOptionRow = {
    id: string;
    name: string;
};

export async function GET() {
    try {
        await requireAdmin();
    } catch {
        return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const coaches = await prisma.$queryRawUnsafe<CoachOptionRow[]>(`
        SELECT id, name
        FROM "Coach"
        ORDER BY "order" ASC, name ASC
    `);

    return NextResponse.json(
        { coaches },
        {
            headers: {
                "Cache-Control": "no-store",
            },
        },
    );
}
