import { Users, BookOpen, UserCheck, Layers, Database, CloudOff, TrendingUp, TrendingDown, Minus, AlertTriangle } from "lucide-react";
import { Suspense } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { prisma } from "@/lib/prisma";
import { getDashboardStats, getDashboardExtendedStats } from "@/lib/queries";
import Link from "next/link";

export const dynamic = "force-dynamic";

async function getSystemStatus() {
    const results = { dbOk: false, lastBackupAt: null as Date | null, backupCount: 0 };
    try {
        await prisma.$queryRaw`SELECT 1`;
        results.dbOk = true;
    } catch {}
    try {
        const supabase = createAdminClient();
        const { data: allFiles } = await supabase.storage.from("backups").list("", {
            limit: 50,
            sortBy: { column: "created_at", order: "desc" },
        });
        if (allFiles?.[0]?.created_at) {
            results.lastBackupAt = new Date(allFiles[0].created_at);
        }
        results.backupCount = allFiles?.length ?? 0;
    } catch {}
    return results;
}

function formatKRW(n: number): string {
    if (n >= 10000) return `${(n / 10000).toFixed(n % 10000 === 0 ? 0 : 1)}만원`;
    return n.toLocaleString("ko-KR") + "원";
}

async function SystemStatusCard() {
    const { dbOk, lastBackupAt, backupCount } = await getSystemStatus();
    const now = new Date();
    const backupAgeMs = lastBackupAt ? now.getTime() - lastBackupAt.getTime() : Infinity;
    const backupAgeDays = Math.floor(backupAgeMs / (1000 * 60 * 60 * 24));
    const backupAgeHours = Math.floor(backupAgeMs / (1000 * 60 * 60));
    const backupWarn = backupAgeMs > 2 * 24 * 60 * 60 * 1000;
    const backupDanger = backupAgeMs > 7 * 24 * 60 * 60 * 1000;

    function backupLabel() {
        if (!lastBackupAt) return "백업 없음";
        if (backupAgeHours < 1) return "방금 전";
        if (backupAgeHours < 24) return `${backupAgeHours}시간 전`;
        return `${backupAgeDays}일 전`;
    }

    return (
        <div className={`bg-white p-5 rounded-2xl shadow-sm border ${backupDanger ? "border-red-300" : backupWarn ? "border-yellow-300" : "border-gray-100"}`}>
            <h3 className="font-bold text-gray-900 mb-3">시스템 상태</h3>
            <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Database size={14} className="text-gray-400" />
                        <span>데이터베이스</span>
                    </div>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${dbOk ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                        {dbOk ? "정상" : "오류"}
                    </span>
                </div>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                        {backupWarn ? <CloudOff size={14} className={backupDanger ? "text-red-500" : "text-yellow-500"} /> : <span className="text-sm">☁️</span>}
                        <span>마지막 백업</span>
                    </div>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${backupDanger ? "bg-red-100 text-red-700" : backupWarn ? "bg-yellow-100 text-yellow-700" : "bg-green-100 text-green-700"}`}>
                        {backupLabel()}
                    </span>
                </div>
                {backupCount > 0 && (
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">저장된 백업</span>
                        <span className="text-xs text-gray-500">{backupCount}개</span>
                    </div>
                )}
                {backupDanger && (
                    <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
                        7일 이상 백업이 없습니다. 사이드바에서 즉시 저장하세요.
                    </p>
                )}
            </div>
        </div>
    );
}

export default async function AdminDashboard() {
    const [stats, ext] = await Promise.all([
        getDashboardStats(),
        getDashboardExtendedStats(),
    ]);

    const revDiff = ext.lastMonthRevenue > 0
        ? Math.round(((ext.thisMonthRevenue - ext.lastMonthRevenue) / ext.lastMonthRevenue) * 100)
        : ext.thisMonthRevenue > 0 ? 100 : 0;

    const maxRevenue = Math.max(...ext.monthlyRevenue.map(m => m.amount), 1);
    const maxAttRate = 100;

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            <div>
                <h1 className="text-2xl font-extrabold text-gray-900 mb-1">경영 대시보드</h1>
                <p className="text-gray-500 text-sm">스티즈농구교실 다산점의 운영 현황입니다.</p>
            </div>

            {/* KPI Cards - Row 1: 기본 */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard title="등록 원생" value={`${stats.studentCount}명`}
                    icon={<Users className="w-5 h-5 text-blue-500" />} href="/admin/students" />
                <StatCard title="운영 프로그램" value={`${stats.programCount}개`}
                    icon={<BookOpen className="w-5 h-5 text-brand-orange-500" />} href="/admin/programs" />
                <StatCard title="코치/강사진" value={`${stats.coachCount}명`}
                    icon={<UserCheck className="w-5 h-5 text-emerald-500" />} href="/admin/coaches" />
                <StatCard title="개설 반" value={`${stats.classCount}개`}
                    icon={<Layers className="w-5 h-5 text-purple-500" />} href="/admin/classes" />
            </div>

            {/* KPI Cards - Row 2: 경영 */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                    <p className="text-xs font-medium text-gray-500 mb-1">이번 달 매출</p>
                    <h3 className="text-2xl font-extrabold text-gray-900">{formatKRW(ext.thisMonthRevenue)}</h3>
                    {ext.lastMonthRevenue > 0 && (
                        <div className={`flex items-center gap-1 mt-1 text-xs font-medium ${revDiff >= 0 ? "text-green-600" : "text-red-600"}`}>
                            {revDiff > 0 ? <TrendingUp size={14} /> : revDiff < 0 ? <TrendingDown size={14} /> : <Minus size={14} />}
                            전월 대비 {revDiff > 0 ? "+" : ""}{revDiff}%
                        </div>
                    )}
                </div>
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                    <p className="text-xs font-medium text-gray-500 mb-1">이번 달 출석률</p>
                    <h3 className="text-2xl font-extrabold text-gray-900">{ext.attendanceRate}%</h3>
                    <p className="text-xs text-gray-400 mt-1">전체 수업 기준</p>
                </div>
                <Link href="/admin/finance" className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 hover:border-red-200 transition">
                    <p className="text-xs font-medium text-gray-500 mb-1">미납 현황</p>
                    <h3 className={`text-2xl font-extrabold ${ext.unpaidCount > 0 ? "text-red-600" : "text-gray-900"}`}>
                        {ext.unpaidCount}건
                    </h3>
                    {ext.unpaidAmount > 0 && (
                        <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                            <AlertTriangle size={12} /> {formatKRW(ext.unpaidAmount)}
                        </p>
                    )}
                </Link>
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                    <p className="text-xs font-medium text-gray-500 mb-1">전월 매출</p>
                    <h3 className="text-2xl font-extrabold text-gray-900">{formatKRW(ext.lastMonthRevenue)}</h3>
                </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 매출 추이 차트 */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <h3 className="font-bold text-gray-900 mb-4">매출 추이 (최근 6개월)</h3>
                    <div className="flex items-end gap-2 h-40">
                        {ext.monthlyRevenue.map((m, i) => (
                            <div key={i} className="flex-1 flex flex-col items-center gap-1">
                                <span className="text-xs text-gray-500 font-medium">
                                    {m.amount > 0 ? formatKRW(m.amount) : ""}
                                </span>
                                <div className="w-full bg-gray-100 rounded-t-lg relative" style={{ height: "120px" }}>
                                    <div
                                        className="absolute bottom-0 left-0 right-0 bg-brand-orange-500 rounded-t-lg transition-all duration-500"
                                        style={{ height: `${maxRevenue > 0 ? (m.amount / maxRevenue) * 100 : 0}%` }}
                                    />
                                </div>
                                <span className="text-xs text-gray-400">{m.month}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 출석률 추이 차트 */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <h3 className="font-bold text-gray-900 mb-4">출석률 추이 (최근 6개월)</h3>
                    <div className="flex items-end gap-2 h-40">
                        {ext.monthlyAttendance.map((m, i) => (
                            <div key={i} className="flex-1 flex flex-col items-center gap-1">
                                <span className="text-xs text-gray-500 font-medium">
                                    {m.rate > 0 ? `${m.rate}%` : ""}
                                </span>
                                <div className="w-full bg-gray-100 rounded-t-lg relative" style={{ height: "120px" }}>
                                    <div
                                        className="absolute bottom-0 left-0 right-0 bg-emerald-500 rounded-t-lg transition-all duration-500"
                                        style={{ height: `${(m.rate / maxAttRate) * 100}%` }}
                                    />
                                </div>
                                <span className="text-xs text-gray-400">{m.month}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Bottom Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 프로그램별 원생 분포 */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <h3 className="font-bold text-gray-900 mb-4">프로그램별 원생 수</h3>
                    {ext.programStudents.length === 0 ? (
                        <p className="text-sm text-gray-400">프로그램을 추가하세요</p>
                    ) : (
                        <div className="space-y-3">
                            {ext.programStudents.map((p, i) => {
                                const maxCnt = Math.max(...ext.programStudents.map(x => x.count), 1);
                                return (
                                    <div key={i}>
                                        <div className="flex justify-between text-sm mb-1">
                                            <span className="text-gray-700 font-medium truncate">{p.name}</span>
                                            <span className="text-gray-500 font-bold">{p.count}명</span>
                                        </div>
                                        <div className="w-full bg-gray-100 rounded-full h-2">
                                            <div
                                                className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                                                style={{ width: `${(p.count / maxCnt) * 100}%` }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* 빠른 관리 */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <h3 className="font-bold text-gray-900 mb-4">빠른 관리</h3>
                    <div className="grid grid-cols-2 gap-3">
                        <QuickLink title="출결 관리" href="/admin/attendance" color="orange" />
                        <QuickLink title="수납/결제" href="/admin/finance" color="blue" />
                        <QuickLink title="갤러리" href="/admin/gallery" color="green" />
                        <QuickLink title="공지사항" href="/admin/notices" color="purple" />
                        <QuickLink title="시간표" href="/admin/schedule" color="orange" />
                        <QuickLink title="설정" href="/admin/settings" color="blue" />
                    </div>
                </div>

                {/* 시스템 상태 */}
                <Suspense fallback={
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                        <h3 className="font-bold text-gray-900 mb-3">시스템 상태</h3>
                        <p className="text-sm text-gray-400">확인 중...</p>
                    </div>
                }>
                    <SystemStatusCard />
                </Suspense>
            </div>
        </div>
    );
}

function StatCard({ title, value, icon, href }: {
    title: string; value: string; icon: React.ReactNode; href?: string;
}) {
    const content = (
        <div className={`bg-white p-5 rounded-2xl shadow-sm border border-gray-100 ${href ? "hover:border-brand-orange-300 transition-colors cursor-pointer" : ""}`}>
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">{title}</p>
                    <h3 className="text-2xl font-extrabold text-gray-900">{value}</h3>
                </div>
                <div className="p-2.5 bg-gray-50 rounded-xl">{icon}</div>
            </div>
        </div>
    );
    if (href) return <Link href={href}>{content}</Link>;
    return content;
}

function QuickLink({ title, href, color }: { title: string; href: string; color: string }) {
    const colorMap: Record<string, string> = {
        orange: "bg-orange-50 border-orange-200 hover:border-brand-orange-400",
        blue: "bg-blue-50 border-blue-200 hover:border-blue-400",
        green: "bg-green-50 border-green-200 hover:border-green-400",
        purple: "bg-purple-50 border-purple-200 hover:border-purple-400",
    };
    return (
        <Link href={href} className={`p-3 rounded-xl border transition-colors text-center ${colorMap[color] || colorMap.orange}`}>
            <span className="font-bold text-sm text-gray-900">{title}</span>
        </Link>
    );
}
