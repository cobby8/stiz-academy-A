import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";
import { reviewStaffPaymentConfirmation } from "@/app/actions/staff-billing";

export const dynamic = "force-dynamic";

const METHOD_LABEL: Record<string, string> = {
  CASH: "현금",
  BANK_TRANSFER: "계좌이체",
};

export default async function PaymentConfirmationsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | undefined>>;
}) {
  await requireAdmin();

  const params = (await (searchParams ?? Promise.resolve({}))) as Record<string, string | undefined>;
  const filterClass = params["class"] ?? "";
  const filterMethod = params["method"] ?? "";

  const rows = await prisma.$queryRawUnsafe<
    Array<{
      id: string;
      studentName: string;
      className: string;
      staffName: string;
      method: string;
      amount: number;
      receivedAt: Date;
      note: string | null;
    }>
  >(
    `SELECT r.id, s.name AS "studentName", c.name AS "className",
            u.name AS "staffName", r.method, r.amount, r."receivedAt", r.note
       FROM "StaffPaymentConfirmationRequest" r
       JOIN "Student" s ON s.id = r."studentId"
       JOIN "Class"   c ON c.id = r."classId"
       JOIN "User"    u ON u.id = r."requestedByUserId"
      WHERE r.status = 'PENDING'
      ORDER BY r."createdAt"`,
  );

  const classes = Array.from(new Set(rows.map((r) => r.className))).sort((a, b) =>
    a.localeCompare(b, "ko"),
  );

  const filtered = rows.filter((r) => {
    if (filterClass && r.className !== filterClass) return false;
    if (filterMethod && r.method !== filterMethod) return false;
    return true;
  });

  const totalAmount = filtered.reduce((sum, r) => sum + r.amount, 0);

  return (
    <main className="mx-auto max-w-3xl space-y-4 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white">수납 확인 요청</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            코치가 현장에서 수납한 내역을 확인하고 승인합니다.
          </p>
        </div>
        {rows.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm dark:border-amber-500/30 dark:bg-amber-950/30">
            <p className="font-black text-amber-800 dark:text-amber-200">대기 중 {rows.length}건</p>
            <p className="text-xs text-amber-700 dark:text-amber-300">{totalAmount.toLocaleString()}원</p>
          </div>
        )}
      </div>

      {/* 필터 */}
      {rows.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <form className="contents">
            <input type="hidden" name="method" value={filterMethod} />
            <button
              name="class"
              value=""
              className={`rounded-full px-3 py-1 text-xs font-bold ${!filterClass ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900" : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"}`}
            >
              전체 반
            </button>
            {classes.map((cls) => (
              <button
                key={cls}
                name="class"
                value={cls}
                className={`rounded-full px-3 py-1 text-xs font-bold ${filterClass === cls ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900" : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"}`}
              >
                {cls}
              </button>
            ))}
            <span className="mx-1 text-gray-200 dark:text-gray-700">|</span>
            <button
              name="method"
              value=""
              className={`rounded-full px-3 py-1 text-xs font-bold ${!filterMethod ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900" : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"}`}
            >
              전체
            </button>
            <button
              name="method"
              value="CASH"
              className={`rounded-full px-3 py-1 text-xs font-bold ${filterMethod === "CASH" ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900" : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"}`}
            >
              현금
            </button>
            <button
              name="method"
              value="BANK_TRANSFER"
              className={`rounded-full px-3 py-1 text-xs font-bold ${filterMethod === "BANK_TRANSFER" ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900" : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"}`}
            >
              계좌이체
            </button>
          </form>
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-gray-200 p-6 text-center text-gray-500 dark:border-gray-700 dark:text-gray-400">
          {rows.length === 0 ? "대기 중인 수납 확인 요청이 없습니다." : "선택한 조건에 해당하는 요청이 없습니다."}
        </p>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <article key={r.id} className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="font-black text-gray-900 dark:text-white">
                    {r.studentName}
                    <span className="ml-2 text-[var(--brand-accent)]">{r.amount.toLocaleString()}원</span>
                  </h2>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {r.className} · {r.staffName} 코치 · {METHOD_LABEL[r.method] ?? r.method}
                  </p>
                  <p className="mt-1 text-sm font-bold text-gray-700 dark:text-gray-200">
                    수납일{" "}
                    {new Intl.DateTimeFormat("ko-KR", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(r.receivedAt)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <form
                    action={async () => {
                      "use server";
                      await reviewStaffPaymentConfirmation({ requestId: r.id, decision: "REJECTED" });
                    }}
                  >
                    <button
                      type="submit"
                      className="min-h-10 rounded-xl border border-gray-200 px-4 text-sm font-bold text-gray-700 hover:border-red-300 hover:text-red-600 dark:border-gray-700 dark:text-gray-200"
                    >
                      반려
                    </button>
                  </form>
                  <form
                    action={async () => {
                      "use server";
                      await reviewStaffPaymentConfirmation({ requestId: r.id, decision: "APPROVED" });
                    }}
                  >
                    <button
                      type="submit"
                      className="min-h-10 rounded-xl bg-[var(--brand-accent)] px-4 text-sm font-black text-[var(--brand-accent-contrast)]"
                    >
                      납부 승인
                    </button>
                  </form>
                </div>
              </div>
              {r.note && (
                <p className="mt-3 rounded-lg bg-gray-50 p-3 text-sm text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                  {r.note}
                </p>
              )}
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
