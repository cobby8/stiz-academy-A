import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { requireAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

const STUDENT_OPTIONS_CACHE_SECONDS = 60;
const STUDENT_OPTIONS_CACHE_HEADERS = {
    "Cache-Control": `private, max-age=${STUDENT_OPTIONS_CACHE_SECONDS}, stale-while-revalidate=300`,
};

type StudentOptionRow = {
    id: string;
    name: string;
    parentName: string | null;
};

const getCachedStudentOptions = unstable_cache(
    async () => {
        const rows = await prisma.$queryRawUnsafe<StudentOptionRow[]>(`
            SELECT s.id, s.name, u.name AS "parentName"
            FROM "Student" s
            LEFT JOIN "User" u ON s."parentId" = u.id
            ORDER BY s.name ASC
        `);

        return rows.map((student) => ({
            id: student.id,
            name: student.name,
            parent: { name: student.parentName },
        }));
    },
    ["admin-student-options-v1"],
    {
        revalidate: STUDENT_OPTIONS_CACHE_SECONDS,
        tags: ["admin-student-options"],
    },
);

export async function GET() {
    try {
        await requireAdmin();
    } catch {
        return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const students = await getCachedStudentOptions();

    return NextResponse.json(
        { students },
        {
            headers: STUDENT_OPTIONS_CACHE_HEADERS,
        },
    );
}
