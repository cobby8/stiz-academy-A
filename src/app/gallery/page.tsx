import { getGalleryPosts } from "@/lib/queries";
import PublicPageLayout from "@/components/PublicPageLayout";
import GalleryPublicClient from "./GalleryPublicClient";

export const revalidate = 60;
export const metadata = {
    title: "포토갤러리 | STIZ 농구교실 다산점",
    description: "스티즈 농구교실 수업 사진과 영상을 확인하세요.",
};

export default async function GalleryPage() {
    const posts = await getGalleryPosts({ limit: 50, publicOnly: true });
    return (
        <PublicPageLayout>
            <div className="bg-brand-navy-900 text-white py-14">
                <div className="max-w-6xl mx-auto px-6">
                    <h1 className="text-3xl md:text-4xl font-black">포토갤러리</h1>
                    <p className="text-gray-300 mt-2">수업 현장의 생생한 모습을 확인하세요</p>
                </div>
            </div>
            <div className="max-w-6xl mx-auto px-6 py-12">
                <GalleryPublicClient posts={posts} />
            </div>
        </PublicPageLayout>
    );
}
