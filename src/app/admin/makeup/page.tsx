import { getMakeupSessions, getStudents, getClasses } from "@/lib/queries";
import { ensureMakeupSessionTable } from "@/app/actions/admin";
import MakeupClient from "./MakeupClient";

// 30초 ISR — Server Action 호출 시 revalidatePath로 즉시 무효화
export const revalidate = 30;

export default async function AdminMakeupPage() {
    // DDL ensure: MakeupSession 테이블이 없으면 자동 생성
    await ensureMakeupSessionTable();

    // 병렬 조회: 보강 목록 + 학생 목록 + 반 목록
    const [sessions, students, classes] = await Promise.all([
        getMakeupSessions(),
        getStudents(),
        getClasses(),
    ]);

    return (
        <MakeupClient
            sessions={sessions}
            students={students}
            classes={classes}
        />
    );
}
