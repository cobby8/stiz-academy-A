"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// 셔틀 관리 전용 탭 바 — 방학특강 셔틀(배차·명단) + 정규 셔틀 + 차량 관리를 한 곳에 모은다.
// (방학특강 운영 탭바 SeasonalSectionTabs와 분리)

const ITEMS: Array<{ key: string; href: string; label: string; icon: string }> = [
  { key: "dispatch", href: "/admin/seasonal/dispatch", label: "방학특강 배차", icon: "route" },
  { key: "roster", href: "/admin/seasonal/shuttle", label: "방학특강 명단", icon: "list_alt" },
  { key: "notice", href: "/admin/seasonal/shuttle-notice", label: "등원시간 안내", icon: "sms" },
  { key: "regular-dispatch", href: "/admin/shuttle/regular-dispatch", label: "정규 배차", icon: "route" },
  { key: "regular", href: "/admin/shuttle/regular", label: "정규 셔틀(시트)", icon: "commute" },
  { key: "vehicle", href: "/admin/shuttle", label: "차량 관리", icon: "directions_bus" },
];

function resolveActiveKey(pathname: string): string {
  if (pathname.startsWith("/admin/seasonal/dispatch")) return "dispatch";
  // 접두 충돌 주의: shuttle-notice 를 shuttle 보다 먼저 판정한다(아래 regular 쌍과 같은 이유).
  if (pathname.startsWith("/admin/seasonal/shuttle-notice")) return "notice";
  if (pathname.startsWith("/admin/seasonal/shuttle")) return "roster";
  // 접두 충돌 주의: regular-dispatch 를 regular 보다 먼저 판정한다.
  if (pathname.startsWith("/admin/shuttle/regular-dispatch")) return "regular-dispatch";
  if (pathname.startsWith("/admin/shuttle/regular")) return "regular";
  if (pathname.startsWith("/admin/shuttle")) return "vehicle";
  return "";
}

export default function ShuttleSectionTabs() {
  const pathname = usePathname();
  const active = resolveActiveKey(pathname);
  return (
    <div className="no-print mx-auto max-w-6xl px-4 pt-4">
      {/* 밑줄 탭 — 채움 없이 선택된 것만 강조색. 아이콘은 nav 글리프 목록에 없어 텍스트만 쓴다. */}
      <nav className="flex gap-6 overflow-x-auto" style={{ borderBottom: "1px solid var(--doc-rule)" }} aria-label="셔틀 관리 메뉴">
        {ITEMS.map((it) => {
          const on = it.key === active;
          return (
            <Link key={it.key} href={it.href}
              className="shrink-0 whitespace-nowrap py-2.5 text-[12.5px] transition-colors"
              style={{
                fontWeight: on ? 600 : 500,
                color: on ? "var(--doc-accent)" : "var(--doc-ink-3)",
                borderBottom: `2px solid ${on ? "var(--doc-accent)" : "transparent"}`,
              }}>
              {it.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
