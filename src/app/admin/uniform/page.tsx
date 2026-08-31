import Link from "next/link";
import { requireAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import {
  readUniformOrderSheet,
  type UniformOrderRow,
  type UniformOrderStatus,
  UNIFORM_SPREADSHEET_ID,
} from "@/lib/uniformOrders";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<UniformOrderStatus, string> = {
  NEW: "발주 대기",
  PAYMENT_REVIEW: "입금 확인",
  ORDERED: "발주 완료",
  ARRIVED: "학원 도착",
  LEGACY_REVIEW: "과거자료 확인",
};

function SummaryCard({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className={`rounded-2xl border p-4 ${tone}`}>
      <p className="text-xs font-bold opacity-75">{label}</p>
      <p className="mt-1 text-2xl font-black">{value}건</p>
    </div>
  );
}

export default async function UniformOrdersPage() {
  await requireAdmin();

  let rows: UniformOrderRow[] = [];
  let loadError = "";
  try {
    rows = (await readUniformOrderSheet()).filter((row) => row.branch.includes("2호점"));
  } catch (error) {
    loadError = error instanceof Error ? error.message : "유니폼 신청서를 불러오지 못했습니다.";
  }

  const names = Array.from(new Set(rows.map((row) => row.studentName).filter(Boolean)));
  const students = names.length
    ? await prisma.student.findMany({
        where: { name: { in: names }, mergedIntoStudentId: null },
        select: { id: true, name: true, branch: true, uniformStatus: true },
      })
    : [];
  const studentsByName = new Map<string, typeof students>();
  for (const student of students) {
    const current = studentsByName.get(student.name) || [];
    current.push(student);
    studentsByName.set(student.name, current);
  }

  const activeRows = rows.filter((row) => row.status !== "LEGACY_REVIEW");
  const counts = (status: UniformOrderStatus) => rows.filter((row) => row.status === status).length;

  return (
    <main className="mx-auto max-w-7xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-accent)]">UNIFORM</p>
          <h1 className="mt-1 text-2xl font-black text-gray-900 dark:text-white">유니폼 주문 관리</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            신청서의 입금·발주·도착 기록을 읽어 신규 주문과 확인보류를 구분합니다.
          </p>
        </div>
        <Link
          href={`https://docs.google.com/spreadsheets/d/${UNIFORM_SPREADSHEET_ID}/edit#gid=1743369676`}
          target="_blank"
          className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
        >
          원본 신청서 열기
        </Link>
      </div>

      {loadError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm font-bold text-red-700 dark:border-red-500/30 dark:bg-red-950/30 dark:text-red-200">
          {loadError}
          <p className="mt-2 text-xs font-medium">서비스 계정에 이 유니폼 시트의 보기 권한이 있는지 확인해 주세요.</p>
        </div>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <SummaryCard label="발주 대기" value={counts("NEW")} tone="border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-500/30 dark:bg-blue-950/30 dark:text-blue-100" />
            <SummaryCard label="입금 확인" value={counts("PAYMENT_REVIEW")} tone="border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-100" />
            <SummaryCard label="발주 완료" value={counts("ORDERED")} tone="border-violet-200 bg-violet-50 text-violet-900 dark:border-violet-500/30 dark:bg-violet-950/30 dark:text-violet-100" />
            <SummaryCard label="학원 도착" value={counts("ARRIVED")} tone="border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-950/30 dark:text-emerald-100" />
            <SummaryCard label="과거자료 확인" value={counts("LEGACY_REVIEW")} tone="border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200" />
          </section>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-100">
            <p className="font-black">안전 규칙</p>
            <p className="mt-1">입금 근거가 없거나 동명이인이면 자동 발주하지 않습니다. 실제 업체 주문은 발주 목록 미리보기 승인 후에만 진행합니다.</p>
          </div>

          <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
            <div className="overflow-x-auto">
              <table className="min-w-[1050px] w-full text-left text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 dark:bg-gray-800 dark:text-gray-300">
                  <tr>
                    <th className="px-4 py-3">상태</th><th className="px-4 py-3">학생</th><th className="px-4 py-3">신청일</th>
                    <th className="px-4 py-3">디자인</th><th className="px-4 py-3">마킹</th><th className="px-4 py-3">사이즈</th>
                    <th className="px-4 py-3">입금</th><th className="px-4 py-3">운영 원장</th><th className="px-4 py-3">확인</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {activeRows.map((row) => {
                    const matches = studentsByName.get(row.studentName) || [];
                    const identity = matches.length === 1 ? matches[0] : null;
                    const identityMessage = matches.length === 0 ? "학생 미연결" : matches.length > 1 ? "동명이인 확인" : identity?.uniformStatus || "상태 미입력";
                    return (
                      <tr key={row.rowNumber}>
                        <td className="px-4 py-3 font-black">{STATUS_LABEL[row.status]}</td>
                        <td className="px-4 py-3 font-bold text-gray-900 dark:text-white">{row.studentName}</td>
                        <td className="px-4 py-3 text-gray-500">{row.submittedAt}</td>
                        <td className="px-4 py-3">{row.design || "-"}</td>
                        <td className="px-4 py-3">{row.initials || "-"} · {row.backNumber || "번호 없음"}</td>
                        <td className="px-4 py-3">상의 {row.topSize || "-"}<br />하의 {row.bottomSize || "-"}</td>
                        <td className="px-4 py-3">{row.paidAmount || row.paidAt || "확인 필요"}</td>
                        <td className="px-4 py-3">
                          {identity ? <Link className="font-bold text-blue-600 hover:underline" href={`/admin/students/${identity.id}`}>{identityMessage}</Link> : <span className="font-bold text-amber-700">{identityMessage}</span>}
                        </td>
                        <td className="px-4 py-3 text-xs text-amber-700 dark:text-amber-300">{row.issues.join(" · ") || "정상"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
