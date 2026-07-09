import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type StudentOptionRow = {
    id: string;
    name: string;
    parentName: string | null;
};

export async function GET() {
    try {
        await requireAdmin();
    } catch {
        return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const rows = await prisma.$queryRawUnsafe<StudentOptionRow[]>(`
        SELECT s.id, s.name, u.name AS "parentName"
        FROM "Student" s
        LEFT JOIN "User" u ON s."parentId" = u.id
        ORDER BY s.name ASC
    `);

    const students = rows.map((student) => ({
        id: student.id,
        name: student.name,
        parent: { name: student.parentName },
    }));

    return NextResponse.json(
        { students },
        {
            headers: {
                "Cache-Control": "no-store",
            },
        },
    );
}
