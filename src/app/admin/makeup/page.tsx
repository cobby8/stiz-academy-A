import { getMakeupSessions, getClasses } from "@/lib/queries";
import MakeupClient from "./MakeupClient";

// 30초 ISR — Server Action 호출 시 revalidatePath로 즉시 무효화
export const revalidate = 30;

export default async function AdminMakeupPage() {
    // 보강 예약 액션에서 테이블을 보장하므로, 목록 화면은 읽기 데이터만 빠르게 조회한다.
    const [sessions, classes] = await Promise.all([
        getMakeupSessions(),
        getClasses(),
    ]);

    return (
        <MakeupClient
            sessions={sessions}
            classes={classes}
        />
    );
}
