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
                    <NavItem href="/admin/apply" active={pathname.startsWith("/admin/apply")} icon="📝" label="체험/수강신청 관리" />

                    <p className="text-gray-500 text-xs font-bold uppercase px-4 py-2 mt-4">학원 운영 관리</p>
                    <NavItem href="/admin" active={pathname === "/admin"} icon="📊" label="대시보드" />
                    <NavItem href="/admin/students" active={pathname.startsWith("/admin/students")} icon="🧑‍🎓" label="원생 관리" />
                    <NavItem href="/admin/attendance" active={pathname.startsWith("/admin/attendance")} icon="✅" label="출결 관리" />
                    <NavItem href="/admin/finance" active={pathname.startsWith("/admin/finance")} icon="💳" label="수납/결제" />
                    <NavItem href="/admin/shuttle" active={pathname.startsWith("/admin/shuttle")} icon="🚌" label="셔틀버스 관제" />

                    <p className="text-gray-500 text-xs font-bold uppercase px-4 py-2 mt-4">시스템</p>
                    <BackupButtons />
                    <CloudBackupPanel />
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

function BackupButtons() {
    const [restoring, setRestoring] = useState(false);
    const [seeding, setSeeding] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [msgType, setMsgType] = useState<"success" | "error">("success");

    function handleDownload() {
        window.location.href = "/api/admin/backup";
    }

    async function handleRestore(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!confirm(`"${file.name}" 파일로 데이터를 복원하시겠습니까?\n기존 데이터에 덮어씁니다.`)) {
            e.target.value = "";
            return;
        }
        setRestoring(true);
        setMessage(null);
        try {
            const text = await file.text();
            const json = JSON.parse(text);
            const res = await fetch("/api/admin/backup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(json),
            });
            const data = await res.json();
            if (data.success) {
                const detail = Object.entries(data.results as Record<string, string>)
                    .map(([k, v]) => `${k}: ${v}`)
                    .join(", ");
                setMessage(`복원 완료 (${detail})`);
                setMsgType("success");
            } else {
                setMessage(`오류: ${data.error}`);
                setMsgType("error");
            }
        } catch {
            setMessage("파일 파싱 오류");
            setMsgType("error");
        } finally {
            setRestoring(false);
            e.target.value = "";
        }
    }

    async function handleSeedRestore() {
        if (!confirm("seed-data.ts 에 저장된 프로그램 데이터를 복원하시겠습니까?")) return;
        setSeeding(true);
        setMessage(null);
        try {
            const res = await fetch("/api/admin/seed", { method: "POST" });
            const data = await res.json();
            if (data.success) {
                const detail = Object.entries(data.results as Record<string, string>)
                    .map(([k, v]) => `${k}: ${v}`)
                    .join(" / ");
                setMessage(`씨드 복원: ${detail}`);
                setMsgType("success");
            } else {
                setMessage(`씨드 오류: ${data.error}`);
                setMsgType("error");
            }
        } catch {
            setMessage("씨드 복원 실패");
            setMsgType("error");
        } finally {
            setSeeding(false);
        }
    }

    return (
        <div className="px-4 py-2 space-y-2">
            <button
                onClick={handleDownload}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-gray-300 hover:bg-white/10 hover:text-white transition-colors text-left"
            >
                <span className="text-xl">💾</span>
                <span>DB 백업 다운로드</span>
            </button>
            <label className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-left cursor-pointer ${restoring ? "opacity-50" : "text-gray-300 hover:bg-white/10 hover:text-white"}`}>
                <span className="text-xl">📂</span>
                <span>{restoring ? "복원 중..." : "백업으로 복원"}</span>
                <input type="file" accept=".json" className="hidden" onChange={handleRestore} disabled={restoring} />
            </label>
            <button
                onClick={handleSeedRestore}
                disabled={seeding}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-left ${seeding ? "opacity-50" : "text-gray-300 hover:bg-white/10 hover:text-white"}`}
            >
                <span className="text-xl">🌱</span>
                <span>{seeding ? "복원 중..." : "시드 데이터 복원"}</span>
            </button>
            {message && (
                <p className={`text-xs px-4 py-1 break-all ${msgType === "success" ? "text-green-400" : "text-red-400"}`}>{message}</p>
            )}
        </div>
    );
}

type CloudFile = { filename: string; size: number; createdAt: string | null };

