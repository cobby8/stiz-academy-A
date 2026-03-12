import Image from "next/image";
import { getAcademySettings, getCoaches } from "@/lib/queries";
import PublicPageLayout from "@/components/PublicPageLayout";

export const revalidate = 60;
export const metadata = { title: "학원/멤버소개 | STIZ 농구교실 다산점" };

export default async function AboutPage() {
    const [settings, coaches] = await Promise.all([
        getAcademySettings() as Promise<any>,
        getCoaches(),
    ]);

    return (
        <PublicPageLayout>
            {/* Page Hero */}
            <div className="bg-brand-navy-900 text-white py-14">
                <div className="max-w-4xl mx-auto px-4">
                    <p className="text-brand-orange-500 text-sm font-bold uppercase mb-2">ABOUT US</p>
                    <h1 className="text-4xl font-black mb-3">학원/멤버소개</h1>
                    <p className="text-blue-200">스티즈 농구교실 다산점을 소개합니다.</p>
                </div>
            </div>

            {/* Introduction */}
            <section className="py-14 bg-white">
                <div className="max-w-4xl mx-auto px-4">
                    <h2 className="text-2xl font-black text-brand-navy-900 mb-6 pb-3 border-b-2 border-brand-orange-500 inline-block">
                        원장 인사말
                    </h2>
                    {/* RichTextEditor(Tiptap) HTML 또는 기존 plain text 모두 처리 */}
                    <div
                        className="rich-content"
                        dangerouslySetInnerHTML={{
                            __html: (() => {
                                const text = settings.introductionText;
                                if (!text) {
                                    return "<p>안녕하세요, 스티즈 농구교실 다산점입니다.</p><p>저희 학원은 아이들이 농구를 통해 협동심, 책임감, 그리고 건강한 체력을 기를 수 있도록 최선을 다해 지도하고 있습니다.</p><p>전문 코치진과 체계적인 커리큘럼으로 아이들의 가능성을 이끌어 드리겠습니다.</p>";
                                }
                                // HTML이면 그대로, plain text면 줄바꿈→<br>
                                if (text.includes("<")) return text;
                                return text.replace(/\n/g, "<br>");
                            })()
                        }}
                    />
                </div>
            </section>

            {/* Coaches */}
            {coaches.length > 0 && (
                <section className="py-14 bg-white">
                    <div className="max-w-4xl mx-auto px-4">
                        <h2 className="text-2xl font-black text-brand-navy-900 mb-10 text-center">코치진 소개</h2>
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {coaches.map((coach) => (
                                <div key={coach.id} className="text-center">
                                    <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-100 mx-auto mb-4 border-4 border-brand-orange-500/30">
                                        {coach.imageUrl ? (
                                            <Image src={coach.imageUrl} alt={coach.name} width={96} height={96} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-3xl">🏀</div>
                                        )}
                                    </div>
                                    <h3 className="font-bold text-lg text-gray-900">{coach.name}</h3>
                                    <span className="inline-block bg-brand-orange-500 text-white text-xs font-bold px-3 py-1 rounded-full mt-1 mb-2">
                                        {coach.role}
                                    </span>
                                    {coach.description && (
                                        <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{coach.description}</p>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            {/* CTA */}
            <section className="bg-brand-navy-900 text-white py-14">
                <div className="max-w-4xl mx-auto px-4 text-center">
                    <h2 className="text-2xl font-black mb-4">체험 수업 신청하기</h2>
                    <p className="text-blue-200 mb-6">전화 한 통으로 상담부터 체험 수업까지 안내해 드립니다.</p>
                    <a
                        href={`tel:${(settings.contactPhone || "010-0000-0000").replace(/-/g, "")}`}
                        className="inline-block bg-brand-orange-500 hover:bg-orange-600 text-white font-black text-lg px-10 py-4 rounded-xl transition shadow-lg"
                    >
                        📞 {settings.contactPhone || "010-0000-0000"}
                    </a>
                </div>
            </section>
        </PublicPageLayout>
    );
}
