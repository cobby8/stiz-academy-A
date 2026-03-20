import { getAllFeedbacks, getStudents, getCoaches } from "@/lib/queries";
import FeedbackManagementClient from "./FeedbackManagementClient";

// 30초 캐시: 아무도 수정 안 할 때 캐시 유지, Server Action 호출 시 즉시 무효화
export const revalidate = 30;

export default async function FeedbackPage() {
    // 피드백 목록, 원생 목록, 코치 목록을 동시에 가져옴 (병렬 처리로 속도 향상)
    const [feedbacks, students, coaches] = await Promise.all([
        getAllFeedbacks(),
        getStudents(),
        getCoaches(),
    ]);

    return (
        <FeedbackManagementClient
            feedbacks={feedbacks}
            students={students}
            coaches={coaches}
        />
    );
}
