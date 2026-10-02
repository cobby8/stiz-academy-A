"use client";

import { useState } from "react";
import FontFreeIcon from "@/components/ui/FontFreeIcon";

type TierOption = { key: string; label: string; amount: number };

type CheckoutResponse = {
    clientKey?: string;
    customerKey?: string;
    orderId?: string;
    amount?: number;
    orderName?: string;
    successUrl?: string;
    failUrl?: string;
    error?: string;
};

type TossPaymentsFactory = (clientKey: string) => {
    payment: (options: { customerKey: string }) => {
        requestPayment: (options: {
            method: "CARD";
            amount: { currency: "KRW"; value: number };
            orderId: string;
            orderName: string;
            successUrl: string;
            failUrl: string;
        }) => Promise<void>;
    };
};

function loadTossScript() {
    return new Promise<TossPaymentsFactory>((resolve, reject) => {
        const ready = () => {
            const factory = (window as unknown as { TossPayments?: TossPaymentsFactory }).TossPayments;
            if (factory) resolve(factory);
            else reject(new Error("결제창을 불러오지 못했습니다."));
        };
        if ((window as unknown as { TossPayments?: unknown }).TossPayments) return ready();

        // 청구서 결제 화면과 같은 스크립트 표식을 써서 두 번 싣지 않는다.
        const existing = document.querySelector<HTMLScriptElement>("script[data-toss-payments]");
        if (existing) {
            existing.addEventListener("load", ready, { once: true });
            existing.addEventListener("error", () => reject(new Error("결제창을 불러오지 못했습니다.")), { once: true });
            return;
        }
        const script = document.createElement("script");
        script.src = "https://js.tosspayments.com/v2/standard";
        script.async = true;
        script.dataset.tossPayments = "true";
        script.onload = ready;
        script.onerror = () => reject(new Error("결제창을 불러오지 못했습니다."));
        document.head.appendChild(script);
    });
}

/**
 * 프로그램 카드의 [결제하기] — 토스페이먼츠 가맹 심사용 테스트 결제.
 * 서버가 테스트 키를 가지고 있을 때만 화면에 나온다(부모 컴포넌트가 판단).
 * 금액은 서버가 DB 가격으로 다시 정하므로, 여기서 고르는 건 "어느 가격 칸"뿐이다.
 */
export default function ProgramPayButton({ programId, tiers }: { programId: string; tiers: TierOption[] }) {
    const [tier, setTier] = useState(tiers[0]?.key ?? "");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (tiers.length === 0) return null;

    async function pay() {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch("/api/payments/toss-review/checkout", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ programId, tier }),
            });
            const data = (await response.json().catch(() => ({}))) as CheckoutResponse;
            if (!response.ok || !data.clientKey || !data.customerKey || !data.orderId || !data.amount || !data.orderName || !data.successUrl || !data.failUrl) {
                throw new Error(data.error || "결제 준비에 실패했습니다.");
            }
            const TossPayments = await loadTossScript();
            await TossPayments(data.clientKey).payment({ customerKey: data.customerKey }).requestPayment({
                method: "CARD",
                amount: { currency: "KRW", value: data.amount },
                orderId: data.orderId,
                orderName: data.orderName,
                successUrl: data.successUrl,
                failUrl: data.failUrl,
            });
        } catch (err) {
            // 결제창을 닫은 경우도 여기로 온다 — 버튼만 다시 누를 수 있게 돌려놓는다.
            setError(err instanceof Error ? err.message : "결제 요청 중 오류가 발생했습니다.");
            setLoading(false);
        }
    }

    return (
        <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
            {tiers.length > 1 && (
                <select
                    value={tier}
                    onChange={(event) => setTier(event.target.value)}
                    aria-label="결제할 수업 빈도"
                    className="min-h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                >
                    {tiers.map((option) => (
                        <option key={option.key} value={option.key}>
                            {option.label} · {option.amount.toLocaleString("ko-KR")}원
                        </option>
                    ))}
                </select>
            )}
            <button
                type="button"
                onClick={pay}
                disabled={loading}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-brand-orange-500 px-4 text-sm font-black text-white transition hover:bg-orange-600 disabled:opacity-60 dark:bg-brand-neon-lime dark:text-brand-navy-900"
            >
                <FontFreeIcon name="payments" size={18} />
                {loading ? "결제창 여는 중" : "결제하기"}
            </button>
            {error && <p className="w-full text-right text-xs text-red-600 dark:text-red-400">{error}</p>}
        </div>
    );
}
