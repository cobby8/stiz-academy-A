import { getNotices } from "@/lib/queries";
import PublicPageLayout from "@/components/PublicPageLayout";
import Link from "next/link";
import { Pin, Paperclip } from "lucide-react";

export const revalidate = 60;
export const metadata = {
    title: "공지사항 | STIZ 농구교실 다산점",
    description: "스티즈 농구교실 공지사항을 확인하세요.",
};

export default async function NoticesPage() {
    const notices = await getNotices({ limit: 50 });
    // 공개 페이지에서는 전체 공지만 표시
    const publicNotices = notices.filter(n => n.targetType === "ALL");

    return (
        <PublicPageLayout>
            <div className="bg-brand-navy-900 text-white py-14">
                <div className="max-w-4xl mx-auto px-6">
                    <h1 className="text-3xl md:text-4xl font-black">공지사항</h1>
                    <p className="text-gray-300 mt-2">학원 소식과 안내사항을 확인하세요</p>
                </div>
            </div>
            <div className="max-w-4xl mx-auto px-6 py-12">
                {publicNotices.length === 0 ? (
                    <div className="text-center py-20 text-gray-400">
                        <p className="text-lg font-medium">아직 공지사항이 없습니다</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {publicNotices.map(n => {
                            let atts: { url: string; filename: string }[] = [];
                            try { atts = n.attachmentsJSON ? JSON.parse(n.attachmentsJSON) : []; } catch {}
                            return (
                                <Link key={n.id} href={`/notices/${n.id}`}
                                    className="block bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md hover:border-brand-orange-200 transition">
                                    <div className="flex items-start gap-3">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                {n.isPinned && <Pin size={14} className="text-brand-orange-500 flex-shrink-0" />}
                                                <h2 className="font-bold text-gray-900 truncate">{n.title}</h2>
                                            </div>
                                            <p className="text-sm text-gray-500 line-clamp-2">{n.content}</p>
                                            <div className="flex items-center gap-3 mt-2">
                                                <span className="text-xs text-gray-400">
                                                    {new Date(n.createdAt).toLocaleDateString("ko-KR")}
                                                </span>
                                                {atts.length > 0 && (
                                                    <span className="text-xs text-gray-400 flex items-center gap-1">
                                                        <Paperclip size={12} /> {atts.length}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                )}
            </div>
        </PublicPageLayout>
    );
}
