"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import {
  defaultPathForRole,
  normalizeAppRole,
  resolveRedirectForRole,
  type AppRole,
} from "@/lib/auth-routes";

async function getRoleByEmail(email?: string | null): Promise<AppRole | null> {
  if (!email) return null;

  const rows = await prisma.$queryRawUnsafe<Array<{ role: string }>>(
    `SELECT role FROM "User" WHERE email = $1 LIMIT 1`,
    email,
  );

  return rows[0] ? normalizeAppRole(rows[0].role) : null;
}

async function insertSignupUser(data: {
  id: string;
  email: string;
  name: string;
  role: "PARENT";
}) {
  await prisma.$executeRawUnsafe(
    `INSERT INTO "User" (id, email, name, role, "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4::"Role", NOW(), NOW())
     ON CONFLICT (email) DO NOTHING`,
    data.id,
    data.email,
    data.name,
    data.role,
  );
}

export async function login(formData: FormData) {
  const supabase = await createClient();

  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  const redirectTo = formData.get("redirectTo") as string | null;

  if (!email || !password) {
    return { error: "이메일과 비밀번호를 입력해주세요." };
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    if (error.message === "Invalid login credentials") {
      return { error: "이메일 또는 비밀번호가 올바르지 않습니다." };
    }
    if (error.message === "Email not confirmed") {
      return { error: "이메일 인증이 필요합니다. 받은 인증 메일을 확인해주세요." };
    }
    return { error: `로그인 오류: ${error.message}` };
  }

  // 실제 권한은 DB 역할만 신뢰합니다. DB에 없는 계정은 안전한 학부모로 제한합니다.
  const role = (await getRoleByEmail(data.user?.email)) || "PARENT";
  const destination =
    role === "INSTRUCTOR" && !redirectTo
      ? "/staff"
      : resolveRedirectForRole(role, redirectTo);

  await supabase.auth.updateUser({
    data: {
      ...data.user?.user_metadata,
      role,
    },
  });

  revalidatePath("/", "layout");
  redirect(destination);
}

export async function signup(formData: FormData) {
  const supabase = await createClient();

  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  const name = String(formData.get("name") || "").trim();
  // 공개 회원가입은 학부모 전용입니다. 선생님 계정은 관리자 초대 흐름에서만 생성합니다.
  const role = "PARENT" as const;

  if (!email || !password || !name) {
    return { error: "모든 필수 항목을 입력해주세요." };
  }

  if (password.length < 6) {
    return { error: "비밀번호는 6자 이상이어야 합니다." };
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name,
        role,
      },
    },
  });

  if (error) {
    if (error.message.includes("already registered")) {
      return { error: "이미 등록된 이메일입니다." };
    }
    return { error: "회원가입 중 오류가 발생했습니다." };
  }

  if (!data.user) {
    return { error: "계정 정보를 확인하지 못했습니다. 잠시 후 다시 시도해주세요." };
  }

  await insertSignupUser({
    id: data.user.id,
    email,
    name,
    role,
  });

  revalidatePath("/", "layout");
  redirect(defaultPathForRole(role));
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}

export async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
