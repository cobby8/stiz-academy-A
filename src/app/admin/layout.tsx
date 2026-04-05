"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { LogOut } from "lucide-react";

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

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname() || "/admin";
    const router = useRouter();
    const [userName, setUserName] = useState<string>("");
    const [userEmail, setUserEmail] = useState<string>("");
    // 새 체험 신청 건수 — 사이드바 배지 표시용
    const [newTrialCount, setNewTrialCount] = useState(0);

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
    }, [autoTab]);

    useEffect(() => {
        const supabase = createClient();
        supabase.auth.getUser().then(({ data: { user } }) => {
            if (user) {
                setUserName(user.user_metadata?.name || "관리자");
                setUserEmail(user.email || "");
            }
        });
        // 새 체험 신청 건수 조회 (사이드바 배지 표시용)
        fetch("/api/admin/trial-count")
            .then((r) => r.json())
            .then((d) => setNewTrialCount(d.count ?? 0))
            .catch(() => {});
    }, []);

    async function handleLogout() {
        const supabase = createClient();
        await supabase.auth.signOut();
        router.push("/login");
        router.refresh();
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex">
            {/* Sidebar */}
            <aside className="w-64 bg-brand-navy-900 text-white flex-shrink-0 fixed h-full z-10 transition-transform flex flex-col">
                <div className="p-6 border-b border-white/10 flex items-center gap-3 flex-shrink-0">
                    <div className="bg-white dark:bg-gray-800 px-3 py-2 rounded-md flex items-center justify-center">
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
                                ? "bg-white dark:bg-gray-800/15 text-white"
                                : "text-white/50 hover:text-white/80 hover:bg-white dark:hover:bg-gray-800/5"
                        }`}
                    >
                        사이트
                    </button>
                    <button
                        onClick={() => setActiveTab("ops")}
                        className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${
                            activeTab === "ops"
                                ? "bg-white dark:bg-gray-800/15 text-white"
                                : "text-white/50 hover:text-white/80 hover:bg-white dark:hover:bg-gray-800/5"
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
                            <NavItem href="/admin/faq" active={pathname.startsWith("/admin/faq")} icon="❓" label="FAQ 관리" />
                            <NavItem href="/admin/testimonials" active={pathname.startsWith("/admin/testimonials")} icon="⭐" label="학부모 후기" />
                            <NavItem href="/admin/terms" active={pathname.startsWith("/admin/terms")} icon="📜" label="이용약관 관리" />

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
                            <NavItem href="/admin/trial" active={pathname.startsWith("/admin/trial")} icon="🤝" label="체험 CRM" badge={newTrialCount} />
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
                            <BackupButtons />
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
                        <button
                            onClick={handleLogout}
                            title="로그아웃"
                            className="p-1.5 text-gray-400 hover:text-white hover:bg-white dark:hover:bg-gray-800/10 rounded-lg transition-colors flex-shrink-0"
                        >
                            <LogOut size={18} />
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 ml-64 flex flex-col min-h-screen">
                <header className="h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-8 sticky top-0 z-10">
                    <h2 className="font-bold text-gray-700 dark:text-gray-200">관리자 시스템</h2>
                    <div className="flex items-center gap-4">
                        {/* 알림 벨 — 읽지 않은 알림 수 배지 + 드롭다운 */}
                        <NotificationBell />
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-300">{userName}님, 환영합니다.</span>
                        <div className="w-8 h-8 bg-brand-orange-500 dark:bg-brand-neon-lime dark:text-brand-navy-900 rounded-full flex items-center justify-center text-white text-xs font-bold">
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
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-left ${busy ? "opacity-50" : "text-gray-300 hover:bg-white dark:hover:bg-gray-800/10 hover:text-white"}`}
            >
                <span className="text-xl">🔄</span>
                <span>시트 동기화</span>
            </button>
            <a
                href="/api/admin/backup"
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-gray-300 hover:bg-white dark:hover:bg-gray-800/10 hover:text-white transition-colors"
            >
                <span className="text-xl">💾</span>
                <span>백업 다운로드</span>
            </a>
            <label className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors cursor-pointer ${busy ? "opacity-50" : "text-gray-300 hover:bg-white dark:hover:bg-gray-800/10 hover:text-white"}`}>
                <span className="text-xl">📂</span>
                <span>{busy ? "처리 중..." : "파일로 복원"}</span>
                <input type="file" accept=".json" className="hidden" onChange={handleRestore} disabled={busy} />
            </label>
            <button
                onClick={handleCloudRestore}
                disabled={busy}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-left ${busy ? "opacity-50" : "text-gray-300 hover:bg-white dark:hover:bg-gray-800/10 hover:text-white"}`}
            >
                <span className="text-xl">☁️</span>
                <span>최신 자동백업 복원</span>
            </button>
            <button
                onClick={handleBackupNow}
                disabled={busy}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-left ${busy ? "opacity-50" : "text-gray-300 hover:bg-white dark:hover:bg-gray-800/10 hover:text-white"}`}
            >
                <span className="text-xl">☁️</span>
                <span>지금 클라우드에 저장</span>
            </button>
            <a
                href="/api/admin/export-seed"
                download="seed-data.ts"
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-gray-300 hover:bg-white dark:hover:bg-gray-800/10 hover:text-white transition-colors"
            >
                <span className="text-xl">🌱</span>
                <span>seed 내보내기</span>
            </a>
            {msg && <p className={`text-xs px-4 py-1 break-all ${ok ? "text-green-400" : "text-yellow-400"}`}>{msg}</p>}
        </div>
    );
}

function NavItem({ href, active, icon, label, badge }: { href: string; active?: boolean; icon: string; label: string; badge?: number }) {
    return (
        <Link
            href={href}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${active
                ? "bg-brand-orange-500 dark:bg-brand-neon-lime dark:text-brand-navy-900 text-white font-bold"
                : "text-gray-300 hover:bg-white dark:hover:bg-gray-800/10 hover:text-white"
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

// ── 알림 벨 드롭다운 컴포넌트 ────────────────────────────────────────────────
// 헤더에 표시되는 종 모양 아이콘 + 읽지 않은 알림 수 배지 + 드롭다운 목록
interface NotificationItem {
    id: string;
    type: string;
    title: string;
    message: string;
    linkUrl: string | null;
    isRead: boolean;
    createdAt: string;
}

function NotificationBell() {
    const [open, setOpen] = useState(false);           // 드롭다운 열림/닫힘
    const [unreadCount, setUnreadCount] = useState(0); // 읽지 않은 수
    const [items, setItems] = useState<NotificationItem[]>([]);
    const [loading, setLoading] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const router = useRouter();

    // 알림 목록 조회 함수
    const fetchNotifications = useCallback(async () => {
        try {
            const res = await fetch("/api/admin/notifications");
            if (!res.ok) return;
            const data = await res.json();
            setUnreadCount(data.unreadCount ?? 0);
            setItems(data.notifications ?? []);
        } catch {
            // 조회 실패해도 무시 — 벨 아이콘은 항상 표시
        }
    }, []);

    // 최초 로드 + 60초마다 폴링 (새 알림 확인)
    useEffect(() => {
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 60_000);
        return () => clearInterval(interval);
    }, [fetchNotifications]);

    // 드롭다운 바깥 클릭 시 닫기
    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        }
        if (open) document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [open]);

    // 벨 클릭 — 드롭다운 토글 + 목록 갱신
    function handleToggle() {
        if (!open) fetchNotifications();
        setOpen(!open);
    }

    // 개별 알림 클릭 — 읽음 처리 + 링크 이동
    async function handleClick(item: NotificationItem) {
        // 읽음 처리 (fire-and-forget)
        if (!item.isRead) {
            fetch("/api/admin/notifications", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: item.id }),
            }).catch(() => {});
            // UI 즉시 반영
            setItems(prev => prev.map(n => n.id === item.id ? { ...n, isRead: true } : n));
            setUnreadCount(prev => Math.max(0, prev - 1));
        }
        // 링크가 있으면 이동
        if (item.linkUrl) {
            router.push(item.linkUrl);
        }
        setOpen(false);
    }

    // 전체 읽음 처리
    async function handleMarkAllRead() {
        setLoading(true);
        try {
            await fetch("/api/admin/notifications", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ markAllRead: true }),
            });
            setItems(prev => prev.map(n => ({ ...n, isRead: true })));
            setUnreadCount(0);
        } catch {}
        setLoading(false);
    }

    // 시간 포맷: "방금", "3분 전", "2시간 전", "3일 전"
    function timeAgo(dateStr: string) {
        const diff = Date.now() - new Date(dateStr).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return "방금";
        if (mins < 60) return `${mins}분 전`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours}시간 전`;
        const days = Math.floor(hours / 24);
        return `${days}일 전`;
    }

    // 알림 타입별 아이콘 매핑
    function typeIcon(type: string) {
        switch (type) {
            case "TRIAL_APPLICATION": return "person_add";
            case "ENROLL_APPLICATION": return "how_to_reg";
            case "REQUEST": return "mail";
            case "ATTENDANCE": return "check_circle";
            case "PAYMENT": return "payments";
            case "NOTICE": return "campaign";
            default: return "notifications";
        }
    }

    return (
        <div className="relative" ref={dropdownRef}>
            {/* 벨 아이콘 버튼 */}
            <button
                onClick={handleToggle}
                className="relative p-2 text-gray-500 hover:text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:bg-gray-800 rounded-lg transition-colors"
                title="알림"
            >
                <span className="material-symbols-outlined text-[22px]">notifications</span>
                {/* 읽지 않은 알림 수 배지 */}
                {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold bg-red-500 text-white">
                        {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                )}
            </button>

            {/* 드롭다운 패널 */}
            {open && (
                <div className="absolute right-0 top-full mt-2 w-96 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden">
                    {/* 헤더 */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                        <h3 className="font-bold text-gray-800 dark:text-gray-100 text-sm">알림</h3>
                        {unreadCount > 0 && (
                            <button
                                onClick={handleMarkAllRead}
                                disabled={loading}
                                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                            >
                                모두 읽음
                            </button>
                        )}
                    </div>

                    {/* 알림 목록 */}
                    <div className="max-h-[400px] overflow-y-auto">
                        {items.length === 0 ? (
                            <div className="py-12 text-center text-gray-400 text-sm">
                                <span className="material-symbols-outlined text-4xl block mb-2">notifications_off</span>
                                알림이 없습니다
                            </div>
                        ) : (
                            items.map(item => (
                                <button
                                    key={item.id}
                                    onClick={() => handleClick(item)}
                                    className={`w-full text-left px-4 py-3 flex gap-3 hover:bg-gray-50 dark:bg-gray-900 transition-colors border-b border-gray-50 ${
                                        !item.isRead ? "bg-blue-50/50" : ""
                                    }`}
                                >
                                    {/* 타입별 아이콘 */}
                                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                                        !item.isRead ? "bg-blue-100 text-blue-600" : "bg-gray-100 dark:bg-gray-800 text-gray-400"
                                    }`}>
                                        <span className="material-symbols-outlined text-[18px]">{typeIcon(item.type)}</span>
                                    </div>
                                    {/* 내용 */}
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-sm truncate ${!item.isRead ? "font-semibold text-gray-900 dark:text-white" : "text-gray-600 dark:text-gray-300"}`}>
                                            {item.title}
                                        </p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">{item.message}</p>
                                        <p className="text-[11px] text-gray-400 mt-1">{timeAgo(item.createdAt)}</p>
                                    </div>
                                    {/* 읽지 않은 표시 점 */}
                                    {!item.isRead && (
                                        <div className="flex-shrink-0 w-2 h-2 rounded-full bg-blue-500 mt-2" />
                                    )}
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
