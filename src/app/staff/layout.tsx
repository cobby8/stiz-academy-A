import Link from "next/link";
import type { ReactNode } from "react";
import { requireStaff } from "@/lib/auth-guard";

export default async function StaffLayout({ children }: { children: ReactNode }) {
  const staff = await requireStaff();

  return (
    <div className="min-h-screen bg-surface-warm pb-24 dark:bg-gray-950">
      <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-gray-800 dark:bg-gray-950/95">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <Link href="/staff" className="text-lg font-black text-brand-navy-900 dark:text-white">
            STIZ 선생님
          </Link>
          <span className="text-sm font-bold text-gray-500 dark:text-gray-300">{staff.appUserName} 선생님</span>
        </div>
      </header>
      {children}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 dark:border-gray-800 dark:bg-gray-950">
        <div className="mx-auto grid max-w-lg grid-cols-3 gap-2">
          <Link href="/staff" className="flex min-h-12 flex-col items-center justify-center text-xs font-bold text-[var(--brand-accent)]"><span className="material-symbols-outlined">home</span>오늘 수업</Link>
          <Link href="/staff#students" className="flex min-h-12 flex-col items-center justify-center text-xs font-bold text-gray-500"><span className="material-symbols-outlined">groups</span>학생</Link>
          <Link href="/staff#more" className="flex min-h-12 flex-col items-center justify-center text-xs font-bold text-gray-500"><span className="material-symbols-outlined">more_horiz</span>더보기</Link>
        </div>
      </nav>
    </div>
  );
}
