import Link from "next/link";
import Image from "next/image";
import { MapPin, Phone } from "lucide-react";
import { getAcademySettings } from "@/lib/queries";

export default async function PublicPageLayout({ children }: { children: React.ReactNode }) {
    const settings = await getAcademySettings();
    const phone = (settings as any).contactPhone || "010-0000-0000";
    const address = (settings as any).address || "";

    return (
        <div className="min-h-screen bg-white text-gray-900 flex flex-col">
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
                        <Link href="/about" className="hover:text-brand-orange-500 transition-colors">학원소개</Link>
                        <Link href="/programs" className="hover:text-brand-orange-500 transition-colors">프로그램안내</Link>
                        <Link href="/schedule" className="hover:text-brand-orange-500 transition-colors">수업시간표</Link>
                        <Link href="/annual" className="hover:text-brand-orange-500 transition-colors">연간일정표</Link>
                    </nav>

                    <a
                        href={`tel:${phone.replace(/-/g, "")}`}
                        className="bg-brand-orange-500 hover:bg-orange-600 text-white font-bold px-4 py-2 rounded-lg text-sm transition-colors shadow-sm"
                    >
                        📞 전화문의
                    </a>
                </div>

                {/* Mobile Nav */}
                <nav className="md:hidden flex overflow-x-auto gap-1 px-4 pb-3 text-sm font-bold">
                    {[
                        { href: "/about", label: "학원소개" },
                        { href: "/programs", label: "프로그램" },
                        { href: "/schedule", label: "수업시간표" },
                        { href: "/annual", label: "연간일정" },
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

            {/* Page Content */}
            <main className="flex-1">
                {children}
            </main>

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
                                <li><Link href="/about" className="hover:text-white transition-colors">학원소개</Link></li>
                                <li><Link href="/programs" className="hover:text-white transition-colors">프로그램안내</Link></li>
                                <li><Link href="/schedule" className="hover:text-white transition-colors">수업시간표</Link></li>
                                <li><Link href="/annual" className="hover:text-white transition-colors">연간일정표</Link></li>
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
