import type { Metadata } from "next";
import type { ReactNode } from "react";
import { requireStaff } from "@/lib/auth-guard";
import StaffBottomNav from "./StaffBottomNav";
import StaffInstallPrompt from "./StaffInstallPrompt";
import StaffProfileMenu from "./StaffProfileMenu";
import StaffHomeLink from "./StaffHomeLink";

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
          <StaffHomeLink />
          <StaffProfileMenu staffName={staff.appUserName} staffRole={staff.appUserRole} />
        </div>
      </header>
      <StaffInstallPrompt />
      {children}
      <StaffBottomNav staffRole={staff.appUserRole} />
    </div>
  );
}
