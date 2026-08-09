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
          <h1 className="text-2xl font-bold text-[var(--doc-ink)]">수납 확인 요청</h1>
        </div>
        {rows.length > 0 && (
          <div className="rounded-[3px] border border-[var(--doc-warn)] bg-[var(--doc-grid-head)] px-4 py-2 text-sm">
            <p className="font-bold text-[var(--doc-warn)]">대기 중 {rows.length}건</p>
            <p className="text-xs text-[var(--doc-warn)]">{totalAmount.toLocaleString()}원</p>
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
              className={`rounded-[3px] px-3 py-1 text-xs font-bold ${!filterClass ? "bg-[var(--doc-grid-head)] text-white " : "bg-[var(--doc-grid-head)] text-[var(--doc-ink-2)] "}`}
            >
              전체 반
            </button>
            {classes.map((cls) => (
              <button
                key={cls}
                name="class"
                value={cls}
                className={`rounded-[3px] px-3 py-1 text-xs font-bold ${filterClass === cls ? "bg-[var(--doc-grid-head)] text-white " : "bg-[var(--doc-grid-head)] text-[var(--doc-ink-2)] "}`}
              >
                {cls}
              </button>
            ))}
            <span className="mx-1 text-gray-200">|</span>
            <button
              name="method"
              value=""
              className={`rounded-[3px] px-3 py-1 text-xs font-bold ${!filterMethod ? "bg-[var(--doc-grid-head)] text-white " : "bg-[var(--doc-grid-head)] text-[var(--doc-ink-2)] "}`}
            >
              전체
            </button>
            <button
              name="method"
              value="CASH"
              className={`rounded-[3px] px-3 py-1 text-xs font-bold ${filterMethod === "CASH" ? "bg-[var(--doc-grid-head)] text-white " : "bg-[var(--doc-grid-head)] text-[var(--doc-ink-2)] "}`}
            >
              현금
            </button>
            <button
              name="method"
              value="BANK_TRANSFER"
              className={`rounded-[3px] px-3 py-1 text-xs font-bold ${filterMethod === "BANK_TRANSFER" ? "bg-[var(--doc-grid-head)] text-white " : "bg-[var(--doc-grid-head)] text-[var(--doc-ink-2)] "}`}
            >
              계좌이체
            </button>
          </form>
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="rounded-[3px] border border-[var(--doc-rule)] p-6 text-center text-[var(--doc-ink-2)]">
          {rows.length === 0 ? "대기 중인 수납 확인 요청이 없습니다." : "선택한 조건에 해당하는 요청이 없습니다."}
        </p>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <article key={r.id} className="rounded-[6px] border border-[var(--doc-rule)] bg-[var(--doc-surface)] p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="font-bold text-[var(--doc-ink)]">
                    {r.studentName}
                    <span className="ml-2 text-[var(--doc-accent)]">{r.amount.toLocaleString()}원</span>
                  </h2>
                  <p className="mt-1 text-sm text-[var(--doc-ink-2)]">
                    {r.className} · {r.staffName} 코치 · {METHOD_LABEL[r.method] ?? r.method}
                  </p>
                  <p className="mt-1 text-sm font-bold text-[var(--doc-ink-2)]">
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
                      className="min-h-10 rounded-[3px] border border-[var(--doc-rule)] px-4 text-sm font-bold text-[var(--doc-ink-2)] hover:border-[var(--doc-crit)] hover:text-[var(--doc-crit)]"
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
                      className="min-h-10 rounded-[3px] bg-[var(--doc-accent)] px-4 text-sm font-bold text-[var(--doc-on-accent)]"
                    >
                      납부 승인
                    </button>
                  </form>
                </div>
              </div>
              {r.note && (
                <p className="mt-3 rounded-[3px] bg-[var(--doc-grid-head)] p-3 text-sm text-[var(--doc-ink-2)]">
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
