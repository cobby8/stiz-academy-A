import { getPayments, getStudents, getPaymentSummary } from "@/lib/queries";
import FinanceClient from "./FinanceClient";

// 30초 캐시: 아무도 수정 안 할 때 캐시 유지, Server Action 호출 시 즉시 무효화
export const revalidate = 30;

export default async function AdminFinancePage() {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth() + 1;
    // 수납 목록 + 학생 목록 + 요약 통계를 동시 조회
    const [payments, students, summary] = await Promise.all([
        getPayments(y, m),
        getStudents(),
        getPaymentSummary(y, m),
    ]);
    return (
        <FinanceClient
            initialPayments={payments}
            students={students}
            initialYear={y}
            initialMonth={m}
            initialSummary={summary}
        />
    );
}
