import Link from "next/link";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { requireStaff } from "@/lib/auth-guard";
import StaffBottomNav from "./StaffBottomNav";
import StaffInstallPrompt from "./StaffInstallPrompt";

export const metadata: Metadata = {
  title: "STIZ 선생님",
  description: "수업, 출결, 학생 연락과 청구를 관리하는 STIZ 교사용 앱",
  manifest: "/manifest-staff.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "STIZ 교사용",
  },
  icons: {
    apple: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
};

export default async function StaffLayout({ children }: { children: ReactNode }) {
  const staff = await requireStaff();

  return (
    <div className="min-h-screen bg-surface-warm pb-[calc(5.75rem+env(safe-area-inset-bottom))] dark:bg-gray-950">
      <header className="sticky top-0 z-30 border-b border-gray-200/80 bg-white/90 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] shadow-sm backdrop-blur-xl dark:border-gray-800 dark:bg-gray-950/90">
        <div className="mx-auto flex min-h-11 max-w-lg items-center justify-between gap-3">
          <Link href="/staff" className="flex min-h-11 items-center gap-2 rounded-xl pr-2 text-brand-navy-900 dark:text-white" aria-label="교사용 홈으로 이동">
            <span className="grid size-9 place-items-center rounded-xl bg-[var(--brand-accent)] text-[var(--brand-accent-contrast)]" aria-hidden="true">
              <span className="material-symbols-outlined text-[1.25rem]">sports_soccer</span>
            </span>
            <span>
              <span className="block text-base font-black leading-tight">STIZ</span>
              <span className="block text-[0.68rem] font-bold leading-tight text-gray-500 dark:text-gray-400">선생님 앱</span>
            </span>
          </Link>
          <div className="flex min-h-10 items-center gap-2 rounded-full bg-gray-100 px-3 dark:bg-gray-900">
            <span className="material-symbols-outlined text-lg text-[var(--brand-accent)]" aria-hidden="true">account_circle</span>
            <span className="max-w-36 truncate text-sm font-bold text-gray-700 dark:text-gray-200">{staff.appUserName} 선생님</span>
          </div>
        </div>
      </header>
      <StaffInstallPrompt />
      {children}
      <StaffBottomNav />
    </div>
  );
}
