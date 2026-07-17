"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

type ConfirmState = "loading" | "success" | "error";

type ConfirmResult = {
    state: ConfirmState;
    message: string;
};

export default function PaymentSuccessClient() {
    const searchParams = useSearchParams();
    const paymentKey = searchParams.get("paymentKey");
    const orderId = searchParams.get("orderId");
    const amount = searchParams.get("amount");
    const invoiceId = searchParams.get("invoiceId");
    const missingParams = !paymentKey || !orderId || !amount;
    const invoiceHref = invoiceId ? `/payments/${encodeURIComponent(invoiceId)}` : "/mypage";

    const [result, setResult] = useState<ConfirmResult>({
        state: "loading",
        message: "결제 승인 상태를 확인하고 있습니다.",
    });

    useEffect(() => {
        if (missingParams) return;

        let canceled = false;
        fetch("/api/payments/toss/confirm", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ paymentKey, orderId, amount: Number(amount) }),
        })
            .then(async (response) => {
                const data = await response.json();
                if (!response.ok || !data.ok) {
                    throw new Error(data.error || "결제 승인에 실패했습니다.");
                }
                if (!canceled) {
                    setResult({ state: "success", message: "납부가 완료되었습니다." });
                }
            })
            .catch((error) => {
                if (!canceled) {
                    setResult({
                        state: "error",
                        message: error instanceof Error ? error.message : "결제 승인 중 오류가 발생했습니다.",
                    });
                }
            });

        return () => {
            canceled = true;
        };
    }, [amount, missingParams, orderId, paymentKey]);

    const state = missingParams ? "error" : result.state;
    const message = missingParams ? "결제 승인 정보가 부족합니다." : result.message;
    const isSuccess = state === "success";

    return (
        <div className="mx-auto max-w-lg rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div
                className={`mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full text-sm font-extrabold ${
                    state === "loading"
                        ? "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-300"
                        : isSuccess
                            ? "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-200"
                            : "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-200"
                }`}
            >
                {state === "loading" ? "확인" : isSuccess ? "완료" : "오류"}
            </div>
            <h1 className="text-xl font-extrabold">{message}</h1>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                {isSuccess
                    ? "청구서와 마이페이지에서 납부 내역을 확인할 수 있습니다."
                    : "결제가 실제로 완료되었는데 오류가 보이면 학원으로 문의해 주세요."}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
                <Link
                    href={invoiceHref}
                    className="inline-flex rounded-xl bg-brand-orange-500 px-5 py-3 text-sm font-bold text-white dark:bg-brand-neon-lime dark:text-brand-navy-900"
                >
                    {invoiceId ? "청구서 확인" : "마이페이지로 이동"}
                </Link>
                {invoiceId && (
                    <Link
                        href="/mypage"
                        className="inline-flex rounded-xl border border-gray-200 px-5 py-3 text-sm font-bold text-gray-700 dark:border-gray-700 dark:text-gray-200"
                    >
                        마이페이지
                    </Link>
                )}
            </div>
        </div>
    );
}
