import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

// POST: ?몄떆 援щ룆 ?깅줉
export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
        }

        // ?대찓?쇰줈 User ?뚯씠釉붿뿉??userId 議고쉶
        const rows = await prisma.$queryRawUnsafe<any[]>(
            `SELECT id FROM "User" WHERE email = $1 LIMIT 1`, user.email
        );
        if (!rows[0]) {
            return NextResponse.json({ error: "사용자를 찾을 수 없습니다." }, { status: 404 });
        }
        const userId = rows[0].id;

        const { subscription } = await req.json();
        if (!subscription?.endpoint) {
            return NextResponse.json({ error: "구독 정보가 없습니다." }, { status: 400 });
        }

        // 援щ룆 ?뺣낫 ???(?대? ?덉쑝硫??낅뜲?댄듃)
        await prisma.$executeRawUnsafe(
            `INSERT INTO "PushSubscription" (id, "userId", endpoint, p256dh, auth, "createdAt")
             VALUES (gen_random_uuid()::text, $1, $2, $3, $4, NOW())
             ON CONFLICT (endpoint) DO UPDATE SET "userId" = $1, p256dh = $3, auth = $4`,
            userId,
            subscription.endpoint,
            subscription.keys.p256dh,
            subscription.keys.auth,
        );

        return NextResponse.json({ ok: true });
    } catch (e) {
        console.error("Push subscribe error:", e);
        return NextResponse.json({ error: "구독 처리에 실패했습니다." }, { status: 500 });
    }
}

// DELETE: ?몄떆 援щ룆 ?댁젣
export async function DELETE(req: NextRequest) {
    // ?몄쬆 泥댄겕: 濡쒓렇?명븳 ?ъ슜?먮쭔 援щ룆 ?댁젣 媛??
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    try {
        const rows = await prisma.$queryRawUnsafe<any[]>(
            `SELECT id FROM "User" WHERE email = $1 LIMIT 1`, user.email
        );
        if (!rows[0]) {
            return NextResponse.json({ error: "사용자를 찾을 수 없습니다." }, { status: 404 });
        }
        const userId = rows[0].id;

        const { endpoint } = await req.json();
        if (!endpoint) {
            return NextResponse.json({ error: "endpoint가 필요합니다." }, { status: 400 });
        }

        await prisma.$executeRawUnsafe(
            `DELETE FROM "PushSubscription" WHERE endpoint = $1 AND "userId" = $2`, endpoint, userId
        );

        return NextResponse.json({ ok: true });
    } catch (e) {
        console.error("Push unsubscribe error:", e);
        return NextResponse.json({ error: "구독 해제에 실패했습니다." }, { status: 500 });
    }
}
