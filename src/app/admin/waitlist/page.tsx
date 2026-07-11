import WaitlistClient from "./WaitlistClient";
import { getCachedAdminWaitlistPayload } from "@/lib/adminReadPayloads";

// 30초 ISR — Server Action 호출 시 revalidatePath로 즉시 무효화
export const revalidate = 30;

export default async function AdminWaitlistPage() {
    const { waitlist, capacityInfo, classes } = await getCachedAdminWaitlistPayload();

    return (
        <WaitlistClient
            waitlist={waitlist}
            capacityInfo={capacityInfo}
            classes={classes}
        />
    );
}
