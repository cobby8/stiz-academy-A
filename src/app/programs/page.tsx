import { getPrograms, getAcademySettings } from "@/lib/queries";
import Image from "next/image";
import PublicPageLayout from "@/components/PublicPageLayout";
import SectionLayout from "@/components/ui/SectionLayout";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import AnimateOnScroll from "@/components/ui/AnimateOnScroll";
import CTABanner from "@/components/landing/CTABanner";
import ProgramAccordionTerms from "./ProgramAccordionTerms";

export const revalidate = 60;
export const metadata = { title: "프로그램 안내 | STIZ 농구교실 다산점", description: "유아·초등·중등 수준별 맞춤 농구 클래스. 주 1~3회, 매일반 선택 가능. 수강료 및 셔틀버스 안내." };

// 요일 한글 매핑
const DAY_OPTIONS: Record<string, string> = {
    Mon: "월", Tue: "화", Wed: "수", Thu: "목", Fri: "금", Sat: "토", Sun: "일",
};
const WEEKEND = new Set(["Sat", "Sun"]);
const DAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// 수강 빈도별 가격 키와 셔틀비 매핑
const FREQ_TIERS = [
    { key: "priceWeek1" as const, label: "주 1회", autoShuttle: 10000 },
    { key: "priceWeek2" as const, label: "주 2회", autoShuttle: 15000 },
    { key: "priceWeek3" as const, label: "주 3회", autoShuttle: 20000 },
    { key: "priceDaily" as const, label: "매일반", autoShuttle: 20000 },
];

type Program = {
    id: string;
    name: string;
    targetAge: string | null;
    weeklyFrequency: string | null;
    frequency: string | null;
    description: string | null;
    price: number;
    days: string | null;
    priceWeek1: number | null;
    priceWeek2: number | null;
    priceWeek3: number | null;
    priceDaily: number | null;
    shuttleFeeOverride: number | null;
    imageUrl: string | null;
};

// 주말 전용 프로그램인지 판별
function isWeekendOnly(days: string[]): boolean {
    return days.length > 0 && days.every((d) => WEEKEND.has(d));
}

// 셔틀비 표시 문자열 생성
function getShuttleFeeDisplay(
    shuttleFeeOverride: number | null | undefined,
    freqKey: typeof FREQ_TIERS[number]["key"],
    weekend: boolean,
): string | null {
    if (weekend) return null;
    if (shuttleFeeOverride === 0) return null;
    if (shuttleFeeOverride != null && shuttleFeeOverride > 0)
        return shuttleFeeOverride.toLocaleString() + "원";
    const tier = FREQ_TIERS.find((t) => t.key === freqKey);
    return tier ? tier.autoShuttle.toLocaleString() + "원" : null;
}

