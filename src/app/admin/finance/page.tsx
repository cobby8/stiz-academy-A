import { getPayments, getStudents } from "@/lib/queries";
import FinanceClient from "./FinanceClient";

export const dynamic = "force-dynamic";

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
