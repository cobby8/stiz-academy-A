import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const INDEX_STATEMENTS = [
    `CREATE INDEX IF NOT EXISTS "Student_parentId_idx" ON "Student" ("parentId")`,
    `CREATE INDEX IF NOT EXISTS "Student_name_parentId_idx" ON "Student" (name, "parentId")`,
    `CREATE INDEX IF NOT EXISTS "Class_programId_idx" ON "Class" ("programId")`,
    `CREATE INDEX IF NOT EXISTS "Class_instructorId_idx" ON "Class" ("instructorId")`,
    `CREATE INDEX IF NOT EXISTS "Enrollment_classId_status_idx" ON "Enrollment" ("classId", status)`,
    `CREATE INDEX IF NOT EXISTS "Session_classId_date_idx" ON "Session" ("classId", date)`,
    `CREATE INDEX IF NOT EXISTS "Session_published_date_idx" ON "Session" (published, date)`,
    `CREATE INDEX IF NOT EXISTS "Attendance_studentId_idx" ON "Attendance" ("studentId")`,
    `CREATE INDEX IF NOT EXISTS "Payment_studentId_year_month_idx" ON "Payment" ("studentId", year, month)`,
    `CREATE INDEX IF NOT EXISTS "Payment_studentId_dueDate_idx" ON "Payment" ("studentId", "dueDate")`,
] as const;

export async function POST() {
    try {
        await requireAdmin();
    } catch {
        return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    try {
        for (const statement of INDEX_STATEMENTS) {
            await prisma.$executeRawUnsafe(statement);
        }

        return NextResponse.json(
            { success: true, indexes: INDEX_STATEMENTS.length },
            { headers: { "Cache-Control": "no-store" } },
        );
    } catch (error) {
        console.error("[api/admin/performance-indexes] failed:", error);
        return NextResponse.json(
            { error: "Failed to ensure performance indexes" },
            { status: 500 },
        );
    }
}
