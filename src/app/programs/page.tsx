import { getPrograms, getAcademySettings } from "@/app/actions/admin";
import PublicPageLayout from "@/components/PublicPageLayout";

export const metadata = { title: "프로그램·수강료 안내 | STIZ 농구교실 다산점" };

const FREQ_COLORS: Record<string, string> = {
    "주 1회": "bg-green-100 text-green-700",
    "주 2회": "bg-blue-100 text-blue-700",
    "주 3회": "bg-purple-100 text-purple-700",
};

export default async function ProgramsPage() {
    const programs = await getPrograms();
    const settings = await getAcademySettings() as any;
    const phone = settings.contactPhone || "010-0000-0000";

    return (
        <PublicPageLayout>
            {/* Page Hero */}
            <div className="bg-brand-navy-900 text-white py-14">
                <div className="max-w-4xl mx-auto px-4">
                    <p className="text-brand-orange-500 text-sm font-bold uppercase mb-2">PROGRAMS</p>
                    <h1 className="text-4xl font-black mb-3">프로그램 안내</h1>
                    <p className="text-blue-200">수준과 연령에 맞는 프로그램을 확인하세요.</p>
                </div>
            </div>

            {/* Programs List */}
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
                            {programs.map((program, i) => (
                                <div
                                    key={program.id}
                                    className="border border-gray-200 rounded-2xl overflow-hidden hover:shadow-md transition-shadow"
                                >
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
                                            {program.frequency && (
                                                <span className={`text-xs font-bold px-3 py-1 rounded-full ${FREQ_COLORS[program.frequency] || "bg-gray-100 text-gray-600"}`}>
                                                    {program.frequency}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="p-6 flex flex-col sm:flex-row gap-6 items-start sm:items-center justify-between">
                                        {program.description ? (
                                            <p className="text-gray-600 leading-relaxed flex-1">{program.description}</p>
                                        ) : (
                                            <p className="text-gray-400 text-sm flex-1">상세 설명은 문의해 주세요.</p>
                                        )}
                                        <div className="shrink-0 text-right">
                                            <p className="text-xs text-gray-400 mb-1">월 수강료</p>
                                            <p className="text-3xl font-black text-brand-navy-900">
                                                {program.price.toLocaleString()}
                                                <span className="text-base font-normal text-gray-500">원</span>
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </section>

            {/* Tuition Info Anchor */}
            <section id="tuition" className="py-14 bg-gray-50 scroll-mt-20">
                <div className="max-w-4xl mx-auto px-4">
                    <h2 className="text-2xl font-black text-brand-navy-900 mb-8 text-center">수강료 안내</h2>

                    {programs.length > 0 ? (
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-brand-navy-900 text-white">
                                    <tr>
                                        <th className="px-5 py-4 text-left font-bold">프로그램</th>
                                        <th className="px-5 py-4 text-left font-bold">대상</th>
                                        <th className="px-5 py-4 text-left font-bold">수업 빈도</th>
                                        <th className="px-5 py-4 text-right font-bold">월 수강료</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {programs.map((program) => (
                                        <tr key={program.id} className="hover:bg-gray-50">
                                            <td className="px-5 py-4 font-medium text-gray-900">{program.name}</td>
                                            <td className="px-5 py-4 text-gray-600">{program.targetAge || "-"}</td>
                                            <td className="px-5 py-4 text-gray-600">{program.frequency || "-"}</td>
                                            <td className="px-5 py-4 text-right font-bold text-brand-navy-900">
                                                {program.price.toLocaleString()}원
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="bg-white rounded-2xl p-10 text-center text-gray-400 border border-gray-200">
                            수강료 정보를 준비 중입니다.
                        </div>
                    )}

                    <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700">
                        <p className="font-bold mb-1">📌 수강료 안내 사항</p>
                        <ul className="space-y-1 text-blue-600">
                            <li>• 수강료는 매월 초에 납부하셔야 합니다.</li>
                            <li>• 형제·자매 등록 시 할인 혜택이 있습니다. 문의해 주세요.</li>
                            <li>• 체험 수업은 무료로 진행됩니다.</li>
                        </ul>
                    </div>
                </div>
            </section>

            {/* CTA */}
            <section className="bg-brand-orange-500 text-white py-14">
                <div className="max-w-4xl mx-auto px-4 text-center">
                    <h2 className="text-2xl font-black mb-4">수강 신청 및 문의</h2>
                    <p className="text-orange-100 mb-6">궁금한 점은 전화로 문의해 주세요. 친절하게 안내해 드립니다.</p>
                    <a
                        href={`tel:${phone.replace(/-/g, "")}`}
                        className="inline-block bg-white text-brand-orange-500 font-black text-lg px-10 py-4 rounded-xl hover:bg-orange-50 transition shadow"
                    >
                        📞 {phone}
                    </a>
                </div>
            </section>
        </PublicPageLayout>
    );
}
