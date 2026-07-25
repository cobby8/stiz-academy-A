"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS: Array<{ href: string; label: string; match: (p: string) => boolean }> = [
  { href: "/admin/seasonal", label: "신청·반 관리", match: (p) => p === "/admin/seasonal" || (p.startsWith("/admin/seasonal/") && !p.startsWith("/admin/seasonal/attendance")) },
  { href: "/admin/seasonal/attendance", label: "출석·보강", match: (p) => p.startsWith("/admin/seasonal/attendance") },
  { href: "/admin/shuttle", label: "셔틀 노선", match: (p) => p.startsWith("/admin/shuttle") },
];

export default function SeasonalSectionTabs() {
  const pathname = usePathname();
  return (
    <div className="mx-auto max-w-6xl px-4 pt-4">
      <div className="flex gap-1 overflow-x-auto border-b-2 border-gray-200 dark:border-gray-700">
        {TABS.map((t) => {
          const active = t.match(pathname);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`-mb-0.5 whitespace-nowrap border-b-[3px] px-4 py-2 text-sm font-black transition ${active ? "border-[var(--brand-accent)] text-[var(--brand-accent)]" : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"}`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
