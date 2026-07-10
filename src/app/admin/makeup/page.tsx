import MakeupClient from "./MakeupClient";

// 30초 ISR — Server Action 호출 시 revalidatePath로 즉시 무효화
export const revalidate = 30;

export default function AdminMakeupPage() {
    return <MakeupClient />;
}
