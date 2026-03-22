import { Users, BookOpen, UserCheck, Layers, Database, CloudOff, TrendingUp, TrendingDown, Minus, AlertTriangle, MessageSquare, Clock, CalendarCheck, UserPlus } from "lucide-react";
import { Suspense } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { prisma } from "@/lib/prisma";
import { getDashboardStats, getDashboardExtendedStats, getRecentPendingRequests, getPendingRequestCount } from "@/lib/queries";
import Link from "next/link";

// 30초 캐시: 아무도 수정 안 할 때 캐시 유지, Server Action 호출 시 즉시 무효화
export const revalidate = 30;

// DB 연결 상태만 확인 (빠름, 보통 수십ms)
async function getDbStatus() {
    try {
        await prisma.$queryRaw`SELECT 1`;
        return true;
    } catch {
        return false;
    }
}

// Supabase Storage 백업 목록 조회 (느림, 500ms~2초 소요되는 외부 네트워크 호출)
async function getBackupStatus() {
    try {
        const supabase = createAdminClient();
        const { data: allFiles } = await supabase.storage.from("backups").list("", {
            limit: 50,
            sortBy: { column: "created_at", order: "desc" },
        });
        const lastBackupAt = allFiles?.[0]?.created_at ? new Date(allFiles[0].created_at) : null;
        const backupCount = allFiles?.length ?? 0;
        return { lastBackupAt, backupCount };
    } catch {
        return { lastBackupAt: null as Date | null, backupCount: 0 };
    }
}

function formatKRW(n: number): string {
    if (n >= 10000) return `${(n / 10000).toFixed(n % 10000 === 0 ? 0 : 1)}만원`;
    return n.toLocaleString("ko-KR") + "원";
}

// 백업 상태 표시 - Suspense 안에서 비동기로 로딩되는 서버 컴포넌트
// Supabase Storage 호출이 느리므로 DB 상태와 분리하여 독립적으로 로딩
async function BackupStatusSection() {
    const { lastBackupAt, backupCount } = await getBackupStatus();
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
        <>
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
        </>
    );
}

