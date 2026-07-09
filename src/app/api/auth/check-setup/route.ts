import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const supabase = createAdminClient();

    // Supabase Auth에 등록된 유저가 있는지 확인
    const {
      data: { users },
      error,
    } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 });

    if (error) {
      return NextResponse.json({ hasAdmin: false });
    }

    const hasAdmin = users.length > 0;
    return NextResponse.json({ hasAdmin });
  } catch {
    return NextResponse.json({ hasAdmin: false });
  }
}

export async function POST(request: Request) {
  try {
    const { email, password, name } = await request.json();
    const safeEmail = String(email || "").trim();
    const safePassword = String(password || "");
    const safeName = String(name || "").trim();

    if (!safeEmail || !safePassword || !safeName) {
      return NextResponse.json({ error: "모든 필수 항목을 입력해주세요." }, { status: 400 });
    }

    if (safePassword.length < 6) {
      return NextResponse.json({ error: "비밀번호는 6자 이상이어야 합니다." }, { status: 400 });
    }

    const adminSupabase = createAdminClient();
    const {
      data: { users },
      error: listError,
    } = await adminSupabase.auth.admin.listUsers({ page: 1, perPage: 1 });

    if (listError) {
      return NextResponse.json({ error: "설정 상태를 확인하지 못했습니다." }, { status: 500 });
    }

    if (users.length > 0) {
      return NextResponse.json({ error: "이미 관리자 계정이 존재합니다." }, { status: 409 });
    }

    const { data, error: createError } = await adminSupabase.auth.admin.createUser({
      email: safeEmail,
      password: safePassword,
      email_confirm: true,
      user_metadata: {
        name: safeName,
        role: "ADMIN",
      },
    });

    if (createError || !data.user) {
      return NextResponse.json(
        { error: createError?.message || "관리자 계정 생성에 실패했습니다." },
        { status: 400 },
      );
    }

    await prisma.$executeRawUnsafe(
      `INSERT INTO "User" (id, email, name, role, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, 'ADMIN'::"Role", NOW(), NOW())
       ON CONFLICT (email) DO UPDATE
       SET id = EXCLUDED.id,
           name = EXCLUDED.name,
           role = EXCLUDED.role,
           "updatedAt" = NOW()`,
      data.user.id,
      safeEmail,
      safeName,
    );

    const authSupabase = await createClient();
    const { error: signInError } = await authSupabase.auth.signInWithPassword({
      email: safeEmail,
      password: safePassword,
    });

    if (signInError) {
      return NextResponse.json({ success: true, redirectTo: "/login" });
    }

    return NextResponse.json({ success: true, redirectTo: "/admin" });
  } catch {
    return NextResponse.json({ error: "관리자 생성 중 오류가 발생했습니다." }, { status: 500 });
  }
}
