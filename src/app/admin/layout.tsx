"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname() || "/admin";

    return (
        <div className="min-h-screen bg-gray-50 flex">
            {/* Sidebar */}
            <aside className="w-64 bg-brand-navy-900 text-white flex-shrink-0 fixed h-full z-10 transition-transform">
                <div className="p-6 border-b border-white/10 flex items-center gap-3">
                    <div className="bg-white px-3 py-2 rounded-md flex items-center justify-center">
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
                <nav className="p-4 space-y-2">
                    <NavItem href="/admin" active={pathname === "/admin"} icon="📊" label="대시보드" />
                    <NavItem href="/admin/students" active={pathname.startsWith("/admin/students")} icon="🧑‍🎓" label="원생 관리" />
                    <NavItem href="/admin/programs" active={pathname.startsWith("/admin/programs")} icon="📋" label="프로그램 관리" />
                    <NavItem href="/admin/classes" active={pathname.startsWith("/admin/classes")} icon="🏀" label="클래스 관리" />
                    <NavItem href="/admin/attendance" active={pathname.startsWith("/admin/attendance")} icon="✅" label="출결 관리" />
                    <NavItem href="/admin/finance" active={pathname.startsWith("/admin/finance")} icon="💳" label="수납/결제" />
                    <NavItem href="/admin/settings" active={pathname.startsWith("/admin/settings")} icon="⚙️" label="학원 정보 설정" />
                    <NavItem href="/admin/shuttle" active={pathname.startsWith("/admin/shuttle")} icon="🚌" label="셔틀버스 관제" />
                </nav>
            </aside>

            {/* Main Content */}
            <main className="flex-1 ml-64 flex flex-col min-h-screen">
                <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8 sticky top-0 z-10">
                    <h2 className="font-bold text-gray-700">관리자 시스템</h2>
                    <div className="flex items-center gap-4">
                        <span className="text-sm font-medium text-gray-600">원장님, 환영합니다.</span>
                        <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
                    </div>
                </header>
                <div className="p-8 flex-1">
                    {children}
                </div>
            </main>
        </div>
    );
}

function NavItem({ href, active, icon, label }: { href: string; active?: boolean; icon: string; label: string }) {
    return (
        <Link
            href={href}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${active
                ? "bg-brand-orange-500 text-white font-bold"
                : "text-gray-300 hover:bg-white/10 hover:text-white"
                }`}
        >
            <span className="text-xl">{icon}</span>
            <span>{label}</span>
        </Link>
    );
}
