"use client";

import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import { logout } from "@/app/actions/auth";
import FontFreeIcon from "@/components/ui/FontFreeIcon";

const LazyBackupButtons = dynamic(() => import("./AdminBackupButtons"), {
    ssr: false,
    loading: () => <div className="px-8 py-3 text-xs text-gray-500">도구 준비 중...</div>,
});

const LazyNotificationBell = dynamic(() => import("./AdminNotificationBell"), {
    ssr: false,
    loading: () => (
        <div className="h-10 w-10 rounded-lg bg-gray-100 dark:bg-gray-800" aria-hidden="true" />
    ),
});

// "학원운영" 탭에 속하는 경로 목록 — 이 경로로 시작하면 학원운영 탭 활성화
const OPS_PATHS = [
    "/admin/students",
    "/admin/attendance",
    "/admin/finance",
    "/admin/requests",
    "/admin/feedback",
    "/admin/shuttle",
    "/admin/trial",
    "/admin/waitlist",
    "/admin/makeup",
    "/admin/skills",
    "/admin/stats",
    "/admin/sms",
    "/admin/import",
    "/admin/staff",
    "/admin/apply",
];

export default function AdminShellClient({
    children,
    initialUserName,
    initialUserEmail,
}: {
    children: React.ReactNode;
    initialUserName: string;
    initialUserEmail: string;
}) {
    const pathname = usePathname() || "/admin";
    const userName = initialUserName;
    const userEmail = initialUserEmail;
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    // 현재 URL 경로를 기반으로 활성 탭을 자동 결정
    // "/admin" 정확 일치(대시보드) 또는 OPS_PATHS로 시작하면 "학원운영"
    const autoTab = useMemo(() => {
        if (pathname === "/admin") return "ops" as const;
        if (OPS_PATHS.some((p) => pathname.startsWith(p))) return "ops" as const;
        return "site" as const;
    }, [pathname]);

    // 탭 상태 — URL 변경 시 자동으로 따라감
    const [activeTab, setActiveTab] = useState<"site" | "ops">(autoTab);

    // URL이 바뀌면 탭도 자동 전환 (다른 탭의 메뉴를 직접 URL로 접근했을 때)
    useEffect(() => {
        setActiveTab(autoTab);
        setMobileMenuOpen(false);
    }, [autoTab, pathname]);

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex">
            {mobileMenuOpen && (
                <button
                    type="button"
                    aria-label="관리자 메뉴 닫기"
                    className="fixed inset-0 z-30 bg-black/45 md:hidden"
                    onClick={() => setMobileMenuOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside
                className={`${
                    mobileMenuOpen
                        ? "fixed inset-y-0 left-0 z-40 flex h-dvh w-72 max-w-[85vw]"
                        : "hidden"
                } flex-shrink-0 flex-col bg-brand-navy-900 text-white md:fixed md:inset-y-0 md:left-0 md:z-10 md:flex md:h-full md:w-64 md:max-w-none`}
            >
                <div className="p-6 border-b border-white/10 flex items-center gap-3 flex-shrink-0">
                    <div className="bg-white dark:bg-white px-3 py-2 rounded-md flex items-center justify-center">
                        <Image
                            src="/stiz-logo.png"
                            alt="STIZ Admin"
                            width={130}
                            height={32}
                            className="h-8 w-auto object-contain"
                        />
                    </div>
                    <span className="font-bold text-white tracking-tight ml-2">Admin</span>
                </div>
                {/* 탭 전환 버튼 — 로고 바로 아래, 메뉴 목록 위 */}
                <div className="px-4 pt-4 pb-2 flex gap-1 flex-shrink-0">
                    <button
                        onClick={() => setActiveTab("site")}
                        className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${
                            activeTab === "site"
                                ? "bg-white text-brand-navy-900 dark:bg-white/10 dark:text-white"
                                : "text-white/60 hover:bg-white/10 hover:text-white"
                        }`}
                    >
                        사이트
                    </button>
                    <button
                        onClick={() => setActiveTab("ops")}
                        className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${
                            activeTab === "ops"
                                ? "bg-white text-brand-navy-900 dark:bg-white/10 dark:text-white"
                                : "text-white/60 hover:bg-white/10 hover:text-white"
                        }`}
                    >
                        학원운영
                    </button>
                </div>

                <nav className="p-4 space-y-1 flex-1 overflow-y-auto">
                    {/* ===== 사이트 탭 메뉴 ===== */}
                    {activeTab === "site" && (
                        <>
                            {/* 학원 소개 */}
                            <p className="text-gray-500 dark:text-gray-400 text-xs font-bold uppercase px-4 py-2 mt-1">학원 소개</p>
                            <NavItem href="/admin/settings" active={pathname.startsWith("/admin/settings")} icon="🏫" label="학원 소개 관리" />
                            <NavItem href="/admin/coaches" active={pathname.startsWith("/admin/coaches")} icon="👤" label="코치/강사진 관리" />

                            {/* 수업 안내 */}
                            <p className="text-gray-500 dark:text-gray-400 text-xs font-bold uppercase px-4 py-2 mt-3">수업 안내</p>
                            <NavItem href="/admin/programs" active={pathname.startsWith("/admin/programs")} icon="📋" label="프로그램 관리" />
                            <NavItem href="/admin/schedule" active={pathname.startsWith("/admin/schedule")} icon="📅" label="수업시간표 관리" />
                            <NavItem href="/admin/annual" active={pathname.startsWith("/admin/annual")} icon="📆" label="연간일정 관리" />

                            {/* 소식/안내 */}
                            <p className="text-gray-500 dark:text-gray-400 text-xs font-bold uppercase px-4 py-2 mt-3">소식/안내</p>
                            <NavItem href="/admin/notices" active={pathname.startsWith("/admin/notices")} icon="📢" label="공지사항 관리" />
                            <NavItem href="/admin/gallery" active={pathname.startsWith("/admin/gallery")} icon="📸" label="사진/영상 갤러리" />
                            <NavItem href="/staff/quick-post" active={pathname.startsWith("/staff/quick-post")} icon="⚡" label="사진 빠른 업로드" />
                            <NavItem href="/admin/faq" active={pathname.startsWith("/admin/faq")} icon="❓" label="FAQ 관리" />
                            <NavItem href="/admin/testimonials" active={pathname.startsWith("/admin/testimonials")} icon="⭐" label="학부모 후기" />
                            <NavItem href="/admin/terms" active={pathname.startsWith("/admin/terms")} icon="📜" label="이용약관 관리" />
                            <NavItem href="/admin/privacy" active={pathname.startsWith("/admin/privacy")} icon="🔐" label="개인정보처리방침" />

                            <div className="mt-4 border-t border-white/10 pt-4">
                                <Link
                                    href="/"
                                    prefetch={false}
                                    className="flex items-center justify-center gap-2 rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-white hover:text-brand-navy-900"
                                >
                                    <FontFreeIcon name="home" size={18} />
                                    <span>홈페이지 보기</span>
                                </Link>
                            </div>

                        </>
                    )}

                    {/* ===== 학원운영 탭 메뉴 ===== */}
                    {activeTab === "ops" && (
                        <>
                            <p className="text-gray-500 dark:text-gray-400 text-xs font-bold uppercase px-4 py-2 mt-1">학원 운영</p>
                            <NavItem href="/admin" active={pathname === "/admin"} icon="📊" label="대시보드" />
                            <NavItem href="/admin/students" active={pathname.startsWith("/admin/students")} icon="🧑‍🎓" label="원생 관리" />
                            <NavItem href="/admin/attendance" active={pathname === "/admin/attendance"} icon="✅" label="출결 관리" />
                            <NavItem href="/admin/attendance/report" active={pathname.startsWith("/admin/attendance/report")} icon="📝" label="수업 리포트" />
                            <NavItem href="/admin/finance" active={pathname === "/admin/finance"} icon="💳" label="수납/결제" />
                            <NavItem href="/admin/finance/billing" active={pathname.startsWith("/admin/finance/billing")} icon="📋" label="청구 설정" />
                            <NavItem href="/admin/requests" active={pathname.startsWith("/admin/requests")} icon="📩" label="학부모 요청" />
                            <NavItem href="/admin/feedback" active={pathname.startsWith("/admin/feedback")} icon="📝" label="학습 피드백" />
                            <NavItem href="/admin/shuttle" active={pathname.startsWith("/admin/shuttle")} icon="🚌" label="셔틀버스 관제" />
                            <NavItem href="/admin/apply" active={pathname.startsWith("/admin/apply")} icon="📝" label="체험/수강신청 관리" />
                            <NavItem href="/admin/trial" active={pathname.startsWith("/admin/trial")} icon="🤝" label="체험 CRM" />
                            <NavItem href="/admin/waitlist" active={pathname.startsWith("/admin/waitlist")} icon="⏳" label="대기자 관리" />
                            <NavItem href="/admin/makeup" active={pathname.startsWith("/admin/makeup")} icon="🔄" label="보강 관리" />
                            <NavItem href="/admin/skills" active={pathname.startsWith("/admin/skills")} icon="📈" label="스킬 트래킹" />
                            <NavItem href="/admin/stats" active={pathname.startsWith("/admin/stats")} icon="📊" label="상세 통계" />

                            <p className="text-gray-500 dark:text-gray-400 text-xs font-bold uppercase px-4 py-2 mt-4">커뮤니케이션</p>
                            <NavItem href="/admin/sms" active={pathname === "/admin/sms"} icon="💬" label="문자 발송" />
                            <NavItem href="/admin/sms/templates" active={pathname.startsWith("/admin/sms/templates")} icon="📋" label="템플릿 관리" />

                            <p className="text-gray-500 dark:text-gray-400 text-xs font-bold uppercase px-4 py-2 mt-4">데이터</p>
                            <NavItem href="/admin/import" active={pathname.startsWith("/admin/import")} icon="📥" label="수강생 이관" />

                            <p className="text-gray-500 dark:text-gray-400 text-xs font-bold uppercase px-4 py-2 mt-4">시스템</p>
                            <NavItem href="/admin/staff" active={pathname.startsWith("/admin/staff")} icon="👥" label="스태프 관리" />
                            <LazyBackupButtons />
                        </>
                    )}
                </nav>

                {/* 사용자 정보 + 로그아웃 */}
                <div className="p-4 border-t border-white/10 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-brand-orange-500 dark:bg-brand-neon-lime dark:text-brand-navy-900 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                            {userName.charAt(0) || "A"}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">{userName}</p>
                            <p className="text-xs text-gray-400 truncate">{userEmail}</p>
                        </div>
                        <form action={logout} className="flex-shrink-0">
                            <button
                                type="submit"
                                title="로그아웃"
                                className="p-1.5 text-gray-400 hover:bg-white/10 hover:text-white rounded-lg transition-colors"
                            >
                                <FontFreeIcon name="logout" size={18} />
                            </button>
                        </form>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex min-h-screen w-full min-w-0 flex-1 flex-col md:ml-64">
                <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 dark:bg-gray-800 dark:border-gray-700 md:h-16 md:px-8">
                    <div className="flex min-w-0 items-center gap-3">
                        <button
                            type="button"
                            aria-label="관리자 메뉴 열기"
                            className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-gray-200 text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700 md:hidden"
                            onClick={() => setMobileMenuOpen(true)}
                        >
                            <FontFreeIcon name="menu" size={22} />
                        </button>
                        <h2 className="truncate font-bold text-gray-700 dark:text-gray-200">관리자 시스템</h2>
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-2 md:gap-4">
                        {/* 알림 벨 — 읽지 않은 알림 수 배지 + 드롭다운 */}
                        <LazyNotificationBell />
                        <span className="hidden text-sm font-medium text-gray-600 dark:text-gray-300 sm:inline">{userName}님, 환영합니다.</span>
                        <div className="w-8 h-8 bg-brand-orange-500 dark:bg-brand-neon-lime dark:text-brand-navy-900 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                            {userName.charAt(0) || "A"}
                        </div>
                    </div>
                </header>
                <div className="w-full min-w-0 flex-1 p-4 md:p-8">
                    {children}
                </div>
            </main>
        </div>
    );
}

function NavItem({ href, active, icon, label, badge }: { href: string; active?: boolean; icon: string; label: string; badge?: number }) {
    return (
        <Link
            href={href}
            prefetch={false}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${active
                ? "bg-brand-orange-500 dark:bg-brand-neon-lime dark:text-brand-navy-900 text-white font-bold"
                : "text-gray-300 hover:bg-white/10 hover:text-white"
                }`}
        >
            <span className="text-xl">{icon}</span>
            <span className="flex-1">{label}</span>
            {/* 배지 — 새 신청 건수 등 알림 표시 */}
            {badge != null && badge > 0 && (
                <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold bg-red-500 text-white">
                    {badge}
                </span>
            )}
        </Link>
    );
}
