import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createAdminTiming, requireTimedAdmin, timedJson } from "@/lib/adminTiming";

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
    const timing = createAdminTiming("admin-student-options");

    try {
        await requireTimedAdmin(timing);
    } catch {
        return timedJson(timing, { error: "Authentication required" }, { status: 401 });
    }

    const students = await timing.measure("data", () => getCachedStudentOptions());

    return timedJson(
        timing,
        { students },
        {
            headers: STUDENT_OPTIONS_CACHE_HEADERS,
        },
    );
}
