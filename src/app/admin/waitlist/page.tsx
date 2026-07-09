import { getWaitlistAll, getClassCapacityInfo, getClasses } from "@/lib/queries";
import { ensureWaitlistTable } from "@/app/actions/admin";
import WaitlistClient from "./WaitlistClient";

// 30초 ISR — Server Action 호출 시 revalidatePath로 즉시 무효화
export const revalidate = 30;

export default async function AdminWaitlistPage() {
    // DDL ensure: Waitlist 테이블이 없으면 자동 생성
    await ensureWaitlistTable();

    // Waitlist data is enough for the first paint; student options load on demand.
    const [waitlist, capacityInfo, classes] = await Promise.all([
        getWaitlistAll(),
        getClassCapacityInfo(),
        getClasses(),
    ]);

    return (
        <WaitlistClient
            waitlist={waitlist}
            capacityInfo={capacityInfo}
            classes={classes}
        />
    );
}
