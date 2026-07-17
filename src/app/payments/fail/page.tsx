import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function PaymentFailPage({
    searchParams,
}: {
    searchParams: Promise<{ message?: string; code?: string; invoiceId?: string }>;
}) {
    const params = await searchParams;
    const message = params.message || "결제가 완료되지 않았습니다.";
    const retryHref = params.invoiceId ? `/payments/${encodeURIComponent(params.invoiceId)}` : "/mypage";

    return (
        <main className="min-h-screen bg-gray-50 px-4 py-12 text-gray-900 dark:bg-gray-950 dark:text-white">
            <div className="mx-auto max-w-lg rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-2xl font-bold text-red-700 dark:bg-red-500/15 dark:text-red-200">
                    !
                </div>
                <h1 className="text-xl font-extrabold">결제가 완료되지 않았습니다</h1>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{message}</p>
                {params.code && (
                    <p className="mt-2 text-xs text-gray-400">오류 코드: {params.code}</p>
                )}
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                    <Link
                        href={retryHref}
                        className="inline-flex rounded-xl bg-brand-orange-500 px-5 py-3 text-sm font-bold text-white dark:bg-brand-neon-lime dark:text-brand-navy-900"
                    >
                        {params.invoiceId ? "청구서로 돌아가기" : "마이페이지로 돌아가기"}
                    </Link>
                    {params.invoiceId && (
                        <Link
                            href="/mypage"
                            className="inline-flex rounded-xl border border-gray-200 px-5 py-3 text-sm font-bold text-gray-700 dark:border-gray-700 dark:text-gray-200"
                        >
                            마이페이지
                        </Link>
                    )}
                </div>
            </div>
        </main>
    );
}
