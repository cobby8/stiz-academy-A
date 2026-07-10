import WaitlistClient from "./WaitlistClient";

// 30초 ISR — Server Action 호출 시 revalidatePath로 즉시 무효화
export const revalidate = 30;

export default function AdminWaitlistPage() {
    return <WaitlistClient />;
}
