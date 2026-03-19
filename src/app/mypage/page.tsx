import { createClient } from "@/lib/supabase/server";
import { getMyPageData, getGalleryByClassIds, getNoticesByClassIds } from "@/lib/queries";
import MyPageClient from "./MyPageClient";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function MyPageDashboard() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="text-5xl mb-4">🔒</div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">로그인이 필요합니다</h2>
                <p className="text-gray-500 mb-6">마이페이지는 학부모 계정으로 로그인 후 이용할 수 있습니다.</p>
                <Link
                    href="/login"
                    className="bg-brand-orange-500 text-white font-bold px-6 py-3 rounded-xl hover:bg-orange-600 transition"
                >
                    로그인하기
                </Link>
            </div>
        );
    }

    const data = await getMyPageData(user.email!);

    if (!data || data.children.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="text-5xl mb-4">👋</div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">등록된 자녀가 없습니다</h2>
                <p className="text-gray-500 mb-2">
                    <span className="font-medium">{user.email}</span> 계정으로 로그인하셨습니다.
                </p>
                <p className="text-gray-400 text-sm">
                    학원에 자녀를 등록하시면 이 페이지에서 출결, 수납 현황을 확인할 수 있습니다.
                </p>
            </div>
        );
    }

    // 자녀의 수강 중인 반 ID 목록 추출
    const classIds = data.children.flatMap(c =>
        c.enrollments.map((e: any) => e.classId).filter(Boolean)
    );
    // 갤러리/공지 데이터 가져오기 (classId 기준)
    const [gallery, notices] = await Promise.all([
        getGalleryByClassIds(classIds, 10),
        getNoticesByClassIds(classIds, 10),
    ]);

    return <MyPageClient data={data} gallery={gallery} notices={notices} />;
}