// 시스템 상태 카드 - DB 상태는 즉시 표시, 백업 상태는 Suspense로 비동기 로딩
async function SystemStatusCard() {
    const dbOk = await getDbStatus();

    return (
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
            <h3 className="font-bold text-gray-900 mb-3">시스템 상태</h3>
            <div className="space-y-2.5">
                {/* DB 상태: 빠르게 표시 */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Database size={14} className="text-gray-400" />
                        <span>데이터베이스</span>
                    </div>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${dbOk ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                        {dbOk ? "정상" : "오류"}
                    </span>
                </div>
                {/* 백업 상태: 느린 외부 호출이므로 Suspense로 비동기 로딩 */}
                <Suspense fallback={
                    <div className="flex items-center justify-between animate-pulse">
                        <div className="flex items-center gap-2 text-sm text-gray-400">
                            <span className="text-sm">☁️</span>
                            <span>백업 확인 중...</span>
                        </div>
                        <span className="bg-gray-200 h-5 w-16 rounded-full" />
                    </div>
                }>
                    <BackupStatusSection />
                </Suspense>
            </div>
        </div>
    );
}

// 오늘의 수업 조회 (요일 기준)
async function getTodayClasses() {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const today = days[new Date().getDay()];
    try {
        const rows = await prisma.$queryRawUnsafe<any[]>(
            `SELECT c.id, c.name, c."startTime", c."endTime", c.capacity,
                    p.name AS program_name,
                    (SELECT COUNT(*)::int FROM "Enrollment" e WHERE e."classId" = c.id AND e.status = 'ACTIVE') AS enrolled
             FROM "Class" c
             LEFT JOIN "Program" p ON c."programId" = p.id
             WHERE c."dayOfWeek" = $1
             ORDER BY c."startTime" ASC`,
            today
        );
        return rows.map((r: any) => ({
            id: r.id, name: r.name,
            startTime: r.startTime ?? r.starttime,
            endTime: r.endTime ?? r.endtime,
            capacity: Number(r.capacity ?? 0),
            programName: r.program_name,
            enrolled: Number(r.enrolled ?? 0),
        }));
    } catch { return []; }
}

// 최근 7일 신규 원생
async function getRecentStudents() {
    try {
        const rows = await prisma.$queryRawUnsafe<any[]>(
            `SELECT s.id, s.name, s."createdAt", u.name AS parent_name
             FROM "Student" s
             LEFT JOIN "User" u ON s."parentId" = u.id
             WHERE s."createdAt" >= NOW() - INTERVAL '7 days'
             ORDER BY s."createdAt" DESC
             LIMIT 5`
        );
        return rows.map((r: any) => ({
            id: r.id, name: r.name,
            createdAt: r.createdAt ?? r.createdat,
            parentName: r.parent_name,
        }));
    } catch { return []; }
}

// 느린 쿼리(ext, todayClasses, recentStudents) 로딩 중 보여줄 스켈레톤
function SlowSectionSkeleton() {
    return (
        <>
            {/* KPI Cards Row 2 스켈레톤 */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 animate-pulse">
                        <div className="h-3 bg-gray-200 rounded w-20 mb-2" />
                        <div className="h-7 bg-gray-200 rounded w-24" />
                    </div>
                ))}
            </div>
            {/* Charts 스켈레톤 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {[...Array(2)].map((_, i) => (
                    <div key={i} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 animate-pulse">
                        <div className="h-4 bg-gray-200 rounded w-40 mb-4" />
                        <div className="h-40 bg-gray-100 rounded" />
                    </div>
                ))}
            </div>
            {/* 오늘의 수업 + 신규 원생 스켈레톤 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {[...Array(2)].map((_, i) => (
                    <div key={i} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 animate-pulse">
                        <div className="h-4 bg-gray-200 rounded w-32 mb-4" />
                        <div className="space-y-3">
                            {[...Array(3)].map((_, j) => (
                                <div key={j} className="h-10 bg-gray-100 rounded" />
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </>
    );
}

// 느린 쿼리(경영 통계, 오늘 수업, 신규 원생)를 별도 async 서버 컴포넌트로 분리
// Suspense 경계 안에서 로딩되므로 빠른 쿼리 결과가 먼저 화면에 표시됨
async function SlowDashboardSection({ pendingRequests }: { pendingRequests: any[] }) {
    const [ext, todayClasses, recentStudents] = await Promise.all([
        getDashboardExtendedStats(),
        getTodayClasses(),
        getRecentStudents(),
    ]);

    const revDiff = ext.lastMonthRevenue > 0
        ? Math.round(((ext.thisMonthRevenue - ext.lastMonthRevenue) / ext.lastMonthRevenue) * 100)
        : ext.thisMonthRevenue > 0 ? 100 : 0;

    const maxRevenue = Math.max(...ext.monthlyRevenue.map(m => m.amount), 1);
    const maxAttRate = 100;
    const dayLabels: Record<string, string> = { Sun: "일", Mon: "월", Tue: "화", Wed: "수", Thu: "목", Fri: "금", Sat: "토" };
    const todayLabel = dayLabels[["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][new Date().getDay()]] + "요일";

    return (
        <>
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

            {/* 오늘의 수업 + 신규 원생 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 오늘의 수업 */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <CalendarCheck size={18} className="text-brand-orange-500" />
                        오늘의 수업 ({todayLabel})
                    </h3>
                    {todayClasses.length === 0 ? (
                        <p className="text-sm text-gray-400">오늘은 수업이 없습니다</p>
                    ) : (
                        <div className="space-y-2">
                            {todayClasses.map(c => (
                                <div key={c.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                                    <div>
                                        <p className="text-sm font-bold text-gray-900">{c.name}</p>
                                        <p className="text-xs text-gray-500">{c.programName} &middot; {c.startTime}~{c.endTime}</p>
                                    </div>
                                    <div className="text-right">
                                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                            c.enrolled >= c.capacity ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
                                        }`}>
                                            {c.enrolled}/{c.capacity}명
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* 신규 원생 + 최근 요청 */}
                <div className="space-y-6">
                    {/* 신규 원생 */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <UserPlus size={18} className="text-emerald-500" />
                            신규 원생 (최근 7일)
                        </h3>
                        {recentStudents.length === 0 ? (
                            <p className="text-sm text-gray-400">최근 등록된 원생이 없습니다</p>
                        ) : (
                            <div className="space-y-2">
                                {recentStudents.map(s => (
                                    <Link key={s.id} href={`/admin/students/${s.id}`}
                                        className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0 hover:bg-gray-50 rounded-lg px-2 transition">
                                        <div>
                                            <p className="text-sm font-bold text-gray-900">{s.name}</p>
                                            <p className="text-xs text-gray-500">학부모: {s.parentName}</p>
                                        </div>
                                        <span className="text-xs text-gray-400">
                                            {new Date(s.createdAt).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}
                                        </span>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* 최근 요청 요약 */}
                    {pendingRequests.length > 0 && (
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-yellow-200">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                                    <Clock size={18} className="text-yellow-500" />
                                    대기중 요청
                                </h3>
                                <Link href="/admin/requests" className="text-xs text-brand-orange-500 hover:underline">전체보기</Link>
                            </div>
                            <div className="space-y-2">
                                {pendingRequests.map(r => (
                                    <Link key={r.id} href="/admin/requests"
                                        className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0 hover:bg-yellow-50 rounded-lg px-2 transition">
                                        <div>
                                            <p className="text-sm font-bold text-gray-900">{r.title}</p>
                                            <p className="text-xs text-gray-500">{r.parentName} ({r.studentName})</p>
                                        </div>
                                        <span className="text-xs text-gray-400">
                                            {new Date(r.createdAt).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}
                                        </span>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}

export default async function AdminDashboard() {
    // 빠른 쿼리만 먼저 실행 (stats, pendingRequests, pendingCount)
    // 느린 쿼리(ext, todayClasses, recentStudents)는 Suspense 안에서 별도 로딩
    const [stats, pendingRequests, pendingCount] = await Promise.all([
        getDashboardStats(),
        getRecentPendingRequests(),
        getPendingRequestCount(),
    ]);

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            <div>
                <h1 className="text-2xl font-extrabold text-gray-900 mb-1">경영 대시보드</h1>
                <p className="text-gray-500 text-sm">스티즈농구교실 다산점의 운영 현황입니다.</p>
            </div>

            {/* 학부모 요청 알림 배너 - 빠른 쿼리로 즉시 표시 */}
            {pendingCount > 0 && (
                <Link href="/admin/requests"
                    className="flex items-center gap-3 bg-yellow-50 border border-yellow-200 rounded-2xl p-4 hover:bg-yellow-100 transition shadow-sm">
                    <div className="bg-yellow-400 text-white p-2 rounded-full">
                        <MessageSquare size={20} />
                    </div>
                    <div className="flex-1">
                        <p className="font-bold text-yellow-800">
                            미처리 요청 {pendingCount}건
                        </p>
                        <p className="text-xs text-yellow-600 mt-0.5">
                            {pendingRequests.slice(0, 2).map(r => `${r.studentName} - ${r.title}`).join(" / ")}
                            {pendingCount > 2 && ` 외 ${pendingCount - 2}건`}
                        </p>
                    </div>
                    <span className="text-yellow-600 text-sm font-bold">처리하기 &rarr;</span>
                </Link>
            )}

            {/* KPI Cards - Row 1: 기본 통계 (빠른 쿼리로 즉시 표시) */}
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

            {/* 느린 쿼리 섹션: 경영 통계 + 차트 + 오늘 수업 + 신규 원생 */}
            {/* Suspense로 감싸서 위의 빠른 섹션이 먼저 표시되고, 이 부분은 스켈레톤 후 로딩 */}
            <Suspense fallback={<SlowSectionSkeleton />}>
                <SlowDashboardSection pendingRequests={pendingRequests} />
            </Suspense>

            {/* Bottom Row: 빠른 관리 + 시스템 상태 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 프로그램별 원생 분포는 SlowDashboardSection의 ext가 필요하므로 그 안에서 렌더 */}
                {/* 여기서는 빠른 관리 + 시스템 상태만 즉시 표시 */}

                {/* 빈 슬롯 (프로그램별 원생은 SlowBottomSection에서 처리) */}
                <Suspense fallback={
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 animate-pulse">
                        <div className="h-4 bg-gray-200 rounded w-32 mb-4" />
                        <div className="space-y-3">
                            {[...Array(3)].map((_, i) => <div key={i} className="h-6 bg-gray-100 rounded" />)}
                        </div>
                    </div>
                }>
                    <ProgramStudentsCard />
                </Suspense>

                {/* 빠른 관리 */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <h3 className="font-bold text-gray-900 mb-4">빠른 관리</h3>
                    <div className="grid grid-cols-2 gap-3">
                        <QuickLink title="출결 관리" href="/admin/attendance" color="orange" />
                        <QuickLink title="수납/결제" href="/admin/finance" color="blue" />
                        <QuickLink title="요청 관리" href="/admin/requests" color="orange" />
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

// 프로그램별 원생 분포 카드 - ext 데이터가 필요하므로 별도 async 서버 컴포넌트
async function ProgramStudentsCard() {
    const ext = await getDashboardExtendedStats();
    return (
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
