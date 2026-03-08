import { createAdminClient } from "@/lib/supabase/admin";
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
