import Link from "next/link";
import { requireStaff } from "@/lib/auth-guard";
import QuickPostClient from "./QuickPostClient";

export const dynamic = "force-dynamic";

export default async function StaffQuickPostPage() {
  try {
    const staff = await requireStaff();
    return (
      <QuickPostClient
        currentUser={{
          name: staff.appUserName,
          role: staff.appUserRole,
        }}
      />
    );
  } catch {
    return (
      <main className="min-h-screen bg-surface-warm px-4 py-10 dark:bg-gray-950">
        <div className="mx-auto max-w-md rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <h1 className="text-xl font-black text-brand-navy-900 dark:text-white">스태프 로그인이 필요합니다</h1>
          <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">
            사진 초안 업로드는 등록된 선생님, 부관리자, 관리자만 사용할 수 있습니다.
          </p>
          <Link
            href="/login?redirect=/staff/quick-post"
            className="mt-5 inline-flex w-full items-center justify-center rounded-lg bg-brand-orange-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-brand-orange-600 dark:bg-brand-neon-lime dark:text-brand-navy-900 dark:hover:bg-lime-400"
          >
            로그인하기
          </Link>
        </div>
      </main>
    );
  }
}
