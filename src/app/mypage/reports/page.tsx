import { createClient } from "@/lib/supabase/server";
import { getStudentReports } from "@/lib/queries";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

// 학부모 리포트 목록은 실시간 데이터 필요 (자녀 보안 체크)
export const dynamic = "force-dynamic";

// 요일 한글 변환
const DAY_LABELS: Record<string, string> = {
    Mon: "월", Tue: "화", Wed: "수", Thu: "목", Fri: "금", Sat: "토", Sun: "일",
};

export default async function ParentReportsPage() {
    // 로그인 확인
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="text-5xl mb-4">🔒</div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">로그인이 필요합니다</h2>
                <p className="text-gray-500 mb-6">수업 리포트는 학부모 계정으로 로그인 후 확인할 수 있습니다.</p>
                <Link
                    href="/login"
                    className="bg-brand-orange-500 text-white font-bold px-6 py-3 rounded-xl hover:bg-orange-600 transition"
                >
                    로그인하기
                </Link>
            </div>
        );
    }

    // DB에서 학부모 ID 조회 (이메일 기반)
    const userRows = await prisma.$queryRawUnsafe<any[]>(
        `SELECT id FROM "User" WHERE email = $1 LIMIT 1`,
        user.email
    );
    const parentId = userRows[0]?.id;
    if (!parentId) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="text-5xl mb-4">👋</div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">등록된 정보가 없습니다</h2>
                <p className="text-gray-400 text-sm">학원에 등록 후 이용할 수 있습니다.</p>
            </div>
        );
    }

    // 내 자녀의 발행된 리포트만 조회 (보안: parentId 필터링)
    const reports = await getStudentReports(parentId);

    return (
        <div>
            <div className="mb-6">
                <Link
                    href="/mypage"
                    className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-2"
                >
                    <span className="material-symbols-outlined text-sm">arrow_back</span>
                    마이페이지
                </Link>
                <h1 className="text-2xl font-extrabold text-gray-900">수업 리포트</h1>
                <p className="text-gray-500 text-sm mt-1">코치가 작성한 수업 리포트를 확인하세요.</p>
            </div>

            {reports.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
                    아직 발행된 수업 리포트가 없습니다.
                </div>
            ) : (
                <div className="space-y-3">
                    {reports.map((r) => {
                        const dateStr = new Date(r.date).toLocaleDateString("ko-KR", {
                            year: "numeric", month: "short", day: "numeric", weekday: "short",
                        });
                        return (
                            <Link
                                key={r.sessionId}
                                href={`/mypage/reports/${r.sessionId}`}
                                className="block bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow"
                            >
                                <div className="flex items-start justify-between">
                                    <div>
                                        <p className="font-bold text-gray-900">{r.topic || "수업 리포트"}</p>
                                        <p className="text-sm text-gray-500 mt-0.5">
                                            {dateStr} | {r.className} ({DAY_LABELS[r.dayOfWeek] || r.dayOfWeek} {r.startTime}~{r.endTime})
                                        </p>
                                        {r.coachName && (
                                            <p className="text-xs text-gray-400 mt-1">담당: {r.coachName}</p>
                                        )}
                                    </div>
                                    <span className="material-symbols-outlined text-gray-300">chevron_right</span>
                                </div>
                            </Link>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
