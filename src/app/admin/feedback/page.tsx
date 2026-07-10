import { getAllFeedbacks, getCoaches } from "@/lib/queries";
import FeedbackManagementClient from "./FeedbackManagementClient";

// 30초 캐시: 아무도 수정 안 할 때 캐시 유지, Server Action 호출 시 즉시 무효화
export const revalidate = 30;

export default async function FeedbackPage() {
    // 피드백 목록과 코치 목록만 먼저 조회하고, 원생 목록은 작성 폼을 열 때 불러온다.
    const [feedbacks, coaches] = await Promise.all([
        getAllFeedbacks(),
        getCoaches(),
    ]);

    return (
        <FeedbackManagementClient
            feedbacks={feedbacks}
            coaches={coaches}
        />
    );
}
