import { getNoticeById, getAcademySettings } from "@/lib/queries";
import PublicPageLayout from "@/components/PublicPageLayout";
import AnimateOnScroll from "@/components/ui/AnimateOnScroll";
import Badge from "@/components/ui/Badge";
import CTABanner from "@/components/landing/CTABanner";
import Link from "next/link";
import { ArrowLeft, Paperclip, Download, Pin } from "lucide-react";
import { notFound } from "next/navigation";

export const revalidate = 60;

export default async function NoticeDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    // DB에서 공지사항 상세와 학원 설정을 병렬로 가져온다
    const [notice, settings] = await Promise.all([
        getNoticeById(id),
        getAcademySettings() as Promise<any>,
    ]);

    if (!notice) notFound();

    const phone = settings.contactPhone || "010-0000-0000";

    // 첨부파일 JSON 파싱
    let attachments: { url: string; filename: string; size: number }[] = [];
    try { attachments = notice.attachmentsJSON ? JSON.parse(notice.attachmentsJSON) : []; } catch {}

    // 파일 크기 포맷 함수
    function formatSize(bytes: number) {
        if (bytes < 1024) return `${bytes}B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
    }

    return (
        <PublicPageLayout>
            {/* 페이지 히어로 — 그라데이션 + 장식 도형 + 공지 제목/날짜 */}
            <section className="relative overflow-hidden bg-gradient-to-br from-brand-navy-900 via-brand-navy-800 to-brand-navy-900 text-white py-16 md:py-20">
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute right-0 top-0 w-72 h-72 border-[20px] border-white/5 rounded-full translate-x-1/3 -translate-y-1/3" />
                    <div className="absolute left-0 bottom-0 w-48 h-48 border-[15px] border-brand-orange-500/10 rounded-full -translate-x-1/4 translate-y-1/4" />
                </div>
                <div className="max-w-4xl mx-auto px-4 relative">
                    <AnimateOnScroll>
                        {/* 목록으로 돌아가기 링크 */}
                        <Link
                            href="/notices"
                            className="inline-flex items-center gap-1.5 text-blue-200/70 hover:text-white text-sm mb-6 transition-colors"
                        >
                            <ArrowLeft size={16} /> 목록으로 돌아가기
                        </Link>

                        {/* 고정 공지 뱃지 */}
                        {notice.isPinned && (
                            <div className="mb-3">
                                <Badge variant="error" size="md">
                                    <Pin size={12} className="mr-1" />
                                    중요 공지
                                </Badge>
                            </div>
                        )}

                        {/* 공지 제목 */}
                        <h1 className="text-3xl md:text-4xl font-black leading-tight mb-3">{notice.title}</h1>

                        {/* 날짜 */}
                        <p className="text-blue-200/60 text-sm">
                            {new Date(notice.createdAt).toLocaleDateString("ko-KR", {
                                year: "numeric",
                                month: "long",
                                day: "numeric",
                            })}
                        </p>
                    </AnimateOnScroll>
                </div>
            </section>

            {/* 공지 본문 + 첨부파일 */}
            <div className="bg-surface-section">
                <div className="max-w-4xl mx-auto px-4 py-12 md:py-16">
                    <AnimateOnScroll>
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 md:p-10">
                            {/* 본문 — 줄바꿈 유지 + 가독성 높은 타이포그래피 */}
                            <div className="prose prose-gray max-w-none whitespace-pre-wrap text-gray-700 leading-loose text-[15px] md:text-base">
                                {notice.content}
                            </div>

                            {/* 첨부파일 영역 */}
                            {attachments.length > 0 && (
                                <div className="mt-10 pt-6 border-t border-gray-100">
                                    <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                                        <Paperclip size={16} className="text-gray-400" />
                                        첨부파일 ({attachments.length}개)
                                    </h3>
                                    <div className="space-y-2">
                                        {attachments.map((a, i) => (
                                            <a
                                                key={i}
                                                href={a.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center justify-between bg-gray-50 hover:bg-brand-orange-50/50 rounded-xl px-4 py-3.5 transition-colors group"
                                            >
                                                <span className="text-sm text-gray-700 truncate group-hover:text-brand-orange-600 transition-colors">
                                                    {a.filename}
                                                </span>
                                                <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                                                    <span className="text-xs text-gray-400">{formatSize(a.size)}</span>
                                                    <Download size={16} className="text-gray-400 group-hover:text-brand-orange-500 transition-colors" />
                                                </div>
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </AnimateOnScroll>

                    {/* 목록으로 돌아가기 버튼 — 본문 하단 */}
                    <div className="mt-8 text-center">
                        <Link
                            href="/notices"
                            className="inline-flex items-center gap-2 text-gray-500 hover:text-brand-navy-900 text-sm font-medium transition-colors"
                        >
                            <ArrowLeft size={16} /> 목록으로 돌아가기
                        </Link>
                    </div>
                </div>
            </div>

            {/* CTA 배너 */}
            <CTABanner
                title="궁금한 점이 있으신가요?"
                subtitle="언제든지 편하게 문의해 주세요"
                phone={phone}
                primaryLabel="체험 수업 신청"
                primaryHref="/apply"
            />
        </PublicPageLayout>
    );
}
