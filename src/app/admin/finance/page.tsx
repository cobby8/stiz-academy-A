import { getPayments, getPaymentSummary } from "@/lib/queries";
import FinanceClient from "./FinanceClient";

// 30초 캐시: 아무도 수정 안 할 때 캐시 유지, Server Action 호출 시 즉시 무효화
export const revalidate = 30;

export default async function AdminFinancePage() {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth() + 1;
    // 수납 목록과 요약 통계만 먼저 조회하고, 학생 목록은 추가 폼을 열 때 불러온다.
    const [payments, summary] = await Promise.all([
        getPayments(y, m),
        getPaymentSummary(y, m),
    ]);
    return (
        <FinanceClient
            initialPayments={payments}
            initialYear={y}
            initialMonth={m}
            initialSummary={summary}
        />
    );
}