// 대상 연령에 따른 색상 매핑 — 한눈에 구분되게
function getAgeColor(targetAge: string | null): { bg: string; text: string; border: string } {
    if (!targetAge) return { bg: "bg-gray-50", text: "text-gray-600", border: "border-gray-200" };
    const age = targetAge.toLowerCase();
    if (age.includes("유아") || age.includes("미취학")) return { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" };
    if (age.includes("초등") && (age.includes("저") || age.includes("1") || age.includes("2") || age.includes("3")))
        return { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" };
    if (age.includes("초등")) return { bg: "bg-sky-50", text: "text-sky-700", border: "border-sky-200" };
    if (age.includes("중등") || age.includes("중학")) return { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" };
    return { bg: "bg-gray-50", text: "text-gray-600", border: "border-gray-200" };
}

export default async function ProgramsPage() {
    const [programs, settings] = await Promise.all([
        getPrograms() as Promise<Program[]>,
        getAcademySettings() as Promise<any>,
    ]);
    const phone = settings.contactPhone || "010-0000-0000";
    const termsOfService: string | null = settings.termsOfService ?? null;

    return (
        <PublicPageLayout>
            {/* 페이지 히어로 — 그라데이션 배경 + 장식 요소 */}
            <section className="relative overflow-hidden bg-gradient-to-br from-brand-navy-900 via-brand-navy-800 to-brand-navy-900 text-white py-16 md:py-20">
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute right-0 top-0 w-72 h-72 border-[20px] border-white/5 rounded-full translate-x-1/3 -translate-y-1/3" />
                    <div className="absolute left-0 bottom-0 w-48 h-48 border-[15px] border-brand-orange-500/10 rounded-full -translate-x-1/4 translate-y-1/4" />
                </div>
                <div className="max-w-6xl mx-auto px-4 relative">
                    <AnimateOnScroll>
                        <p className="text-brand-orange-500 text-sm font-bold uppercase tracking-widest mb-3">PROGRAMS</p>
                        <h1 className="text-4xl md:text-5xl font-black mb-4">프로그램 안내</h1>
                        <p className="text-blue-200 text-lg max-w-xl">수준과 연령에 맞는 최적의 프로그램을 찾아보세요.</p>
                    </AnimateOnScroll>
                </div>
            </section>

            {/* 프로그램 목록 — 세로 카드(이미지 상단 + 정보 하단) 구조 */}
            <SectionLayout label="CLASSES" title="수업 안내" description="연령과 수준에 맞춘 체계적인 프로그램" bgColor="white">
                {programs.length === 0 ? (
                    <div className="text-center py-20 text-gray-400">
                        <div className="text-5xl mb-4">🏀</div>
                        <p className="text-lg font-medium">준비 중입니다.</p>
                        <p className="text-sm mt-2">문의: {phone}</p>
                    </div>
                ) : (
                    <div className="grid md:grid-cols-2 gap-6">
                        {programs.map((program, i) => {
                            const days = program.days
                                ? DAY_ORDER.filter((d) => program.days!.split(",").includes(d))
                                : [];
                            const weekend = isWeekendOnly(days);
                            const tiers = FREQ_TIERS.filter((t) => program[t.key] != null);
                            const freq = program.weeklyFrequency || program.frequency;
                            const ageColor = getAgeColor(program.targetAge);

                            return (
                                <AnimateOnScroll key={program.id} delay={(i % 2) * 150}>
                                    <Card variant="default" className={`overflow-hidden !p-0 border-t-4 ${ageColor.border}`}>
                                        {/* 프로그램 이미지 */}
                                        {program.imageUrl && (
                                            <div className="relative aspect-[3/1] bg-gray-100 overflow-hidden">
                                                <Image
                                                    src={program.imageUrl}
                                                    alt={program.name}
                                                    fill
                                                    className="object-cover"
                                                    sizes="(max-width: 768px) 100vw, 50vw"
                                                />
                                            </div>
                                        )}

                                        {/* 프로그램 헤더 — 이름 + 뱃지들 */}
                                        <div className="px-5 pt-5 pb-3">
                                            <div className="flex flex-wrap items-center gap-2 mb-2">
                                                <h3 className="text-xl font-bold text-gray-900">{program.name}</h3>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {/* 대상 연령 뱃지 */}
                                                {program.targetAge && (
                                                    <span className={`${ageColor.bg} ${ageColor.text} text-xs font-bold px-3 py-1 rounded-full`}>
                                                        {program.targetAge}
                                                    </span>
                                                )}
                                                {/* 수강 빈도 뱃지 */}
                                                {tiers.length === 0 && freq && (
                                                    <Badge variant="info" size="sm">{freq}</Badge>
                                                )}
                                                {tiers.map((t) => (
                                                    <Badge key={t.key} variant="info" size="sm">{t.label}</Badge>
                                                ))}
                                                {/* 수업 요일 뱃지 */}
                                                {days.map((d) => (
                                                    <span key={d} className={`text-xs font-bold px-2.5 py-1 rounded-full ${WEEKEND.has(d) ? "bg-orange-100 text-orange-700" : "bg-gray-100 text-gray-600"}`}>
                                                        {DAY_OPTIONS[d]}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>

                                        {/* 프로그램 설명 */}
                                        {program.description && (
                                            <div className="px-5 pb-3">
                                                <p className="text-gray-600 text-base leading-relaxed whitespace-pre-line">{program.description}</p>
                                            </div>
                                        )}

                                        {/* 수강료 — 다단 가격표 또는 단일 가격 */}
                                        <div className="px-5 pb-5">
                                            {tiers.length > 0 ? (
                                                <div className="overflow-hidden rounded-xl border border-gray-200">
                                                    <table className="w-full text-sm">
                                                        <thead className="bg-brand-navy-900 text-white">
                                                            <tr>
                                                                <th className="px-4 py-2.5 text-left font-bold">수업 빈도</th>
                                                                <th className="px-4 py-2.5 text-right font-bold">월 수강료</th>
                                                                <th className="px-4 py-2.5 text-right font-bold">셔틀비</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-gray-100">
                                                            {tiers.map((t) => {
                                                                const fee = getShuttleFeeDisplay(program.shuttleFeeOverride, t.key, weekend);
                                                                return (
                                                                    <tr key={t.key} className="hover:bg-gray-50">
                                                                        <td className="px-4 py-3 font-semibold text-gray-800">{t.label}</td>
                                                                        <td className="px-4 py-3 text-right font-bold text-brand-navy-900">
                                                                            {Number(program[t.key]).toLocaleString()}원
                                                                        </td>
                                                                        <td className="px-4 py-3 text-right text-blue-600 font-medium">
                                                                            {fee ? fee : <span className="text-gray-400 font-normal">운행 없음</span>}
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            ) : (
                                                <div className="flex flex-wrap items-center gap-6">
                                                    <div>
                                                        <p className="text-sm text-gray-400 mb-0.5">월 수강료</p>
                                                        <p className="text-3xl font-black text-brand-navy-900">
                                                            {program.price.toLocaleString()}
                                                            <span className="text-base font-normal text-gray-500">원</span>
                                                        </p>
                                                    </div>
                                                    {weekend ? (
                                                        <p className="text-sm text-orange-600 font-medium">셔틀 운행 없음</p>
                                                    ) : program.shuttleFeeOverride === 0 ? (
                                                        <p className="text-sm text-gray-400">셔틀 없음</p>
                                                    ) : program.shuttleFeeOverride != null && program.shuttleFeeOverride > 0 ? (
                                                        <p className="text-sm text-blue-600 font-medium">
                                                            셔틀비 {program.shuttleFeeOverride.toLocaleString()}원
                                                        </p>
                                                    ) : null}
                                                </div>
                                            )}

                                            {/* 시간표 보기 링크 */}
                                            <div className="flex justify-end mt-4">
                                                <a href={`/schedule?program=${program.id}`}
                                                    className="text-sm font-bold text-brand-orange-500 hover:text-orange-600 border border-brand-orange-500/50 hover:border-brand-orange-500 px-4 py-2 rounded-xl transition-all duration-200 hover:scale-[1.02]">
                                                    시간표 보기 →
                                                </a>
                                            </div>
                                        </div>
                                    </Card>
                                </AnimateOnScroll>
                            );
                        })}
                    </div>
                )}
            </SectionLayout>

            {/* 이용약관 — Accordion(접기) 방식으로 변경 */}
            {termsOfService && (
                <SectionLayout bgColor="section">
                    <AnimateOnScroll>
                        <ProgramAccordionTerms termsText={termsOfService} />
                    </AnimateOnScroll>
                </SectionLayout>
            )}

            {/* CTA 배너 — 공통 CTABanner 재사용 */}
            <CTABanner
                title="수강 신청 및 문의"
                subtitle="궁금한 점은 전화로 문의해 주세요. 친절하게 안내해 드립니다."
                phone={phone}
                primaryLabel="체험 수업 신청"
                primaryHref="/apply"
            />
        </PublicPageLayout>
    );
}
