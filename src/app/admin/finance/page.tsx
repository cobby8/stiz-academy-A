import FinanceClient from "./FinanceClient";
import { getCachedAdminFinancePayload } from "@/lib/adminReadPayloads";

// 30초 캐시: 아무도 수정 안 할 때 캐시 유지, Server Action 호출 시 즉시 무효화
export const revalidate = 30;

export default async function AdminFinancePage() {
    const now = new Date();
    const initialYear = now.getFullYear();
    const initialMonth = now.getMonth() + 1;
    const { payments, summary, paymentProvider } = await getCachedAdminFinancePayload(initialYear, initialMonth);

    return (
        <FinanceClient
            initialPayments={payments}
            initialYear={initialYear}
            initialMonth={initialMonth}
            initialSummary={summary}
            initialPaymentProvider={paymentProvider}
        />
    );
}
