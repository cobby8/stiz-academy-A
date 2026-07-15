import Link from "next/link";
import type { ReactNode } from "react";
import { requireStaff } from "@/lib/auth-guard";
import StaffBottomNav from "./StaffBottomNav";

export default async function StaffLayout({ children }: { children: ReactNode }) {
  const staff = await requireStaff();

  return (
    <div className="min-h-screen bg-surface-warm pb-24 dark:bg-gray-950">
      <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-gray-800 dark:bg-gray-950/95">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <Link href="/staff" className="text-lg font-black text-brand-navy-900 dark:text-white">STIZ 선생님</Link>
          <span className="text-sm font-bold text-gray-500 dark:text-gray-300">{staff.appUserName} 선생님</span>
        </div>
      </header>
      {children}
      <StaffBottomNav />
    </div>
  );
}