function CloudBackupPanel() {
    const [open, setOpen] = useState(false);
    const [files, setFiles] = useState<CloudFile[]>([]);
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<string | null>(null);
    const [statusType, setStatusType] = useState<"ok" | "err">("ok");

    async function load() {
        setLoading(true);
        try {
            const res = await fetch("/api/admin/cloud-backups");
            const data = await res.json();
            setFiles(data.files ?? []);
        } catch {
            setFiles([]);
        } finally {
            setLoading(false);
        }
    }

    async function handleNow() {
        setLoading(true);
        setStatus(null);
        try {
            const res = await fetch("/api/cron/backup");
            const data = await res.json();
            if (data.success) {
                setStatus(`저장됨: ${data.filename}`);
                setStatusType("ok");
                await load();
            } else {
                setStatus(`오류: ${data.error}`);
                setStatusType("err");
            }
        } catch (e) {
            setStatus(`실패: ${e}`);
            setStatusType("err");
        } finally {
            setLoading(false);
        }
    }

    async function handleRestore(filename: string) {
        if (!confirm(`"${filename}" 스냅샷으로 DB를 복원하시겠습니까?\n현재 데이터에 덮어씁니다.`)) return;
        setLoading(true);
        setStatus(null);
        try {
            const res = await fetch("/api/admin/cloud-backups", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ filename }),
            });
            const data = await res.json();
            if (data.success) {
                const detail = Object.entries(data.results as Record<string, string>)
                    .map(([k, v]) => `${k}:${v}`)
                    .join(" ");
                setStatus(`복원 완료 — ${detail}`);
                setStatusType("ok");
            } else {
                setStatus(`오류: ${data.error}`);
                setStatusType("err");
            }
        } catch (e) {
            setStatus(`실패: ${e}`);
            setStatusType("err");
        } finally {
            setLoading(false);
        }
    }

    async function handleDelete(filename: string) {
        if (!confirm(`"${filename}" 백업 파일을 삭제하시겠습니까?`)) return;
        try {
            await fetch("/api/admin/cloud-backups", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ filename }),
            });
            await load();
        } catch {}
    }

    function fmt(iso: string | null) {
        if (!iso) return "-";
        const d = new Date(iso);
        return d.toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
    }

    function fmtSize(bytes: number) {
        if (!bytes) return "-";
        return bytes < 1024 ? `${bytes}B` : `${(bytes / 1024).toFixed(1)}KB`;
    }

    return (
        <div className="px-4 py-1">
            <button
                onClick={() => { setOpen((o) => !o); if (!open) load(); }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-gray-300 hover:bg-white/10 hover:text-white transition-colors text-left"
            >
                <span className="text-xl">☁️</span>
                <span>클라우드 백업 이력</span>
                <span className="ml-auto text-xs opacity-50">{open ? "▲" : "▼"}</span>
            </button>
            {open && (
                <div className="mt-1 bg-white/5 rounded-lg p-3 space-y-2">
                    <div className="flex gap-2">
                        <button
                            onClick={handleNow}
                            disabled={loading}
                            className="flex-1 text-xs bg-brand-orange-500 hover:bg-brand-orange-600 text-white px-2 py-1.5 rounded font-medium disabled:opacity-50"
                        >
                            {loading ? "처리 중..." : "지금 백업"}
                        </button>
                        <button
                            onClick={load}
                            disabled={loading}
                            className="text-xs text-gray-400 hover:text-white px-2 py-1.5 rounded"
                        >
                            새로고침
                        </button>
                    </div>
                    {status && (
                        <p className={`text-xs break-all ${statusType === "ok" ? "text-green-400" : "text-red-400"}`}>{status}</p>
                    )}
                    {files.length === 0 && !loading && (
                        <p className="text-xs text-gray-500">저장된 백업 없음</p>
                    )}
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                        {files.map((f) => (
                            <div key={f.filename} className="flex items-center justify-between gap-1 text-xs text-gray-300 bg-white/5 px-2 py-1.5 rounded">
                                <div className="min-w-0">
                                    <div className="font-mono truncate">{fmt(f.createdAt)}</div>
                                    <div className="text-gray-500">{fmtSize(f.size)}</div>
                                </div>
                                <div className="flex gap-1 flex-shrink-0">
                                    <button
                                        onClick={() => handleRestore(f.filename)}
                                        className="px-2 py-0.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs"
                                    >
                                        복원
                                    </button>
                                    <button
                                        onClick={() => handleDelete(f.filename)}
                                        className="px-2 py-0.5 bg-red-700 hover:bg-red-800 text-white rounded text-xs"
                                    >
                                        삭제
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                    <p className="text-xs text-gray-600">매일 자정 자동 저장 · 30일 보관</p>
                </div>
            )}
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
