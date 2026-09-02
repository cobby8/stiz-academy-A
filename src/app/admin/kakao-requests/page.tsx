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

function isKakaoSchemaNotReady(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? String(error.code) : "";
  const message = "message" in error ? String(error.message) : "";
  return ["42P01", "42703"].includes(code)
    || /KakaoParent(?:Identity|Intake).*(?:does not exist|존재하지)/i.test(message);
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "학부모 확인 중",
  NEEDS_DETAILS: "추가 확인 필요",
  SUBMITTED: "신규 접수",
  PROCESSING: "처리 중",
  APPLIED: "자동 반영 완료",
  HELD: "관리자 확인 필요",
  FAILED: "처리 실패",
  CANCELED: "학부모 취소",
};

export default async function KakaoRequestsPage() {
  await requireAdmin();
  let rows: Row[] = [];
  let schemaReady = true;
  try {
    rows = await prisma.$queryRawUnsafe<Row[]>(
      `SELECT r.id,r.kind,r."sourceText",r.status,r."createdAt",
            s.name AS "studentName",u.name AS "parentName"
       FROM "KakaoParentIntake" r
       JOIN "KakaoParentIdentity" i ON i.id=r."identityId"
       LEFT JOIN "Student" s ON s.id=r."studentId"
       LEFT JOIN "User" u ON u.id=i."parentUserId"
      ORDER BY CASE WHEN r.status IN ('PROCESSING','SUBMITTED','HELD','FAILED') THEN 0 ELSE 1 END,
               r."createdAt" DESC
      LIMIT 200`,
    );
  } catch (error) {
    if (!isKakaoSchemaNotReady(error)) throw error;
    schemaReady = false;
  }

  return (
    <main className="space-y-5">
      <div>
        <p className="text-sm font-bold text-yellow-600">학부모 채널</p>
        <h1 className="mt-1 text-2xl font-black text-gray-950 dark:text-white">카카오 접수함</h1>
        <p className="mt-2 text-sm text-gray-500">학부모가 최종 확인한 요청과 추가 확인이 필요한 대화를 함께 확인합니다.</p>
      </div>
      {!schemaReady && (
        <section role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950">
          <h2 className="font-black">카카오 접수함 DB 준비가 필요합니다</h2>
          <p className="mt-2 text-sm leading-6">
            접수 데이터는 조회하지 않았습니다. 운영 DB에 카카오 학부모 접수 구조를 적용하고 읽기 전용 사전검사를 통과한 뒤 다시 확인해 주세요.
          </p>
        </section>
      )}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        {!schemaReady ? (
          <p className="p-8 text-center text-sm text-gray-500">DB 준비 전에는 카카오 요청 목록을 표시하지 않습니다.</p>
        ) : rows.length === 0 ? (
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
