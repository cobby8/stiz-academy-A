import Image from "next/image";
import { getAcademySettings, getCoaches } from "@/lib/queries";
import PublicPageLayout from "@/components/PublicPageLayout";
import SectionLayout from "@/components/ui/SectionLayout";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import AnimateOnScroll from "@/components/ui/AnimateOnScroll";
import CTABanner from "@/components/landing/CTABanner";

export const revalidate = 60;
export const metadata = { title: "학원/멤버소개 | STIZ 농구교실 다산점", description: "스티즈 농구교실 다산점의 원장 인사말, 전문 코치진, 시설을 소개합니다." };

// HTML 텍스트를 안전하게 렌더링하기 위한 유틸 함수
function renderHtml(text: string | null | undefined, fallback: string) {
    if (!text) return fallback;
    if (text.includes("<")) return text;
    return text.replace(/\n/g, "<br>");
}

// 교육 이념 아이콘 카드 데이터 — 학원의 핵심 가치 4가지
const PHILOSOPHY_CARDS = [
    {
        icon: "🎯",
        title: "전문성",
        description: "체계적인 커리큘럼과 전문 코치진이 아이의 실력을 단계별로 끌어올립니다",
        color: "bg-blue-50 text-blue-600",
    },
    {
        icon: "🛡️",
        title: "안전",
        description: "안전한 시설과 체계적인 관리로 아이들이 마음껏 뛰어놀 수 있는 환경을 제공합니다",
        color: "bg-emerald-50 text-emerald-600",
    },
    {
        icon: "😊",
        title: "즐거움",
        description: "농구를 통해 성취감과 즐거움을 경험하며 운동에 대한 긍정적 태도를 형성합니다",
        color: "bg-amber-50 text-amber-600",
    },
    {
        icon: "🌱",
        title: "성장",
        description: "체력뿐 아니라 협동심, 리더십, 인성까지 함께 성장하는 교육을 추구합니다",
        color: "bg-purple-50 text-purple-600",
    },
];

// 핵심 약속 3가지 — 학원 소개 섹션 하단에 표시
const PROMISES = [
    { icon: "🏆", title: "최고의 코치진", text: "자격증 보유 전문 코치" },
    { icon: "📋", title: "체계적 커리큘럼", text: "수준별 맞춤 교육" },
    { icon: "💬", title: "소통하는 교육", text: "학부모 피드백 시스템" },
];

