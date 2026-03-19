import { Users, BookOpen, UserCheck, Layers, Database, CloudOff } from "lucide-react";
import { Suspense } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { prisma } from "@/lib/prisma";
import { getDashboardStats } from "@/lib/queries";
import Link from "next/link";

export const dynamic = "force-dynamic";

async function getSystemStatus() {
    const results = { dbOk: false, lastBackupAt: null as Date | null, backupCount: 0 };

    // DB 연결 확인
    try {
        await prisma.$queryRaw`SELECT 1`;
        results.dbOk = true;
    } catch {}

    // 마지막 클라우드 백업 시간 (Supabase Storage 파일 목록에서 추출)
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
        <div className={`bg-white p-6 rounded-2xl shadow-sm border ${backupDanger ? "border-red-300" : backupWarn ? "border-yellow-300" : "border-gray-100"}`}>
            <h3 className="font-bold text-gray-900 text-lg mb-4">시스템 상태</h3>
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Database size={15} className="text-gray-400" />
                        <span>데이터베이스</span>
                    </div>
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${dbOk ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                        {dbOk ? "정상" : "연결 오류"}
                    </span>
                </div>

                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                        {backupWarn
                            ? <CloudOff size={15} className={backupDanger ? "text-red-500" : "text-yellow-500"} />
                            : <span className="text-sm">☁️</span>
                        }
                        <span>마지막 자동백업</span>
                    </div>
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${backupDanger ? "bg-red-100 text-red-700" : backupWarn ? "bg-yellow-100 text-yellow-700" : "bg-green-100 text-green-700"}`}>
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
                    <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2 mt-2">
                        ⚠️ 7일 이상 백업이 없습니다. 사이드바에서 &quot;지금 클라우드에 저장&quot;을 실행하세요.
                    </p>
                )}
                {backupWarn && !backupDanger && (
                    <p className="text-xs text-yellow-700 bg-yellow-50 rounded-lg px-3 py-2 mt-2">
                        백업이 {backupAgeDays}일 전입니다. 자동 백업은 매일 자정에 실행됩니다.
                    </p>
                )}
                {!lastBackupAt && (
                    <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2 mt-2">
                        아직 클라우드 백업이 없습니다. 사이드바에서 즉시 저장할 수 있습니다.
                    </p>
                )}
            </div>
        </div>
    );
}

export default async function AdminDashboard() {
    const stats = await getDashboardStats();

    return (
        <div className="max-w-7xl mx-auto space-y-8">
            {/* Welcome Heading */}
            <div>
                <h1 className="text-2xl font-extrabold text-gray-900 mb-2">대시보드</h1>
                <p className="text-gray-500">스티즈농구교실 다산점의 현황입니다.</p>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title="등록 원생 수"
                    value={stats.studentCount > 0 ? `${stats.studentCount}명` : "0명"}
                    sub={stats.studentCount === 0 ? "원생 등록 후 표시됩니다" : undefined}
                    icon={<Users className="w-6 h-6 text-blue-500" />}
                    href="/admin/students"
                />
                <StatCard
                    title="운영 프로그램"
                    value={`${stats.programCount}개`}
                    sub={stats.programCount === 0 ? "프로그램을 추가하세요" : undefined}
                    icon={<BookOpen className="w-6 h-6 text-brand-orange-500" />}
                    href="/admin/programs"
                />
                <StatCard
                    title="코치/강사진"
                    value={`${stats.coachCount}명`}
                    sub={stats.coachCount === 0 ? "코치를 등록하세요" : undefined}
                    icon={<UserCheck className="w-6 h-6 text-emerald-500" />}
                    href="/admin/coaches"
                />
                <StatCard
                    title="개설 반"
                    value={`${stats.classCount}개`}
                    sub={stats.classCount === 0 ? "반을 개설하세요" : undefined}
                    icon={<Layers className="w-6 h-6 text-purple-500" />}
                    href="/admin/classes"
                />
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Quick Links */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 lg:col-span-2">
                    <h3 className="font-bold text-gray-900 text-lg mb-6">빠른 관리</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <QuickLink
                            title="시간표 관리"
                            description="수업 시간표 확인 및 수정"
                            href="/admin/schedule"
                            color="orange"
                        />
                        <QuickLink
                            title="프로그램 관리"
                            description="프로그램 추가/수정/삭제"
                            href="/admin/programs"
                            color="blue"
                        />
                        <QuickLink
                            title="코치 관리"
                            description="코치진 정보 관리"
                            href="/admin/coaches"
                            color="green"
                        />
                        <QuickLink
                            title="학원 설정"
                            description="학원 소개, 연락처, 폰트 등"
                            href="/admin/settings"
                            color="purple"
                        />
                    </div>
                </div>

                {/* Right column: system status */}
                <div className="space-y-6">
                    <Suspense fallback={
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                            <h3 className="font-bold text-gray-900 text-lg mb-4">시스템 상태</h3>
                            <p className="text-sm text-gray-400">확인 중...</p>
                        </div>
                    }>
                        <SystemStatusCard />
                    </Suspense>
                </div>
            </div>
        </div>
    );
}

function StatCard({ title, value, sub, icon, href }: {
    title: string; value: string; sub?: string; icon: React.ReactNode; href?: string;
}) {
    const content = (
        <div className={`bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between ${href ? "hover:border-brand-orange-300 transition-colors cursor-pointer" : ""}`}>
            <div className="flex justify-between items-start mb-4">
                <div>
                    <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
                    <h3 className="text-3xl font-extrabold text-gray-900">{value}</h3>
                </div>
                <div className="p-3 bg-gray-50 rounded-xl">
                    {icon}
                </div>
            </div>
            {sub && (
                <span className="text-sm font-medium text-gray-400">{sub}</span>
            )}
        </div>
    );
    if (href) return <Link href={href}>{content}</Link>;
    return content;
}

const colorMap = {
    orange: "bg-orange-50 border-orange-200 hover:border-brand-orange-400",
    blue: "bg-blue-50 border-blue-200 hover:border-blue-400",
    green: "bg-green-50 border-green-200 hover:border-green-400",
    purple: "bg-purple-50 border-purple-200 hover:border-purple-400",
} as const;

function QuickLink({ title, description, href, color }: {
    title: string; description: string; href: string; color: keyof typeof colorMap;
}) {
    return (
        <Link href={href} className={`p-4 rounded-xl border transition-colors ${colorMap[color]}`}>
            <h4 className="font-bold text-gray-900 mb-1">{title}</h4>
            <p className="text-xs text-gray-500">{description}</p>
        </Link>
    );
}
