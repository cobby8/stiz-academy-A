import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

// ── Server Action 인증 가드 ──────────────────────────────────────
// 미들웨어는 "페이지 접근"만 보호한다.
// Server Action은 직접 POST 요청으로 호출 가능하므로,
// 각 Action 함수 내부에서도 인증을 확인해야 한다.

/**
 * requireAuth: 로그인 여부만 확인
 * - 미인증이면 에러를 던진다
 * - 로그인된 사용자의 Supabase user 객체를 반환
 */
export async function requireAuth() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("인증이 필요합니다. 로그인해주세요.");
  }

  return user;
}

/**
 * requireAdmin: ADMIN 역할 확인
 * - 미인증이면 에러
 * - DB에서 role을 조회하여 ADMIN이 아니면 에러
 * - $queryRawUnsafe 사용: PgBouncer 트랜잭션 모드 호환
 */
export async function requireAdmin() {
  const user = await requireAuth();

  // DB에서 실제 role을 조회한다 (토큰의 metadata는 조작 가능하므로 신뢰하지 않음)
  const rows = await prisma.$queryRawUnsafe<{ role: string }[]>(
    `SELECT role FROM "User" WHERE email = $1 LIMIT 1`,
    user.email
  );

  if (rows.length === 0 || rows[0].role !== "ADMIN") {
    throw new Error("관리자 권한이 필요합니다.");
  }

  return user;
}
