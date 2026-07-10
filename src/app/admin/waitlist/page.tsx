import { getWaitlistAll, getClassCapacityInfo, getClasses } from "@/lib/queries";
import WaitlistClient from "./WaitlistClient";

// 30초 ISR — Server Action 호출 시 revalidatePath로 즉시 무효화
export const revalidate = 30;

export default async function AdminWaitlistPage() {
    // 대기 등록 액션에서 테이블을 보장하므로, 목록 화면은 읽기 데이터만 빠르게 조회한다.
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
