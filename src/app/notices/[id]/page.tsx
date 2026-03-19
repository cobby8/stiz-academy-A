import { getNoticeById } from "@/lib/queries";
import PublicPageLayout from "@/components/PublicPageLayout";
import Link from "next/link";
import { ArrowLeft, Paperclip, Download } from "lucide-react";
import { notFound } from "next/navigation";

export const revalidate = 60;

export default async function NoticeDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const notice = await getNoticeById(id);
    if (!notice) notFound();

    let attachments: { url: string; filename: string; size: number }[] = [];
    try { attachments = notice.attachmentsJSON ? JSON.parse(notice.attachmentsJSON) : []; } catch {}

    function formatSize(bytes: number) {
        if (bytes < 1024) return `${bytes}B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
    }

    return (
        <PublicPageLayout>
            <div className="bg-brand-navy-900 text-white py-14">
                <div className="max-w-4xl mx-auto px-6">
                    <Link href="/notices" className="inline-flex items-center gap-1 text-gray-400 hover:text-white text-sm mb-4 transition">
                        <ArrowLeft size={16} /> 목록으로
                    </Link>
                    <h1 className="text-2xl md:text-3xl font-black">{notice.title}</h1>
                    <p className="text-gray-400 text-sm mt-2">
                        {new Date(notice.createdAt).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })}
                    </p>
                </div>
            </div>
            <div className="max-w-4xl mx-auto px-6 py-12">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 md:p-8">
                    <div className="prose prose-gray max-w-none whitespace-pre-wrap text-gray-700 leading-relaxed">
                        {notice.content}
                    </div>

                    {attachments.length > 0 && (
                        <div className="mt-8 pt-6 border-t border-gray-100">
                            <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                                <Paperclip size={16} /> 첨부파일
                            </h3>
                            <div className="space-y-2">
                                {attachments.map((a, i) => (
                                    <a key={i} href={a.url} target="_blank" rel="noopener noreferrer"
                                        className="flex items-center justify-between bg-gray-50 hover:bg-gray-100 rounded-xl px-4 py-3 transition">
                                        <span className="text-sm text-gray-700 truncate">{a.filename}</span>
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            <span className="text-xs text-gray-400">{formatSize(a.size)}</span>
                                            <Download size={16} className="text-gray-400" />
                                        </div>
                                    </a>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </PublicPageLayout>
    );
}
