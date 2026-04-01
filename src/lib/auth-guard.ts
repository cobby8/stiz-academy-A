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
 * requireAdmin: ADMIN 또는 VICE_ADMIN 역할 확인
 * - 부원장(VICE_ADMIN)도 대부분의 관리 작업을 수행할 수 있도록 허용
 * - 미인증이면 에러
 * - DB에서 role을 조회하여 ADMIN/VICE_ADMIN이 아니면 에러
 * - $queryRawUnsafe 사용: PgBouncer 트랜잭션 모드 호환
 */
export async function requireAdmin() {
  const user = await requireAuth();

  // DB에서 실제 role을 조회한다 (토큰의 metadata는 조작 가능하므로 신뢰하지 않음)
  const rows = await prisma.$queryRawUnsafe<{ role: string }[]>(
    `SELECT role FROM "User" WHERE email = $1 LIMIT 1`,
    user.email
  );

  // ADMIN 또는 VICE_ADMIN만 통과
  if (rows.length === 0 || (rows[0].role !== "ADMIN" && rows[0].role !== "VICE_ADMIN")) {
    throw new Error("관리자 권한이 필요합니다.");
  }

  return user;
}

/**
 * requireOwner: ADMIN(원장)만 허용
 * - 스태프 관리, 역할 변경 등 최고 권한이 필요한 작업용
 * - VICE_ADMIN은 차단됨 — ADMIN만 통과
 */
export async function requireOwner() {
  const user = await requireAuth();

  const rows = await prisma.$queryRawUnsafe<{ role: string }[]>(
    `SELECT role FROM "User" WHERE email = $1 LIMIT 1`,
    user.email
  );

  if (rows.length === 0 || rows[0].role !== "ADMIN") {
    throw new Error("원장 권한이 필요합니다. (ADMIN만 가능)");
  }

  return user;
}
