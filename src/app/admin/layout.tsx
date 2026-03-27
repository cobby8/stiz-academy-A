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
                <div className="p-6 border-b border-white/10 flex items-center gap-3 flex-shrink-0">
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
                <nav className="p-4 space-y-1 flex-1 overflow-y-auto">
                    {/* 학원 소개 */}
                    <p className="text-gray-500 text-xs font-bold uppercase px-4 py-2 mt-1">학원 소개</p>
                    <NavItem href="/admin/settings" active={pathname.startsWith("/admin/settings")} icon="🏫" label="학원 소개 관리" />
                    <NavItem href="/admin/coaches" active={pathname.startsWith("/admin/coaches")} icon="👤" label="코치/강사진 관리" />

                    {/* 수업 안내 */}
                    <p className="text-gray-500 text-xs font-bold uppercase px-4 py-2 mt-3">수업 안내</p>
                    <NavItem href="/admin/programs" active={pathname.startsWith("/admin/programs")} icon="📋" label="프로그램 관리" />
                    <NavItem href="/admin/schedule" active={pathname.startsWith("/admin/schedule")} icon="📅" label="수업시간표 관리" />
                    <NavItem href="/admin/annual" active={pathname.startsWith("/admin/annual")} icon="📆" label="연간일정 관리" />

                    {/* 소식/안내 */}
                    <p className="text-gray-500 text-xs font-bold uppercase px-4 py-2 mt-3">소식/안내</p>
                    <NavItem href="/admin/notices" active={pathname.startsWith("/admin/notices")} icon="📢" label="공지사항 관리" />
                    <NavItem href="/admin/gallery" active={pathname.startsWith("/admin/gallery")} icon="📸" label="사진/영상 갤러리" />
                    <NavItem href="/admin/faq" active={pathname.startsWith("/admin/faq")} icon="❓" label="FAQ 관리" />
                    <NavItem href="/admin/terms" active={pathname.startsWith("/admin/terms")} icon="📜" label="이용약관 관리" />

                    {/* 신청 관리 */}
                    <p className="text-gray-500 text-xs font-bold uppercase px-4 py-2 mt-3">신청 관리</p>
                    <NavItem href="/admin/apply" active={pathname.startsWith("/admin/apply")} icon="📝" label="체험/수강신청 관리" />

                    <p className="text-gray-500 text-xs font-bold uppercase px-4 py-2 mt-4">학원 운영 관리</p>
                    <NavItem href="/admin" active={pathname === "/admin"} icon="📊" label="대시보드" />
                    <NavItem href="/admin/students" active={pathname.startsWith("/admin/students")} icon="🧑‍🎓" label="원생 관리" />
                    <NavItem href="/admin/attendance" active={pathname.startsWith("/admin/attendance")} icon="✅" label="출결 관리" />
                    <NavItem href="/admin/finance" active={pathname.startsWith("/admin/finance")} icon="💳" label="수납/결제" />
                    <NavItem href="/admin/requests" active={pathname.startsWith("/admin/requests")} icon="📩" label="학부모 요청" />
                    <NavItem href="/admin/feedback" active={pathname.startsWith("/admin/feedback")} icon="📝" label="학습 피드백" />
                    <NavItem href="/admin/shuttle" active={pathname.startsWith("/admin/shuttle")} icon="🚌" label="셔틀버스 관제" />

                    <p className="text-gray-500 text-xs font-bold uppercase px-4 py-2 mt-4">시스템</p>
                    <BackupButtons />
                </nav>

                {/* 사용자 정보 + 로그아웃 */}
                <div className="p-4 border-t border-white/10 flex-shrink-0">
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

