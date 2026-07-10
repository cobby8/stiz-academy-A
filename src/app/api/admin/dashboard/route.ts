import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import {
    getDashboardExtendedStats,
    getDashboardStats,
    getEnrollApplicationStats,
    getPendingRequestCount,
    getRecentPendingRequests,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

async function getTodayClasses() {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const today = days[new Date().getDay()];

    try {
        const rows = await prisma.$queryRawUnsafe<any[]>(
            `SELECT c.id, c.name, c."startTime", c."endTime", c.capacity,
                    p.name AS program_name,
                    (SELECT COUNT(*)::int FROM "Enrollment" e WHERE e."classId" = c.id AND e.status = 'ACTIVE') AS enrolled
             FROM "Class" c
             LEFT JOIN "Program" p ON c."programId" = p.id
             WHERE c."dayOfWeek" = $1
             ORDER BY c."startTime" ASC`,
            today,
        );

        return rows.map((row: any) => ({
            id: row.id,
            name: row.name,
            startTime: row.startTime ?? row.starttime,
            endTime: row.endTime ?? row.endtime,
            capacity: Number(row.capacity ?? 0),
            programName: row.program_name,
            enrolled: Number(row.enrolled ?? 0),
        }));
    } catch {
        return [];
    }
}

async function getRecentStudents() {
    try {
        const rows = await prisma.$queryRawUnsafe<any[]>(
            `SELECT s.id, s.name, s."createdAt", u.name AS parent_name
             FROM "Student" s
             LEFT JOIN "User" u ON s."parentId" = u.id
             WHERE s."createdAt" >= NOW() - INTERVAL '7 days'
             ORDER BY s."createdAt" DESC
             LIMIT 5`,
        );

        return rows.map((row: any) => ({
            id: row.id,
            name: row.name,
            createdAt: row.createdAt ?? row.createdat,
            parentName: row.parent_name,
        }));
    } catch {
        return [];
    }
}

export async function GET() {
    try {
        await requireAdmin();
    } catch {
        return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    try {
        const [
            stats,
            pendingRequests,
            pendingCount,
            enrollStats,
            extendedStats,
            todayClasses,
            recentStudents,
        ] = await Promise.all([
            getDashboardStats(),
            getRecentPendingRequests(),
            getPendingRequestCount(),
            getEnrollApplicationStats(),
            getDashboardExtendedStats(),
            getTodayClasses(),
            getRecentStudents(),
        ]);

        return NextResponse.json(
            {
                stats,
                pendingRequests,
                pendingCount,
                enrollStats,
                extendedStats,
                todayClasses,
                recentStudents,
            },
            {
                headers: {
                    "Cache-Control": "no-store",
                },
            },
        );
    } catch (error) {
        console.error("[api/admin/dashboard] failed:", error);
        return NextResponse.json({ error: "Failed to load dashboard" }, { status: 500 });
    }
}
