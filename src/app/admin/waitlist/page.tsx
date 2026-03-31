import { getWaitlistAll, getClassCapacityInfo, getStudents, getClasses } from "@/lib/queries";
import { ensureWaitlistTable } from "@/app/actions/admin";
import WaitlistClient from "./WaitlistClient";

// 30초 ISR — Server Action 호출 시 revalidatePath로 즉시 무효화
export const revalidate = 30;

export default async function AdminWaitlistPage() {
    // DDL ensure: Waitlist 테이블이 없으면 자동 생성
    await ensureWaitlistTable();

    // 병렬 조회: 대기자 목록 + 반 정원 현황 + 학생 목록 + 반 목록
    const [waitlist, capacityInfo, students, classes] = await Promise.all([
        getWaitlistAll(),
        getClassCapacityInfo(),
        getStudents(),
        getClasses(),
    ]);

    return (
        <WaitlistClient
            waitlist={waitlist}
            capacityInfo={capacityInfo}
            students={students}
            classes={classes}
        />
    );
}
