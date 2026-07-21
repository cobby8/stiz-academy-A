import Link from "next/link";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth-guard";

export const dynamic = "force-dynamic";

export default async function StaffShuttlePage() {
  const staff = await requireStaff();
  const canUseShuttle =
    staff.appUserRole === "DRIVER" ||
    staff.appUserRole === "ADMIN" ||
    staff.appUserRole === "VICE_ADMIN";

  if (!canUseShuttle) redirect("/staff");

  return (
    <main className="mx-auto min-h-[calc(100dvh-9rem)] max-w-lg px-4 py-5">
      <section className="rounded-3xl bg-brand-navy-900 p-5 text-white shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-white/65">셔틀 기사 앱</p>
            <h1 className="mt-1 text-2xl font-black">오늘 운행</h1>
            <p className="mt-2 text-sm leading-6 text-white/75">
              관리자 셔틀 노선에서 확정된 운행 정보가 이 화면으로 연결됩니다.
            </p>
          </div>
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[var(--brand-accent)] text-[var(--brand-accent-contrast)]">
            <span className="material-symbols-outlined" aria-hidden="true">airport_shuttle</span>
          </span>
        </div>
      </section>

      <section className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-gray-900">
          <p className="text-xs font-bold text-gray-500 dark:text-gray-400">운행 상태</p>
          <p className="mt-2 text-lg font-black text-gray-900 dark:text-white">대기</p>
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-gray-900">
          <p className="text-xs font-bold text-gray-500 dark:text-gray-400">오늘 노선</p>
          <p className="mt-2 text-lg font-black text-gray-900 dark:text-white">연결 준비</p>
        </div>
      </section>

      <section className="mt-4 space-y-3">
        <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200">
              <span className="material-symbols-outlined" aria-hidden="true">route</span>
            </span>
            <div>
              <h2 className="font-black text-gray-900 dark:text-white">확정 노선 확인</h2>
              <p className="mt-1 text-sm leading-6 text-gray-600 dark:text-gray-300">
                다음 단계에서 관리자 노선 배정과 기사 계정을 연결해, 오늘 운행할 학생과 정류장을 바로 확인하게 만듭니다.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-200">
              <span className="material-symbols-outlined" aria-hidden="true">checklist</span>
            </span>
            <div>
              <h2 className="font-black text-gray-900 dark:text-white">탑승/하차 체크</h2>
              <p className="mt-1 text-sm leading-6 text-gray-600 dark:text-gray-300">
                차량 운행 중 한 손으로 누를 수 있는 체크 UI와 학부모 알림은 노선 연결 뒤 붙이면 됩니다.
              </p>
            </div>
          </div>
        </div>
      </section>

      {(staff.appUserRole === "ADMIN" || staff.appUserRole === "VICE_ADMIN") && (
        <Link
          href="/admin/shuttle"
          className="mt-4 flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[var(--brand-accent)] px-4 text-sm font-black text-[var(--brand-accent-contrast)] shadow-sm"
        >
          <span className="material-symbols-outlined" aria-hidden="true">settings</span>
          관리자 셔틀 설정으로 이동
        </Link>
      )}
    </main>
  );
}
