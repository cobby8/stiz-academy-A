import { getPrograms, getAcademySettings } from "@/lib/queries";
import Image from "next/image";
import PublicPageLayout from "@/components/PublicPageLayout";

export const revalidate = 60;
export const metadata = { title: "프로그램 안내 | STIZ 농구교실 다산점", description: "유아·초등·중등 수준별 맞춤 농구 클래스. 주 1~3회, 매일반 선택 가능. 수강료 및 셔틀버스 안내." };

const DAY_OPTIONS: Record<string, string> = {
    Mon: "월", Tue: "화", Wed: "수", Thu: "목", Fri: "금", Sat: "토", Sun: "일",
};
const WEEKEND = new Set(["Sat", "Sun"]);
const DAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

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

function isWeekendOnly(days: string[]): boolean {
    return days.length > 0 && days.every((d) => WEEKEND.has(d));
}

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

export default async function ProgramsPage() {
    const [programs, settings] = await Promise.all([
        getPrograms() as Promise<Program[]>,
        getAcademySettings() as Promise<any>,
    ]);
    const phone = settings.contactPhone || "010-0000-0000";
    const termsOfService: string | null = settings.termsOfService ?? null;

    return (
        <PublicPageLayout>
            {/* Hero */}
            <div className="bg-brand-navy-900 text-white py-14">
                <div className="max-w-4xl mx-auto px-4">
                    <p className="text-brand-orange-500 text-sm font-bold uppercase mb-2">PROGRAMS</p>
                    <h1 className="text-4xl font-black mb-3">프로그램 안내</h1>
                    <p className="text-blue-200">수준과 연령에 맞는 프로그램을 확인하세요.</p>
                </div>
            </div>

            {/* Programs list */}
            <section className="py-14 bg-white">
                <div className="max-w-4xl mx-auto px-4">
                    {programs.length === 0 ? (
                        <div className="text-center py-20 text-gray-400">
                            <div className="text-5xl mb-4">🏀</div>
                            <p className="text-lg font-medium">준비 중입니다.</p>
                            <p className="text-sm mt-2">문의: {phone}</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {programs.map((program, i) => {
                                const days = program.days
                                    ? DAY_ORDER.filter((d) => program.days!.split(",").includes(d))
                                    : [];
                                const weekend = isWeekendOnly(days);
                                const tiers = FREQ_TIERS.filter((t) => program[t.key] != null);
                                const freq = program.weeklyFrequency || program.frequency;

                                return (
                                    <div key={program.id}
                                        className="border border-gray-200 rounded-2xl overflow-hidden hover:shadow-md transition-shadow">
                                        {/* Image */}
                                        {program.imageUrl && (
                                            <div className="relative aspect-[3/1] bg-gray-100">
                                                <Image
                                                    src={program.imageUrl}
                                                    alt={program.name}
                                                    fill
                                                    className="object-cover"
                                                    sizes="(max-width: 768px) 100vw, 768px"
                                                />
                                            </div>
                                        )}
                                        {/* Header */}
                                        <div className="bg-gray-50 px-6 py-4 flex flex-wrap items-center justify-between gap-3 border-b border-gray-200">
                                            <div className="flex items-center gap-3">
                                                <span className="bg-brand-navy-900 text-white text-xs font-black w-7 h-7 rounded-full flex items-center justify-center shrink-0">
                                                    {String(i + 1).padStart(2, "0")}
                                                </span>
                                                <h3 className="text-xl font-bold text-gray-900">{program.name}</h3>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {program.targetAge && (
                                                    <span className="bg-brand-orange-50 text-brand-orange-600 text-xs font-bold px-3 py-1 rounded-full border border-brand-orange-500/30">
                                                        {program.targetAge}
                                                    </span>
                                                )}
                                                {/* Frequency badges */}
                                                {tiers.length === 0 && freq && (
                                                    <span className="bg-blue-100 text-blue-700 text-xs font-bold px-3 py-1 rounded-full">{freq}</span>
                                                )}
                                                {tiers.map((t) => (
                                                    <span key={t.key} className="bg-blue-100 text-blue-700 text-xs font-bold px-3 py-1 rounded-full">{t.label}</span>
                                                ))}
                                                {/* Day badges */}
                                                {days.map((d) => (
                                                    <span key={d} className={`text-xs font-bold px-2.5 py-1 rounded-full ${WEEKEND.has(d) ? "bg-orange-100 text-orange-700" : "bg-gray-100 text-gray-600"}`}>
                                                        {DAY_OPTIONS[d]}요일
                                                    </span>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="p-6 flex flex-col gap-4">
                                            {program.description && (
                                                <p className="text-gray-600 leading-relaxed whitespace-pre-line">{program.description}</p>
                                            )}

                                            {/* Pricing table or single price */}
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
                                                        <p className="text-xs text-gray-400 mb-0.5">월 수강료</p>
                                                        <p className="text-3xl font-black text-brand-navy-900">
                                                            {program.price.toLocaleString()}
                                                            <span className="text-base font-normal text-gray-500">원</span>
                                                        </p>
                                                    </div>
                                                    {weekend ? (
                                                        <p className="text-sm text-orange-600 font-medium">🚌 셔틀 운행 없음</p>
                                                    ) : program.shuttleFeeOverride === 0 ? (
                                                        <p className="text-sm text-gray-400">셔틀 없음</p>
                                                    ) : program.shuttleFeeOverride != null && program.shuttleFeeOverride > 0 ? (
                                                        <p className="text-sm text-blue-600 font-medium">
                                                            🚌 셔틀비 {program.shuttleFeeOverride.toLocaleString()}원
                                                        </p>
                                                    ) : null}
                                                </div>
                                            )}

                                            <div className="flex justify-end">
                                                <a href={`/schedule?program=${program.id}`}
                                                    className="text-sm font-bold text-brand-orange-500 hover:text-orange-600 border border-brand-orange-500/50 hover:border-brand-orange-500 px-3 py-1.5 rounded-lg transition">
                                                    시간표 보기 →
                                                </a>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </section>

            {/* Terms of Service */}
            {termsOfService && (
                <section id="terms" className="py-14 bg-gray-50 scroll-mt-20">
                    <div className="max-w-4xl mx-auto px-4">
                        <h2 className="text-2xl font-black text-brand-navy-900 mb-8 text-center">이용약관</h2>
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
                            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{termsOfService}</p>
                        </div>
                    </div>
                </section>
            )}

            {/* CTA */}
            <section className="bg-brand-orange-500 text-white py-14">
                <div className="max-w-4xl mx-auto px-4 text-center">
                    <h2 className="text-2xl font-black mb-4">수강 신청 및 문의</h2>
                    <p className="text-orange-100 mb-6">궁금한 점은 전화로 문의해 주세요. 친절하게 안내해 드립니다.</p>
                    <a href={`tel:${phone.replace(/-/g, "")}`}
                        className="inline-block bg-white text-brand-orange-500 font-black text-lg px-10 py-4 rounded-xl hover:bg-orange-50 transition shadow">
                        📞 {phone}
                    </a>
                </div>
            </section>
        </PublicPageLayout>
    );
}