export default async function AboutPage() {
    // DB에서 학원 설정과 코치 정보를 병렬로 가져온다
    const [settings, coaches] = await Promise.all([
        getAcademySettings() as Promise<any>,
        getCoaches(),
    ]);

    // 시설 이미지 JSON 파싱 — 실패 시 빈 배열 반환
    const facilityImages: string[] = (() => {
        try {
            if (settings.facilitiesImagesJSON) return JSON.parse(settings.facilitiesImagesJSON);
        } catch {}
        return [];
    })();

    const phone = settings.contactPhone || "010-0000-0000";

    return (
        <PublicPageLayout>
            {/* 페이지 히어로 — 그라데이션 배경 + 장식 요소 (Phase 0 패턴 적용) */}
            <section className="relative overflow-hidden bg-gradient-to-br from-brand-navy-900 via-brand-navy-800 to-brand-navy-900 text-white py-16 md:py-20">
                {/* 배경 장식 도형들 */}
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute right-0 top-0 w-72 h-72 border-[20px] border-white/5 rounded-full translate-x-1/3 -translate-y-1/3" />
                    <div className="absolute left-0 bottom-0 w-48 h-48 border-[15px] border-brand-orange-500/10 rounded-full -translate-x-1/4 translate-y-1/4" />
                </div>
                <div className="max-w-6xl mx-auto px-4 relative">
                    <AnimateOnScroll>
                        <p className="text-brand-orange-500 text-sm font-bold uppercase tracking-widest mb-3">ABOUT US</p>
                        <h1 className="text-4xl md:text-5xl font-black mb-4">학원/멤버소개</h1>
                        <p className="text-blue-200 text-lg max-w-xl">스티즈 농구교실 다산점의 교육 철학과 전문 코치진을 소개합니다.</p>
                    </AnimateOnScroll>
                </div>
            </section>

            {/* 학원 소개 — 좌 텍스트(원장 인사말) + 우 이미지 분할 레이아웃 */}
            <SectionLayout label="INTRODUCTION" title="원장 인사말" bgColor="white">
                <div className="grid md:grid-cols-2 gap-10 items-start">
                    {/* 좌: 원장 인사말 텍스트 */}
                    <AnimateOnScroll>
                        <div
                            className="rich-content prose prose-gray max-w-none"
                            dangerouslySetInnerHTML={{
                                __html: renderHtml(
                                    settings.introductionText,
                                    "<p>안녕하세요, 스티즈 농구교실 다산점입니다.</p><p>저희 학원은 아이들이 농구를 통해 협동심, 책임감, 그리고 건강한 체력을 기를 수 있도록 최선을 다해 지도하고 있습니다.</p><p>전문 코치진과 체계적인 커리큘럼으로 아이들의 가능성을 이끌어 드리겠습니다.</p>"
                                ),
                            }}
                        />
                    </AnimateOnScroll>

                    {/* 우: "우리의 약속" 핵심 가치 3가지 카드 */}
                    <AnimateOnScroll delay={200}>
                        <div className="space-y-4">
                            <h3 className="text-xl font-bold text-gray-900 mb-4">우리의 약속</h3>
                            {PROMISES.map((item, i) => (
                                <Card key={i} variant="default" className="!p-0">
                                    <div className="flex items-center gap-4 p-4">
                                        {/* 아이콘 원 */}
                                        <div className="w-12 h-12 rounded-full bg-brand-orange-50 flex items-center justify-center text-xl shrink-0">
                                            {item.icon}
                                        </div>
                                        <div>
                                            <p className="font-bold text-gray-900">{item.title}</p>
                                            <p className="text-sm text-gray-500">{item.text}</p>
                                        </div>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    </AnimateOnScroll>
                </div>
            </SectionLayout>

            {/* 교육 이념 — 아이콘 + 텍스트 카드 4개 */}
            {settings.philosophyText ? (
                // DB에 교육 이념 텍스트가 있으면 텍스트 + 카드 둘 다 표시
                <SectionLayout label="PHILOSOPHY" title="교육 이념" bgColor="section">
                    <AnimateOnScroll>
                        <div
                            className="rich-content prose prose-gray max-w-none text-center mb-12"
                            dangerouslySetInnerHTML={{
                                __html: renderHtml(settings.philosophyText, ""),
                            }}
                        />
                    </AnimateOnScroll>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                        {PHILOSOPHY_CARDS.map((card, i) => (
                            <AnimateOnScroll key={i} delay={i * 100}>
                                <Card variant="default" className="text-center !p-0">
                                    <div className="p-5">
                                        {/* 아이콘 배경 원 — 카드 색상에 맞춤 */}
                                        <div className={`w-14 h-14 rounded-full ${card.color} flex items-center justify-center text-2xl mx-auto mb-3`}>
                                            {card.icon}
                                        </div>
                                        <h4 className="font-bold text-gray-900 mb-1">{card.title}</h4>
                                        <p className="text-xs text-gray-500 leading-relaxed">{card.description}</p>
                                    </div>
                                </Card>
                            </AnimateOnScroll>
                        ))}
                    </div>
                </SectionLayout>
            ) : (
                // DB에 교육 이념 텍스트가 없으면 카드만 표시
                <SectionLayout label="PHILOSOPHY" title="교육 이념" description="STIZ 농구교실이 추구하는 가치" bgColor="section">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                        {PHILOSOPHY_CARDS.map((card, i) => (
                            <AnimateOnScroll key={i} delay={i * 100}>
                                <Card variant="default" className="text-center !p-0">
                                    <div className="p-5">
                                        <div className={`w-14 h-14 rounded-full ${card.color} flex items-center justify-center text-2xl mx-auto mb-3`}>
                                            {card.icon}
                                        </div>
                                        <h4 className="font-bold text-gray-900 mb-1">{card.title}</h4>
                                        <p className="text-xs text-gray-500 leading-relaxed">{card.description}</p>
                                    </div>
                                </Card>
                            </AnimateOnScroll>
                        ))}
                    </div>
                </SectionLayout>
            )}

            {/* 코치진 소개 — 확대된 카드형 레이아웃 (가로형 사진 + 정보) */}
            {coaches.length > 0 && (
                <SectionLayout label="COACHES" title="코치진 소개" description="자격증을 보유한 전문 코치진이 지도합니다" bgColor="white">
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {coaches.map((coach, i) => (
                            <AnimateOnScroll key={coach.id} delay={i * 100}>
                                <Card variant="default" className="overflow-hidden !p-0">
                                    {/* 코치 사진 영역 — 가로형 (4:3 비율) */}
                                    <div className="relative aspect-[4/3] bg-gradient-to-br from-brand-navy-900 to-brand-navy-800 overflow-hidden">
                                        {coach.imageUrl ? (
                                            <Image
                                                src={coach.imageUrl}
                                                alt={coach.name}
                                                fill
                                                className="object-cover"
                                                sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                                            />
                                        ) : (
                                            // 사진이 없으면 농구공 아이콘 표시
                                            <div className="w-full h-full flex items-center justify-center text-6xl opacity-30">
                                                🏀
                                            </div>
                                        )}
                                    </div>

                                    {/* 코치 정보 영역 */}
                                    <div className="p-5">
                                        <div className="flex items-center gap-3 mb-2">
                                            <h3 className="text-lg font-bold text-gray-900">{coach.name}</h3>
                                            {/* 역할 뱃지 — Badge 공통 컴포넌트 사용 */}
                                            <Badge variant="default" size="sm">{coach.role}</Badge>
                                        </div>

                                        {/* 한줄 소개 */}
                                        {coach.description && (
                                            <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">
                                                {coach.description}
                                            </p>
                                        )}
                                    </div>
                                </Card>
                            </AnimateOnScroll>
                        ))}
                    </div>
                </SectionLayout>
            )}

            {/* 시설 소개 — 이미지 갤러리 + 시설 특장점 리스트 */}
            {(settings.facilitiesText || facilityImages.length > 0) && (
                <SectionLayout label="FACILITIES" title="시설 소개" description="쾌적하고 안전한 환경에서 수업합니다" bgColor="section">
                    {/* 시설 설명 텍스트 */}
                    {settings.facilitiesText && (
                        <AnimateOnScroll>
                            <div
                                className="rich-content prose prose-gray max-w-none mb-10"
                                dangerouslySetInnerHTML={{
                                    __html: renderHtml(settings.facilitiesText, ""),
                                }}
                            />
                        </AnimateOnScroll>
                    )}

                    {/* 시설 이미지 갤러리 — 반응형 그리드 */}
                    {facilityImages.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {facilityImages.map((url, i) => (
                                <AnimateOnScroll key={i} delay={i * 100}>
                                    <div className="aspect-[4/3] relative rounded-2xl overflow-hidden bg-gray-200 group">
                                        <Image
                                            src={url}
                                            alt={`시설 사진 ${i + 1}`}
                                            fill
                                            className="object-cover transition-transform duration-300 group-hover:scale-105"
                                            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                                        />
                                        {/* 호버 시 어두운 오버레이 — 인터랙션 피드백 */}
                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300 rounded-2xl" />
                                    </div>
                                </AnimateOnScroll>
                            ))}
                        </div>
                    )}
                </SectionLayout>
            )}

            {/* CTA 배너 — Phase 2에서 만든 공통 CTABanner 재사용 */}
            <CTABanner
                title="우리 아이, 농구로 성장시켜 보세요"
                subtitle="전문 코치진과 체계적인 커리큘럼이 기다리고 있습니다"
                phone={phone}
                primaryLabel="체험 수업 신청"
                primaryHref="/apply"
            />
        </PublicPageLayout>
    );
}
