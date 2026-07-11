import MakeupClient from "./MakeupClient";
import { getCachedAdminMakeupPayload } from "@/lib/adminReadPayloads";

// 30초 ISR — Server Action 호출 시 revalidatePath로 즉시 무효화
export const revalidate = 30;

export default async function AdminMakeupPage() {
    const { sessions, classes } = await getCachedAdminMakeupPayload();

    return <MakeupClient sessions={sessions} classes={classes} />;
}
