import { requireAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  kind: string;
  sourceText: string;
  status: string;
  studentName: string | null;
  parentName: string | null;
  createdAt: Date;
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "학부모 확인 중",
  NEEDS_DETAILS: "추가 확인 필요",
  SUBMITTED: "신규 접수",
  APPLIED: "자동 반영 완료",
  HELD: "관리자 확인 필요",
  FAILED: "처리 실패",
  CANCELED: "학부모 취소",
};

export default async function KakaoRequestsPage() {
  await requireAdmin();
  const rows = await prisma.$queryRawUnsafe<Row[]>(
    `SELECT r.id,r.kind,r."sourceText",r.status,r."createdAt",
            s.name AS "studentName",u.name AS "parentName"
       FROM "KakaoParentIntake" r
       JOIN "KakaoParentIdentity" i ON i.id=r."identityId"
       LEFT JOIN "Student" s ON s.id=r."studentId"
       LEFT JOIN "User" u ON u.id=i."parentUserId"
      ORDER BY CASE WHEN r.status IN ('SUBMITTED','HELD','FAILED') THEN 0 ELSE 1 END,
               r."createdAt" DESC
      LIMIT 200`,
  );

  return (
    <main className="space-y-5">
      <div>
        <p className="text-sm font-bold text-yellow-600">학부모 채널</p>
        <h1 className="mt-1 text-2xl font-black text-gray-950 dark:text-white">카카오 접수함</h1>
        <p className="mt-2 text-sm text-gray-500">학부모가 최종 확인한 요청과 추가 확인이 필요한 대화를 함께 확인합니다.</p>
      </div>
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        {rows.length === 0 ? (
          <p className="p-8 text-center text-sm text-gray-500">아직 접수된 카카오 요청이 없습니다.</p>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {rows.map((row) => (
              <article key={row.id} className="p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-yellow-100 px-2.5 py-1 text-xs font-black text-yellow-800">{STATUS_LABEL[row.status] ?? row.status}</span>
                  <strong className="text-sm text-gray-950 dark:text-white">{row.studentName ?? "학생 확인 필요"}</strong>
                  <span className="text-xs text-gray-400">{row.kind}</span>
                  <time className="ml-auto text-xs text-gray-400">{new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "short", timeStyle: "short" }).format(row.createdAt)}</time>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-gray-700 dark:text-gray-200">{row.sourceText}</p>
                <p className="mt-2 text-xs text-gray-400">보호자: {row.parentName ?? "미확인"}</p>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
