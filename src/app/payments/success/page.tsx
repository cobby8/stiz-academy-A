import { Suspense } from "react";
import PaymentSuccessClient from "./PaymentSuccessClient";

export const dynamic = "force-dynamic";

export default function PaymentSuccessPage() {
    return (
        <main className="min-h-screen bg-gray-50 px-4 py-12 text-gray-900 dark:bg-gray-950 dark:text-white">
            <Suspense fallback={<PaymentSuccessFallback />}>
                <PaymentSuccessClient />
            </Suspense>
        </main>
    );
}

function PaymentSuccessFallback() {
    return (
        <div className="mx-auto max-w-lg rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <p className="font-bold">결제 승인 확인 중...</p>
        </div>
    );
}
