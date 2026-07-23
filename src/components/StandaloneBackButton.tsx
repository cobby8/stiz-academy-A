"use client";

import { usePathname } from "next/navigation";
import AppBackButton from "@/components/AppBackButton";

const STANDALONE_PREFIXES = [
  "/account/activate",
  "/auth/continue",
  "/invite",
  "/login",
  "/payments",
  "/setup",
  "/signup/parent",
  "/teacher-app",
];

function fallbackFor(pathname: string) {
  if (pathname.startsWith("/payments")) return "/mypage";
  if (pathname.startsWith("/teacher-app")) return "/staff";
  return "/";
}

export default function StandaloneBackButton() {
  const pathname = usePathname() || "/";
  const shouldShow = STANDALONE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

  if (!shouldShow) return null;

  return (
    <div className="fixed left-3 top-[max(0.75rem,env(safe-area-inset-top))] z-[90]">
      <AppBackButton fallbackHref={fallbackFor(pathname)} variant="floating" />
    </div>
  );
}
