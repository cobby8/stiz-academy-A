import { getAllFeedbacks, getStudents, getCoaches } from "@/lib/queries";
import FeedbackManagementClient from "./FeedbackManagementClient";

// 실시간 데이터가 필요하므로 매 요청마다 최신 데이터를 가져옴
export const dynamic = "force-dynamic";

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
