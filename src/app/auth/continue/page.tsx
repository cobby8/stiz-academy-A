import Link from "next/link";
import { redirect } from "next/navigation";
import { logout } from "@/app/actions/auth";
import { resolveRedirectForRole, normalizeAppRole } from "@/lib/auth-routes";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

type ContinuePageProps = {
  searchParams: Promise<{
    context?: string | string[];
    redirect?: string | string[];
  }>;
};

export default async function AuthContinuePage({ searchParams }: ContinuePageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ role: string }>>(
      `SELECT role FROM "User"
       WHERE id = $1 OR LOWER(email) = LOWER($2)
       ORDER BY CASE WHEN id = $1 THEN 0 ELSE 1 END
       LIMIT 1`,
      user.id,
      user.email || "",
    );
    const role = normalizeAppRole(rows[0]?.role);
    const params = await searchParams;
    const context = Array.isArray(params.context) ? params.context[0] : params.context;
    const requestedPath = Array.isArray(params.redirect) ? params.redirect[0] : params.redirect;

    redirect(
      resolveRedirectForRole(role, requestedPath, {
        preferRoleHome: context === "staff" && requestedPath === "/staff",
      }),
    );
  } catch (error) {
    // Next.js redirects are implemented as thrown control-flow errors.
    if (error && typeof error === "object" && "digest" in error) throw error;

    return (
      <main className="grid min-h-screen place-items-center bg-surface-warm px-4 dark:bg-gray-950">
        <section className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <span className="material-symbols-outlined text-4xl text-brand-orange-500" aria-hidden="true">
            sync_problem
          </span>
          <h1 className="mt-3 text-xl font-black text-brand-navy-900 dark:text-white">
            계정 권한을 확인하지 못했습니다
          </h1>
          <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">
            잠시 후 다시 시도해 주세요. 같은 문제가 계속되면 학원 관리자에게 문의해 주세요.
          </p>
          <div className="mt-5 grid gap-2">
            <Link
              href="/auth/continue"
              className="flex min-h-11 items-center justify-center rounded-xl bg-brand-orange-500 px-4 font-bold text-white"
            >
              다시 시도
            </Link>
            <form action={logout}>
              <button
                type="submit"
                className="min-h-11 w-full rounded-xl border border-gray-300 px-4 font-bold text-gray-700 dark:border-gray-700 dark:text-gray-200"
              >
                로그아웃
              </button>
            </form>
          </div>
        </section>
      </main>
    );
  }
}
