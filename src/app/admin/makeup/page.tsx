import MakeupClient from "./MakeupClient";
import CreditPanel from "./CreditPanel";
import { getCachedAdminMakeupPayload } from "@/lib/adminReadPayloads";
import { getMakeupCreditOverview } from "@/lib/makeup/admin-credits";

// 30초 ISR — Server Action 호출 시 revalidatePath로 즉시 무효화
export const revalidate = 30;

export default async function AdminMakeupPage() {
    // 보강권 현황과 예약 목록은 서로 독립이라 동시에 읽는다.
    const [{ sessions, classes }, credits] = await Promise.all([
        getCachedAdminMakeupPayload(),
        getMakeupCreditOverview(),
    ]);

    return (
        <>
            <CreditPanel data={JSON.parse(JSON.stringify(credits))} />
            <MakeupClient sessions={sessions} classes={classes} />
        </>
    );
}
