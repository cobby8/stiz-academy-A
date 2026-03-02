"use client";

import { MapPin } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { Editor, Frame } from "@craftjs/core";
import { ContainerNode, TextNode, ImageNode, ProgramsWidget, ScheduleWidget, CoachesWidget } from "@/components/builder/nodes";
import { LandingPageDataContext } from "@/components/builder/LandingPageDataContext";
import lz from "lzutf8";

export default function LandingPageClient({
    initialSettings,
    programs,
    classes,
    displayCoaches,
    daysInfo
}: {
    initialSettings: any,
    programs: any[],
    classes: any[],
    displayCoaches: any[],
    daysInfo: any[]
}) {
    const settings = initialSettings || {};

    let defaultJson = "";
    if (settings.pageDesignJSON) {
        try {
            defaultJson = lz.decompress(lz.decodeBase64(settings.pageDesignJSON));
        } catch (e) {
            console.error("Failed to parse design JSON");
        }
    }

    return (
        <div className="min-h-screen bg-gray-50 text-gray-900 selection:bg-brand-orange-500 selection:text-white pb-20">

            {/* Top Utility Bar */}
            <div className="bg-brand-navy-900 text-white text-xs py-2 hidden md:block">
                <div className="max-w-6xl mx-auto px-4 flex justify-between items-center">
                    <span>{settings.contactPhone ? `상담문의: ${settings.contactPhone}` : "평일 13:00~21:00 / 토 09:00~18:00 (일요일, 공휴일 휴무)"}</span>
                    <div className="flex gap-4">
                        <Link href="/login" className="hover:text-brand-orange-500 transition">회원가입/로그인</Link>
                    </div>
                </div>
            </div>

            {/* Main Navigation */}
            <header className="bg-white sticky top-0 z-50 shadow-sm border-b border-gray-100">
                <div className="max-w-6xl mx-auto px-4 py-4 md:py-5 flex items-center justify-between">
                    <Link href="/" className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 leading-none">
                        <Image src="/stiz-logo.png" alt="STIZ" width={220} height={55} className="h-12 sm:h-14 w-auto object-contain" priority />
                        <span className="font-extrabold text-2xl text-brand-navy-900 tracking-tight sm:ml-1 mt-1">다산점</span>
                    </Link>

                    {/* Desktop Nav */}
                    <nav className="hidden md:flex items-center gap-8 font-bold text-gray-700">
                        <Link href="#about" className="hover:text-brand-orange-500 transition">학원소개</Link>
                        <Link href="#programs" className="hover:text-brand-orange-500 transition">프로그램안내</Link>
                        <Link href="#schedule" className="hover:text-brand-orange-500 transition">시간표/수강료</Link>
                        <Link href="/login" className="hover:text-brand-orange-500 transition">스마트출결</Link>
                    </nav>

                    {/* Action Button */}
                    <div className="flex items-center gap-3">
                        <Link href="/login" className="bg-brand-navy-900 text-white px-5 py-2.5 rounded text-sm font-bold hover:bg-blue-900 transition-colors shadow-sm hidden sm:inline-block">
                            학부모 마이페이지
                        </Link>
                    </div>
                </div>
            </header>

            {/* MAIN CONTENT = Craft.js Dynamic Visual Builder Frame */}
            <main className="w-full bg-white min-h-[800px]">
                {!defaultJson ? (
                    <div className="py-32 text-center flex flex-col items-center justify-center">
                        <h2 className="text-2xl font-bold text-gray-400 mb-4">학원 홈페이지가 준비 중입니다.</h2>
                        <p className="text-gray-500">관리자 페이지에서 디자인 빌더를 통해 콘텐츠를 구성해주세요.</p>
                    </div>
                ) : (
                    <LandingPageDataContext.Provider value={{ programs, classes, displayCoaches, daysInfo, isEditor: false }}>
                        <Editor resolver={{ ContainerNode, TextNode, ImageNode, ProgramsWidget, ScheduleWidget, CoachesWidget }} enabled={false}>
                            <Frame data={defaultJson}>
                                {/* Backup element if empty string but won't be used since data is passed */}
                                <div />
                            </Frame>
                        </Editor>
                    </LandingPageDataContext.Provider>
                )}
            </main>

            {/* Footer */}
            <footer className="bg-gray-900 text-gray-300 pt-16 pb-8 border-t-8 border-brand-orange-500 w-full mt-20">
                <div className="max-w-6xl mx-auto px-4">
                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
                        <div className="col-span-1 lg:col-span-2">
                            <div className="flex items-center gap-4 mb-8">
                                <div className="bg-white px-4 py-3 rounded-xl inline-flex items-center justify-center">
                                    <Image src="/stiz-logo.png" alt="STIZ BASKETBALL CLUB" width={180} height={45} className="h-10 sm:h-12 w-auto object-contain" />
                                </div>
                                <span className="font-extrabold text-2xl text-white">다산점</span>
                            </div>
                            <p className="text-gray-400 mb-6 text-sm leading-relaxed max-w-sm">
                                아이들이 농구를 통해 협동심과 건강한 체력을 기를 수 있도록 최선을 다해 지도합니다. 스마트 학원 관리 시스템을 통해 학부모님과 투명하게 소통합니다.
                            </p>
                        </div>

                        <div>
                            <h4 className="text-white font-bold mb-4">학원 정보</h4>
                            <ul className="space-y-2 text-sm text-gray-400">
                                <li className="flex items-start gap-2">
                                    <MapPin className="w-4 h-4 mt-0.5 text-gray-500 shrink-0" />
                                    <span>{settings.address || "경기도 남양주시 다산동 스티즈 체육관"}</span>
                                </li>
                                <li className="flex items-center gap-2">
                                    <svg className="w-4 h-4 text-gray-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                                    <span>상담문의: {settings.contactPhone || "010-0000-0000"}</span>
                                </li>
                            </ul>
                        </div>

                        <div>
                            <h4 className="text-white font-bold mb-4">바로가기</h4>
                            <ul className="space-y-2 text-sm text-gray-400">
                                <li><Link href="/login" className="hover:text-brand-orange-500">학부모 로그인</Link></li>
                                <li><Link href="/signup" className="hover:text-brand-orange-500">원생 가입안내</Link></li>
                                <li><Link href="/login" className="hover:text-gray-100">원장님 로그인 (관리자)</Link></li>
                                <li><Link href="#" className="hover:text-gray-100">개인정보처리방침</Link></li>
                            </ul>
                        </div>
                    </div>

                    <div className="pt-8 border-t border-gray-800 text-center text-sm text-gray-500">
                        <p>© 2026 STIZ Basketball Academy. All rights reserved.</p>
                    </div>
                </div>
            </footer>
        </div>
    );
}