function BackupButtons() {
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState<string | null>(null);
    const [ok, setOk] = useState(true);

    function show(text: string, isOk: boolean) {
        setMsg(text);
        setOk(isOk);
    }

    async function handleRestore(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!confirm(`"${file.name}" 파일로 복원하시겠습니까?`)) { e.target.value = ""; return; }
        setBusy(true);
        setMsg(null);
        try {
            const json = JSON.parse(await file.text());
            const res = await fetch("/api/admin/backup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(json) });
            const data = await res.json();
            data.success ? show("복원 완료", true) : show(`오류: ${data.error}`, false);
        } catch { show("파일 파싱 오류", false); }
        finally { setBusy(false); e.target.value = ""; }
    }

    async function handleCloudRestore() {
        if (!confirm("가장 최근 자동 백업으로 복원하시겠습니까?")) return;
        setBusy(true);
        setMsg(null);
        try {
            const listRes = await fetch("/api/admin/cloud-backups");
            const { files } = await listRes.json();
            if (!files?.length) { show("클라우드 백업 없음 (자정에 자동 생성됩니다)", false); return; }
            const res = await fetch("/api/admin/cloud-backups", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ filename: files[0].filename }) });
            const data = await res.json();
            data.success ? show(`복원 완료 (${files[0].filename.slice(12, 27)})`, true) : show(`오류: ${data.error}`, false);
        } catch { show("복원 실패", false); }
        finally { setBusy(false); }
    }

    async function handleBackupNow() {
        if (!confirm("지금 즉시 클라우드에 백업하시겠습니까?")) return;
        setBusy(true);
        setMsg(null);
        try {
            const res = await fetch("/api/admin/backup-now", { method: "POST" });
            const data = await res.json();
            data.success ? show(`저장 완료 (${data.filename?.slice(12, 27)})`, true) : show(`오류: ${data.error}`, false);
        } catch { show("백업 실패", false); }
        finally { setBusy(false); }
    }

    async function handleSyncSchedule() {
        setBusy(true);
        setMsg(null);
        try {
            const res = await fetch("/api/admin/sync-schedule", { method: "POST" });
            const data = await res.json();
            data.success ? show(`시트 동기화 완료 (${data.synced}개 슬롯)`, true) : show(`오류: ${data.error}`, false);
        } catch { show("동기화 실패", false); }
        finally { setBusy(false); }
    }

    return (
        <div className="px-4 py-2 space-y-1">
            <button
                onClick={handleSyncSchedule}
                disabled={busy}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-left ${busy ? "opacity-50" : "text-gray-300 hover:bg-white/10 hover:text-white"}`}
            >
                <span className="text-xl">🔄</span>
                <span>시트 동기화</span>
            </button>
            <a
                href="/api/admin/backup"
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-gray-300 hover:bg-white/10 hover:text-white transition-colors"
            >
                <span className="text-xl">💾</span>
                <span>백업 다운로드</span>
            </a>
            <label className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors cursor-pointer ${busy ? "opacity-50" : "text-gray-300 hover:bg-white/10 hover:text-white"}`}>
                <span className="text-xl">📂</span>
                <span>{busy ? "처리 중..." : "파일로 복원"}</span>
                <input type="file" accept=".json" className="hidden" onChange={handleRestore} disabled={busy} />
            </label>
            <button
                onClick={handleCloudRestore}
                disabled={busy}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-left ${busy ? "opacity-50" : "text-gray-300 hover:bg-white/10 hover:text-white"}`}
            >
                <span className="text-xl">☁️</span>
                <span>최신 자동백업 복원</span>
            </button>
            <button
                onClick={handleBackupNow}
                disabled={busy}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-left ${busy ? "opacity-50" : "text-gray-300 hover:bg-white/10 hover:text-white"}`}
            >
                <span className="text-xl">☁️</span>
                <span>지금 클라우드에 저장</span>
            </button>
            <a
                href="/api/admin/export-seed"
                download="seed-data.ts"
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-gray-300 hover:bg-white/10 hover:text-white transition-colors"
            >
                <span className="text-xl">🌱</span>
                <span>seed 내보내기</span>
            </a>
            {msg && <p className={`text-xs px-4 py-1 break-all ${ok ? "text-green-400" : "text-yellow-400"}`}>{msg}</p>}
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
