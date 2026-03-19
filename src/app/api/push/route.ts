import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

// POST: 푸시 구독 등록
export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: "로그인 필요" }, { status: 401 });
        }

        // 이메일로 User 테이블에서 userId 조회
        const rows = await prisma.$queryRawUnsafe<any[]>(
            `SELECT id FROM "User" WHERE email = $1 LIMIT 1`, user.email
        );
        if (!rows[0]) {
            return NextResponse.json({ error: "사용자 없음" }, { status: 404 });
        }
        const userId = rows[0].id;

        const { subscription } = await req.json();
        if (!subscription?.endpoint) {
            return NextResponse.json({ error: "구독 정보 없음" }, { status: 400 });
        }

        // 구독 정보 저장 (이미 있으면 업데이트)
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
        return NextResponse.json({ error: "구독 실패" }, { status: 500 });
    }
}

// DELETE: 푸시 구독 해제
export async function DELETE(req: NextRequest) {
    // 인증 체크: 로그인한 사용자만 구독 해제 가능
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: "인증 필요" }, { status: 401 });
    }

    try {
        const { endpoint } = await req.json();
        if (!endpoint) {
            return NextResponse.json({ error: "endpoint 필요" }, { status: 400 });
        }

        await prisma.$executeRawUnsafe(
            `DELETE FROM "PushSubscription" WHERE endpoint = $1`, endpoint
        );

        return NextResponse.json({ ok: true });
    } catch (e) {
        console.error("Push unsubscribe error:", e);
        return NextResponse.json({ error: "구독 해제 실패" }, { status: 500 });
    }
}
