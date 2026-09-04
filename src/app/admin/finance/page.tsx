import FinanceClient from "./FinanceClient";
import Link from "next/link";
import { getCachedAdminFinancePayload } from "@/lib/adminReadPayloads";
import { requireAdmin } from "@/lib/auth-guard";

// 30초 캐시: 아무도 수정 안 할 때 캐시 유지, Server Action 호출 시 즉시 무효화
export const revalidate = 30;

export default async function AdminFinancePage() {
    const now = new Date();
    const initialYear = now.getFullYear();
    const initialMonth = now.getMonth() + 1;
    const [adminUser, payload] = await Promise.all([
        requireAdmin(),
        getCachedAdminFinancePayload(initialYear, initialMonth),
    ]);
    const { payments, summary, paymentProvider } = payload;

    return (
        <>
            <div className="mb-4">
                <Link href="/admin/finance/monthly-ledger" className="underline">
                    월별·반별 장부 점검 (조회 전용)
                </Link>
            </div>
            <FinanceClient
                initialPayments={payments}
                initialYear={initialYear}
                initialMonth={initialMonth}
                initialSummary={summary}
                initialPaymentProvider={paymentProvider}
                currentAdminRole={adminUser.appUserRole}
            />
        </>
    );
}
