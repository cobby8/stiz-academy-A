import { getPayments, getStudents } from "@/lib/queries";
import FinanceClient from "./FinanceClient";

// 30초 캐시: 아무도 수정 안 할 때 캐시 유지, Server Action 호출 시 즉시 무효화
export const revalidate = 30;

export default async function AdminFinancePage() {
    const now = new Date();
    const [payments, students] = await Promise.all([
        getPayments(now.getFullYear(), now.getMonth() + 1),
        getStudents(),
    ]);
    return (
        <FinanceClient
            initialPayments={payments}
            students={students}
            initialYear={now.getFullYear()}
            initialMonth={now.getMonth() + 1}
        />
    );
}
