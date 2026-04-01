/**
 * 관리자 알림 목록 API
 *
 * GET  /api/admin/notifications         — 최신 알림 20건 조회
 * GET  /api/admin/notifications?unread=1 — 읽지 않은 알림만
 * POST /api/admin/notifications         — 알림 읽음 처리 { id: string }
 * POST /api/admin/notifications         — 전체 읽음  { markAllRead: true }
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

// 관리자 인증 확인 헬퍼
async function getAdminUser() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const rows = await prisma.$queryRawUnsafe<{ id: string; role: string }[]>(
        `SELECT id, role FROM "User" WHERE id = $1 LIMIT 1`,
        user.id,
    );
    if (!rows[0] || rows[0].role !== "ADMIN") return null;
    return rows[0];
}

// GET — 알림 목록 조회
export async function GET(request: Request) {
    const admin = await getAdminUser();
    if (!admin) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get("unread") === "1";

    try {
        // 읽지 않은 알림 수 (배지 표시용)
        const countRows = await prisma.$queryRawUnsafe<{ cnt: number }[]>(
            `SELECT COUNT(*)::int AS cnt FROM "Notification" WHERE "userId" = $1 AND "isRead" = false`,
            admin.id,
        );
        const unreadCount = countRows[0]?.cnt ?? 0;

        // 알림 목록 (최신 20건)
        const whereClause = unreadOnly
            ? `WHERE "userId" = $1 AND "isRead" = false`
            : `WHERE "userId" = $1`;

        const notifications = await prisma.$queryRawUnsafe<any[]>(
            `SELECT id, type, title, message, "linkUrl", "isRead", "createdAt"
             FROM "Notification"
             ${whereClause}
             ORDER BY "createdAt" DESC
             LIMIT 20`,
            admin.id,
        );

        return NextResponse.json({ unreadCount, notifications });
    } catch (e) {
        console.error("[GET /api/admin/notifications]", e);
        return NextResponse.json({ error: "조회 실패" }, { status: 500 });
    }
}

// POST — 읽음 처리
export async function POST(request: Request) {
    const admin = await getAdminUser();
    if (!admin) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await request.json();

        if (body.markAllRead) {
            // 전체 읽음 처리
            await prisma.$executeRawUnsafe(
                `UPDATE "Notification" SET "isRead" = true WHERE "userId" = $1 AND "isRead" = false`,
                admin.id,
            );
        } else if (body.id) {
            // 개별 읽음 처리
            await prisma.$executeRawUnsafe(
                `UPDATE "Notification" SET "isRead" = true WHERE id = $1 AND "userId" = $2`,
                body.id, admin.id,
            );
        }

        return NextResponse.json({ success: true });
    } catch (e) {
        console.error("[POST /api/admin/notifications]", e);
        return NextResponse.json({ error: "처리 실패" }, { status: 500 });
    }
}
