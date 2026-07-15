"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/staff", label: "수업", icon: "home", exact: true },
  { href: "/staff/students", label: "학생", icon: "groups", exact: false },
  { href: "/staff/billing", label: "청구", icon: "receipt_long", exact: false },
] as const;

export default function StaffBottomNav() {
  const pathname = usePathname();
  return <nav aria-label="교사용 주요 메뉴" className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 dark:border-gray-800 dark:bg-gray-950">
    <div className="mx-auto grid max-w-lg grid-cols-3 gap-2">{items.map((item) => {
      const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
      return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={`flex min-h-12 flex-col items-center justify-center text-xs font-bold ${active ? "text-[var(--brand-accent)]" : "text-gray-500 dark:text-gray-400"}`}><span className="material-symbols-outlined" aria-hidden="true">{item.icon}</span>{item.label}</Link>;
    })}</div>
  </nav>;
}
