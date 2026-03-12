"use client";

import Link from "next/link";
import Image from "next/image";
import { MapPin, Phone, Calendar, Clock, Users, Award, ChevronRight } from "lucide-react";


export default function LandingPageClient({
    initialSettings,
}: {
    initialSettings: any;
}) {
    const settings = initialSettings || {};
    const phone = settings.contactPhone || "010-0000-0000";
    const address = settings.address || "";

    return (
        <div className="min-h-screen bg-white text-gray-900">

            {/* Top Utility Bar */}
            <div className="bg-brand-navy-900 text-white text-xs py-2 hidden md:block">
                <div className="max-w-6xl mx-auto px-4 flex justify-between items-center">
                    <span className="text-gray-300">평일 13:00~21:00 / 토 09:00~18:00 (일요일·공휴일 휴무)</span>
                    <span>상담문의: {phone}</span>
                </div>
            </div>

            {/* Navigation */}
            <header className="bg-white sticky top-0 z-50 shadow-sm border-b border-gray-100">
                <div className="max-w-6xl mx-auto px-4 py-3 md:py-4 flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-2 sm:gap-3">
                        <Image src="/stiz-logo.png" alt="STIZ" width={180} height={45} className="h-10 sm:h-12 w-auto object-contain" priority />
                        <span className="font-extrabold text-lg sm:text-xl text-brand-navy-900">다산점</span>
                    </Link>

                    <nav className="hidden md:flex items-center gap-6 font-bold text-sm text-gray-700">
                        <Link href="/about" className="hover:text-brand-orange-500 transition-colors">학원/멤버소개</Link>
                        <Link href="/programs" className="hover:text-brand-orange-500 transition-colors">프로그램안내</Link>
                        <Link href="/schedule" className="hover:text-brand-orange-500 transition-colors">수업시간표</Link>
                        <Link href="/annual" className="hover:text-brand-orange-500 transition-colors">연간일정표</Link>
                        <Link href="/apply" className="hover:text-brand-orange-500 transition-colors">체험/수강신청</Link>
                    </nav>

                    <a
                        href={`tel:${phone.replace(/-/g, "")}`}
                        className="bg-brand-orange-500 hover:bg-orange-600 text-white font-bold px-4 py-2 rounded-lg text-sm transition-colors shadow-sm"
                    >
                        📞 전화문의
                    </a>
                </div>

                {/* Mobile Nav */}
                <nav className="md:hidden flex overflow-x-auto gap-1 px-4 pb-3 text-sm font-bold border-t border-gray-100">
                    {[
                        { href: "/about", label: "학원/멤버소개" },
                        { href: "/programs", label: "프로그램" },
                        { href: "/schedule", label: "수업시간표" },
                        { href: "/annual", label: "연간일정" },
                        { href: "/apply", label: "체험/수강신청" },
                    ].map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className="shrink-0 px-3 py-1.5 rounded-full text-gray-600 hover:bg-gray-100 hover:text-brand-navy-900 transition-colors whitespace-nowrap"
                        >
                            {item.label}
                        </Link>
                    ))}
                </nav>
            </header>

            {/* Hero Section */}
            <section className="bg-gradient-to-br from-brand-navy-900 via-blue-900 to-blue-800 text-white py-20 md:py-32 relative overflow-hidden">
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute right-0 top-0 w-[500px] h-[500px] border-[40px] border-white/5 rounded-full translate-x-1/3 -translate-y-1/3"></div>
                    <div className="absolute left-0 bottom-0 w-80 h-80 border-[30px] border-brand-orange-500/20 rounded-full -translate-x-1/3 translate-y-1/3"></div>
                    <div className="absolute right-1/4 bottom-1/4 w-32 h-32 bg-brand-orange-500/10 rounded-full blur-xl"></div>
                </div>

                <div className="max-w-6xl mx-auto px-4 relative">
                    <div className="max-w-2xl">
                        <div className="inline-block bg-brand-orange-500 text-white text-xs font-bold px-4 py-1.5 rounded-full mb-6 uppercase tracking-wider shadow">
                            다산신도시 No.1 농구 전문 학원
                        </div>
                        <h1 className="text-4xl md:text-6xl font-black mb-6 leading-tight tracking-tight">
                            {settings.introductionTitle || "스티즈 농구교실"}
                        </h1>
                        {/* introductionText: Tiptap HTML이면 그대로, plain text면 <br>로 변환 */}
                        <div
                            className="text-blue-100 text-lg mb-10 leading-relaxed max-w-xl [&_strong]:font-bold [&_em]:italic [&_p]:mb-1.5 [&_h1]:text-2xl [&_h1]:font-black [&_h2]:text-xl [&_h2]:font-bold [&_h3]:text-lg [&_h3]:font-bold"
                            dangerouslySetInnerHTML={{
                                __html: (() => {
                                    const t = settings.introductionText;
                                    if (!t) return "아이들이 농구를 통해 협동심과 건강한 체력을 기를 수 있도록 최선을 다해 지도합니다.";
                                    if (t.includes("<")) return t;
                                    return t.replace(/\n/g, "<br>");
                                })()
                            }}
                        />
                        <div className="flex flex-wrap gap-4">
                            <a
                                href={`tel:${phone.replace(/-/g, "")}`}
                                className="bg-brand-orange-500 hover:bg-orange-600 text-white font-bold px-8 py-4 rounded-xl transition-colors shadow-lg text-base"
                            >
                                {phone} 상담전화
                            </a>
                            <Link
                                href="/programs"
                                className="bg-white/10 hover:bg-white/20 text-white font-bold px-8 py-4 rounded-xl transition-colors border border-white/30 text-base"
                            >
                                프로그램 보기
                            </Link>
                        </div>
                    </div>
                </div>
            </section>

            {/* Quick Navigation Cards */}
            <section className="py-12 md:py-16 bg-gray-50">
                <div className="max-w-6xl mx-auto px-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                        {[
                            {
                                icon: <Award className="w-7 h-7" />,
                                title: "학원/멤버소개",
                                desc: "코치진·시설·특장점",
                                href: "/about",
                                bg: "bg-blue-50",
                                color: "text-blue-700",
                            },
                            {
                                icon: <Users className="w-7 h-7" />,
                                title: "프로그램안내",
                                desc: "수준별 맞춤 클래스",
                                href: "/programs",
                                bg: "bg-orange-50",
                                color: "text-brand-orange-500",
                            },
                            {
                                icon: <Clock className="w-7 h-7" />,
                                title: "수업시간표",
                                desc: "요일별 수업 시간",
                                href: "/schedule",
                                bg: "bg-green-50",
                                color: "text-green-700",
                            },
                            {
                                icon: <Calendar className="w-7 h-7" />,
                                title: "연간일정표",
                                desc: "대회·방학·행사 일정",
                                href: "/annual",
                                bg: "bg-purple-50",
                                color: "text-purple-700",
                            },
                        ].map((card) => (
                            <Link
                                key={card.href}
                                href={card.href}
                                className="bg-white rounded-2xl p-5 md:p-6 shadow-sm border border-gray-100 hover:shadow-md hover:-translate-y-1 transition-all group text-center"
                            >
                                <div className={`${card.bg} ${card.color} w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform`}>
                                    {card.icon}
                                </div>
                                <h3 className="font-bold text-gray-900 text-sm md:text-base mb-1">{card.title}</h3>
                                <p className="text-xs text-gray-500 hidden md:block">{card.desc}</p>
                                <div className="mt-2 text-brand-orange-500 text-xs font-bold flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    자세히 보기 <ChevronRight className="w-3 h-3" />
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            </section>

            {/* YouTube Video Section */}
            {settings.youtubeUrl && (() => {
                const url = settings.youtubeUrl as string;
                const match = url.match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{11})/);
                const videoId = match?.[1];
                if (!videoId) return null;
                return (
                    <section className="py-12 md:py-16 bg-white">
                        <div className="max-w-4xl mx-auto px-4">
                            <div className="rounded-2xl overflow-hidden shadow-lg border border-gray-200 aspect-video">
                                <iframe
                                    src={`https://www.youtube.com/embed/${videoId}?rel=0`}
                                    title="STIZ 농구교실 소개"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    allowFullScreen
                                    className="w-full h-full"
                                />
                            </div>
                        </div>
                    </section>
                );
            })()}

            {/* CTA Banner */}
            <section className="bg-brand-orange-500 py-16 text-white">
                <div className="max-w-4xl mx-auto px-4 text-center">
                    <h2 className="text-3xl font-black mb-4">수강 문의 및 체험 수업 신청</h2>
                    <p className="text-orange-100 mb-8 text-lg">
                        아이에게 딱 맞는 클래스를 찾아드립니다. 지금 바로 문의해 주세요.
                    </p>
                    <a
                        href={`tel:${phone.replace(/-/g, "")}`}
                        className="inline-block bg-white text-brand-orange-500 font-black text-xl px-12 py-4 rounded-2xl hover:bg-orange-50 transition shadow-lg"
                    >
                        📞 {phone}
                    </a>
                </div>
            </section>

            {/* Footer */}
            <footer className="bg-gray-900 text-gray-300 pt-12 pb-8 border-t-4 border-brand-orange-500">
                <div className="max-w-6xl mx-auto px-4">
                    <div className="grid md:grid-cols-3 gap-8 mb-8">
                        <div>
                            <div className="bg-white px-4 py-2.5 rounded-lg inline-flex items-center justify-center mb-4">
                                <Image src="/stiz-logo.png" alt="STIZ" width={140} height={35} className="h-9 w-auto object-contain" />
                            </div>
                            <p className="text-sm text-gray-400 leading-relaxed">
                                아이들이 농구를 통해 협동심과<br />건강한 체력을 기를 수 있도록 지도합니다.
                            </p>
                        </div>

                        <div>
                            <h4 className="text-white font-bold mb-4">학원 정보</h4>
                            <ul className="space-y-2 text-sm text-gray-400">
                                {address && (
                                    <li className="flex items-start gap-2">
                                        <MapPin className="w-4 h-4 mt-0.5 text-gray-500 shrink-0" />
                                        <span>{address}</span>
                                    </li>
                                )}
                                <li className="flex items-center gap-2">
                                    <Phone className="w-4 h-4 text-gray-500 shrink-0" />
                                    <span>{phone}</span>
                                </li>
                                <li className="text-xs text-gray-500 mt-1">평일 13:00~21:00 / 토 09:00~18:00</li>
                            </ul>
                        </div>

                        <div>
                            <h4 className="text-white font-bold mb-4">바로가기</h4>
                            <ul className="space-y-2 text-sm text-gray-400">
                                <li><Link href="/about" className="hover:text-white transition-colors">학원/멤버소개</Link></li>
                                <li><Link href="/programs" className="hover:text-white transition-colors">프로그램안내</Link></li>
                                <li><Link href="/schedule" className="hover:text-white transition-colors">수업시간표</Link></li>
                                <li><Link href="/annual" className="hover:text-white transition-colors">연간일정표</Link></li>
                                <li><Link href="/apply" className="hover:text-white transition-colors">체험/수강신청</Link></li>
                            </ul>
                        </div>
                    </div>

                    <div className="border-t border-gray-800 pt-6 text-center text-xs text-gray-500">
                        <p>© 2026 STIZ Basketball Academy. All rights reserved.</p>
                    </div>
                </div>
            </footer>
        </div>
    );
}
