import Link from "next/link";
import { requireAuth } from "@/lib/auth-guard";
import { getInvoiceForParent, getPaymentProviderConfig } from "@/lib/payment-ledger";
import PaymentCheckoutClient from "./PaymentCheckoutClient";

export const dynamic = "force-dynamic";

function formatAmount(amount: number) {
    return `${amount.toLocaleString("ko-KR")}원`;
}

function formatDate(value: Date | string | null) {
    if (!value) return "-";
    return new Date(value).toLocaleDateString("ko-KR");
}

export default async function PaymentPage({ params }: { params: Promise<{ invoiceId: string }> }) {
    const { invoiceId } = await params;
    const user = await requireAuth();
    const invoice = user.email ? await getInvoiceForParent(invoiceId, user.email) : null;
    const providerConfig = getPaymentProviderConfig();

    if (!invoice) {
        return (
            <main className="min-h-screen bg-gray-50 px-4 py-12 text-gray-900 dark:bg-gray-950 dark:text-white">
                <div className="mx-auto max-w-lg rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm dark:border-gray-800 dark:bg-gray-900">
                    <p className="text-lg font-bold">청구서를 찾을 수 없습니다.</p>
                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                        로그인 계정에 연결된 청구서만 확인할 수 있습니다.
                    </p>
                    <Link
                        href="/mypage"
                        className="mt-6 inline-flex rounded-xl bg-brand-orange-500 px-5 py-3 text-sm font-bold text-white dark:bg-brand-neon-lime dark:text-brand-navy-900"
                    >
                        마이페이지로 돌아가기
                    </Link>
                </div>
            </main>
        );
    }

    const isPaid = invoice.paymentStatus === "PAID" || invoice.invoiceStatus === "PAID";
    const receiptHref = invoice.receiptUrl || invoice.transactionReceiptUrl || undefined;

    return (
        <main className="min-h-screen bg-gray-50 px-4 py-10 text-gray-900 dark:bg-gray-950 dark:text-white">
            <div className="mx-auto max-w-xl">
                <Link href="/mypage" className="mb-5 inline-flex text-sm font-bold text-brand-orange-500 dark:text-brand-neon-lime">
                    ← 마이페이지
                </Link>

                <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                    <div className="flex items-start justify-between gap-4 border-b border-gray-100 pb-5 dark:border-gray-800">
                        <div>
                            <p className="text-xs font-bold uppercase tracking-wide text-brand-orange-500 dark:text-brand-neon-lime">
                                STIZ Invoice
                            </p>
                            <h1 className="mt-1 text-2xl font-extrabold">{invoice.title}</h1>
                            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                {invoice.studentName} 학생 · {invoice.invoiceNo}
                            </p>
                        </div>
                        <span
                            className={`rounded-full px-3 py-1 text-xs font-bold ${
                                isPaid
                                    ? "bg-green-100 text-green-700 dark:bg-green-400/15 dark:text-green-200"
                                    : "bg-yellow-100 text-yellow-800 dark:bg-brand-neon-lime/15 dark:text-brand-neon-lime"
                            }`}
                        >
                            {isPaid ? "납부완료" : invoice.paymentStatus === "OVERDUE" ? "연체" : "미납"}
                        </span>
                    </div>

                    <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
                        <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-800">
                            <dt className="text-gray-500 dark:text-gray-400">청구 금액</dt>
                            <dd className="mt-1 text-xl font-extrabold">{formatAmount(Number(invoice.amount))}</dd>
                        </div>
                        <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-800">
                            <dt className="text-gray-500 dark:text-gray-400">납부 기한</dt>
                            <dd className="mt-1 text-xl font-extrabold">{formatDate(invoice.dueDate)}</dd>
                        </div>
                    </dl>

                    {invoice.description && (
                        <p className="mt-5 rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm text-gray-600 dark:border-gray-800 dark:bg-gray-800 dark:text-gray-300">
                            {invoice.description}
                        </p>
                    )}

                    {isPaid ? (
                        <div className="mt-6 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800 dark:border-green-500/30 dark:bg-green-500/10 dark:text-green-100">
                            <p className="font-bold">납부가 완료되었습니다.</p>
                            <p className="mt-1">납부일: {formatDate(invoice.paidDate || invoice.paidAt)}</p>
                            {receiptHref && (
                                <a
                                    href={receiptHref}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="mt-3 inline-flex font-bold underline"
                                >
                                    영수증 보기
                                </a>
                            )}
                        </div>
                    ) : (
                        <PaymentCheckoutClient
                            invoiceId={invoice.invoiceId}
                            providerReady={providerConfig.providerReady}
                            amount={Number(invoice.amount)}
                        />
                    )}
                </section>
            </div>
        </main>
    );
}
