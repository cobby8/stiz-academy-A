import Link from "next/link";
import { getSessionsForReportList } from "@/lib/queries";

// 관리자 리포트 목록은 30초 캐시 (출결 기록 후 자동 갱신)
export const revalidate = 30;

// 요일 한글 변환
const DAY_LABELS: Record<string, string> = {
    Mon: "월", Tue: "화", Wed: "수", Thu: "목", Fri: "금", Sat: "토", Sun: "일",
};

export default async function AdminReportListPage() {
    const sessions = await getSessionsForReportList(50);

    return (
        <div className="max-w-5xl mx-auto">
            <div className="mb-6">
                <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">수업 리포트 관리</h1>
                <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                    출결이 기록된 수업의 리포트를 작성하고 학부모에게 발행할 수 있습니다.
                </p>
            </div>

            {sessions.length === 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center text-gray-400">
                    출결이 기록된 수업이 없습니다. 먼저 출결을 기록해주세요.
                </div>
            ) : (
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                                <th className="text-left px-5 py-3 font-bold text-gray-700 dark:text-gray-200">날짜</th>
                                <th className="text-left px-5 py-3 font-bold text-gray-700 dark:text-gray-200">반</th>
                                <th className="text-left px-5 py-3 font-bold text-gray-700 dark:text-gray-200">주제</th>
                                <th className="text-center px-5 py-3 font-bold text-gray-700 dark:text-gray-200">출석</th>
                                <th className="text-center px-5 py-3 font-bold text-gray-700 dark:text-gray-200">상태</th>
                                <th className="text-center px-5 py-3 font-bold text-gray-700 dark:text-gray-200">관리</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {sessions.map((s) => {
                                const dateStr = new Date(s.date).toLocaleDateString("ko-KR", {
                                    year: "numeric", month: "short", day: "numeric",
                                });
                                return (
                                    <tr key={s.id} className="hover:bg-gray-50 dark:bg-gray-900 transition-colors">
                                        <td className="px-5 py-3 text-gray-900 dark:text-white font-medium">{dateStr}</td>
                                        <td className="px-5 py-3 text-gray-700 dark:text-gray-200">
                                            {s.className}
                                            <span className="text-gray-400 text-xs ml-1">
                                                ({DAY_LABELS[s.dayOfWeek] || s.dayOfWeek} {s.startTime}~{s.endTime})
                                            </span>
                                        </td>
                                        <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                                            {s.topic || <span className="text-gray-300">미작성</span>}
                                        </td>
                                        <td className="px-5 py-3 text-center text-gray-600 dark:text-gray-300">{s.attendanceCount}명</td>
                                        <td className="px-5 py-3 text-center">
                                            {s.published ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700">
                                                    <span className="material-symbols-outlined text-sm">check_circle</span>
                                                    발행됨
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                                                    <span className="material-symbols-outlined text-sm">edit_note</span>
                                                    미발행
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-5 py-3 text-center">
                                            <Link
                                                href={`/admin/attendance/report/${s.id}`}
                                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-brand-orange-500 dark:bg-brand-neon-lime dark:text-brand-navy-900 text-white hover:bg-orange-600 transition"
                                            >
                                                <span className="material-symbols-outlined text-sm">edit</span>
                                                편집
                                            </Link>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
