"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { LogOut } from "lucide-react";

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname() || "/admin";
    const router = useRouter();
    const [userName, setUserName] = useState<string>("");
    const [userEmail, setUserEmail] = useState<string>("");

    useEffect(() => {
        const supabase = createClient();
        supabase.auth.getUser().then(({ data: { user } }) => {
            if (user) {
                setUserName(user.user_metadata?.name || "관리자");
                setUserEmail(user.email || "");
            }
        });
    }, []);

    async function handleLogout() {
        const supabase = createClient();
        await supabase.auth.signOut();
        router.push("/login");
        router.refresh();
    }

    return (
        <div className="min-h-screen bg-gray-50 flex">
            {/* Sidebar */}
            <aside className="w-64 bg-brand-navy-900 text-white flex-shrink-0 fixed h-full z-10 transition-transform flex flex-col">
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
                <nav className="p-4 space-y-1 flex-1">
                    <p className="text-gray-500 text-xs font-bold uppercase px-4 py-2 mt-1">홈페이지 콘텐츠</p>
                    <NavItem href="/admin/settings" active={pathname.startsWith("/admin/settings")} icon="🏫" label="학원 소개 관리" />
                    <NavItem href="/admin/programs" active={pathname.startsWith("/admin/programs")} icon="📋" label="프로그램·이용약관" />
                    <NavItem href="/admin/coaches" active={pathname.startsWith("/admin/coaches")} icon="👤" label="코치/강사진 관리" />
                    <NavItem href="/admin/schedule" active={pathname.startsWith("/admin/schedule")} icon="📅" label="수업시간표 관리" />

                    <p className="text-gray-500 text-xs font-bold uppercase px-4 py-2 mt-4">학원 운영 관리</p>
                    <NavItem href="/admin" active={pathname === "/admin"} icon="📊" label="대시보드" />
                    <NavItem href="/admin/students" active={pathname.startsWith("/admin/students")} icon="🧑‍🎓" label="원생 관리" />
                    <NavItem href="/admin/attendance" active={pathname.startsWith("/admin/attendance")} icon="✅" label="출결 관리" />
                    <NavItem href="/admin/finance" active={pathname.startsWith("/admin/finance")} icon="💳" label="수납/결제" />
                    <NavItem href="/admin/shuttle" active={pathname.startsWith("/admin/shuttle")} icon="🚌" label="셔틀버스 관제" />
                </nav>

                {/* 사용자 정보 + 로그아웃 */}
                <div className="p-4 border-t border-white/10">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-brand-orange-500 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                            {userName.charAt(0) || "A"}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">{userName}</p>
                            <p className="text-xs text-gray-400 truncate">{userEmail}</p>
                        </div>
                        <button
                            onClick={handleLogout}
                            title="로그아웃"
                            className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors flex-shrink-0"
                        >
                            <LogOut size={18} />
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 ml-64 flex flex-col min-h-screen">
                <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8 sticky top-0 z-10">
                    <h2 className="font-bold text-gray-700">관리자 시스템</h2>
                    <div className="flex items-center gap-4">
                        <span className="text-sm font-medium text-gray-600">{userName}님, 환영합니다.</span>
                        <div className="w-8 h-8 bg-brand-orange-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                            {userName.charAt(0) || "A"}
                        </div>
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
