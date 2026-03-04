"use client";

import { useState } from "react";
import ConfirmSubmitButton from "./ConfirmSubmitButton";
import { updateAcademySettings, createCoach, deleteCoach } from "@/app/actions/admin";
import { BODY_FONT_OPTIONS, HEADING_FONT_OPTIONS, type FontOption } from "@/lib/fonts";
import dynamic from "next/dynamic";

// Craft.js imports
import { Editor, Frame, Element } from "@craftjs/core";
import { ContainerNode, TextNode, ImageNode, ProgramsWidget, ScheduleWidget, CoachesWidget } from "@/components/builder/nodes";
import { HeaderFooterWidget } from "@/components/builder/nodes/HeaderFooterWidget";
import { Topbar } from "@/components/builder/Topbar";
import { Toolbox } from "@/components/builder/Toolbox";
import { SettingsPanel } from "@/components/builder/SettingsPanel";
import { LandingPageDataContext } from "@/components/builder/LandingPageDataContext";
import lz from "lzutf8";

// RichTextEditor는 SSR 불가 → dynamic import
const RichTextEditor = dynamic(() => import("@/components/RichTextEditor"), {
    ssr: false,
    loading: () => <div className="border border-gray-300 rounded-md p-4 min-h-[150px] bg-gray-50 flex items-center justify-center text-sm text-gray-400">에디터 로딩중...</div>,
});

// ─── 폰트 선택 카드 컴포넌트 ────────────────────────────────────────────────
function FontCard({
    option,
    selected,
    name,
    onSelect,
}: {
    option: FontOption;
    selected: boolean;
    name: string;
    onSelect: (key: string) => void;
}) {
    return (
        <label
            className={`cursor-pointer rounded-xl border-2 p-3.5 transition-all flex flex-col gap-1.5 ${selected
                ? "border-brand-orange-500 bg-orange-50 shadow-sm"
                : "border-gray-200 hover:border-gray-300 bg-white"
                }`}
            onClick={() => onSelect(option.key)}
        >
            <input type="radio" name={name} value={option.key} checked={selected} onChange={() => onSelect(option.key)} className="sr-only" />
            <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-800">{option.name}</span>
                {option.tag && (
                    <span className="text-[10px] bg-brand-orange-500 text-white px-1.5 py-0.5 rounded-full font-bold">{option.tag}</span>
                )}
                {selected && <span className="ml-auto text-brand-orange-500 text-sm">✓</span>}
            </div>
            <p
                style={{ fontFamily: option.css === "inherit" ? undefined : option.css }}
                className="text-sm text-gray-600 leading-snug truncate"
            >
                {option.sample}
            </p>
            <p className="text-[10px] text-gray-400">{option.nameEn}</p>
        </label>
    );
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────
export default function AdminSettingsClient({ initialSettings, coaches, fetchError }: { initialSettings: any, coaches: any[], fetchError: boolean }) {
    const [activeTab, setActiveTab] = useState<"builder" | "settings">("settings");
    const [deviceWidth, setDeviceWidth] = useState<"mobile" | "pc">("mobile");
    const [actionError, setActionError] = useState<string | null>(null);

    // 폰트 선택 상태
    const [bodyFont, setBodyFont] = useState<string>(initialSettings?.siteBodyFont || "system");
    const [headingFont, setHeadingFont] = useState<string>(initialSettings?.siteHeadingFont || "same-as-body");

    // 인사말 HTML (RichTextEditor 연동)
    const [introText, setIntroText] = useState<string>(initialSettings?.introductionText || "");

    // Form submission wrapper for basic settings
    async function saveBasicSettings(formData: FormData) {
        setActionError(null);
        try {
            const data: any = {};
            formData.forEach((value, key) => {
                if (typeof value === "string") data[key] = value;
            });
            // RichTextEditor 값과 폰트 선택 값을 명시적으로 포함
            data.introductionText = introText;
            data.siteBodyFont = bodyFont;
            data.siteHeadingFont = headingFont;
            await updateAcademySettings(data);
            alert("기본 정보가 저장되었습니다. 폰트 변경은 새로고침 후 반영됩니다.");
        } catch (e: any) {
            setActionError(e.message || "저장 중 오류가 발생했습니다.");
        }
    }

    async function addCoach(formData: FormData) {
        setActionError(null);
        try {
            const name = formData.get("name") as string;
            const role = formData.get("role") as string;
            const description = formData.get("description") as string;
            const imageUrl = formData.get("imageUrl") as string;
            const order = parseInt(formData.get("order") as string) || 0;
            if (!name || !role) return;
            await createCoach({ name, role, description, imageUrl, order });
        } catch (e: any) {
            setActionError(e.message || "강사 추가 중 오류가 발생했습니다.");
        }
    }

    async function handleDeleteCoach(formData: FormData) {
        setActionError(null);
        try {
            await deleteCoach(formData.get("id") as string);
        } catch (e: any) {
            setActionError(e.message || "삭제 중 오류가 발생했습니다.");
        }
    }

    // Default template if JSON is null
    let defaultJson = "";
    if (initialSettings?.pageDesignJSON) {
        try {
            defaultJson = lz.decompress(lz.decodeBase64(initialSettings.pageDesignJSON));
        } catch (e) {
            console.error("Failed to parse design JSON");
        }
    }

    // 현재 선택된 본문/제목 폰트의 CSS값 (실시간 미리보기용)
    const bodyFontCss = BODY_FONT_OPTIONS.find(f => f.key === bodyFont)?.css ?? "";
    const headingFontCss = headingFont === "same-as-body"
        ? bodyFontCss
        : (HEADING_FONT_OPTIONS.find(f => f.key === headingFont)?.css ?? bodyFontCss);

    return (
        <div className="flex flex-col h-[calc(100vh-100px)]">
            {fetchError && (
                <div className="bg-red-50 text-red-600 p-4 rounded-lg font-medium border border-red-200 mb-6 text-sm shrink-0">
                    데이터베이스 연결에 문제가 발생했습니다. 새 스키마 동기화(db push)가 필요합니다.
                </div>
            )}
            {actionError && (
                <div className="bg-red-50 text-red-600 p-4 rounded-lg font-medium border border-red-200 mb-4 text-sm shrink-0 flex justify-between items-center">
                    <span>⚠ {actionError}</span>
                    <button onClick={() => setActionError(null)} className="text-red-400 hover:text-red-600 font-bold ml-4">✕</button>
                </div>
            )}

            {/* Tab Navigation */}
            <div className="flex bg-white border-b border-gray-200 shrink-0">
                <button
                    onClick={() => setActiveTab("settings")}
                    className={`px-6 py-4 font-bold text-sm border-b-2 transition ${activeTab === 'settings' ? 'border-brand-orange-500 text-brand-orange-500' : 'border-transparent text-gray-500 hover:text-gray-900'}`}
                >
                    학원 소개 및 연락처
                </button>
                <button
                    onClick={() => setActiveTab("builder")}
                    className={`px-6 py-4 font-bold text-sm border-b-2 transition ${activeTab === 'builder' ? 'border-brand-orange-500 text-brand-orange-500' : 'border-transparent text-gray-500 hover:text-gray-900'}`}
                >
                    고급: 시각 디자인 빌더
                </button>
            </div>

            {/* Tab: Builder */}
            <div className={`flex-1 overflow-hidden ${activeTab === 'builder' ? 'block' : 'hidden'}`}>
                <LandingPageDataContext.Provider value={{ isEditor: true }}>
                    <Editor
                        resolver={{ ContainerNode, TextNode, ImageNode, ProgramsWidget, ScheduleWidget, CoachesWidget, HeaderFooterWidget }}
                        enabled={true}
                    >
                        <div className="flex flex-col h-full">
                            <Topbar deviceWidth={deviceWidth} setDeviceWidth={setDeviceWidth} />
                            <div className="flex flex-1 overflow-hidden bg-gray-50">
                                <div className="w-64 shrink-0 transition-all">
                                    <Toolbox />
                                </div>
                                <div className="flex-1 overflow-y-auto p-4 flex justify-center perspective relative bg-gray-200">
                                    <div
                                        className={`bg-white shadow-2xl relative transition-all duration-300 mx-auto flex flex-col ${deviceWidth === 'mobile'
                                            ? 'w-full max-w-[400px] h-[800px] rounded-[2rem] border-[12px] border-b-[24px] border-t-[24px] border-gray-900 mt-4 overflow-hidden'
                                            : 'w-full max-w-[1200px] h-[1000px] rounded-lg mt-0 border border-gray-300 overflow-hidden'
                                            }`}
                                    >
                                        <div className="w-full h-full bg-white overflow-y-auto overflow-x-hidden custom-scrollbar">
                                            <div className="min-h-full pb-32">
                                                <Frame data={defaultJson}>
                                                    <Element is={ContainerNode} padding={0} canvas>
                                                        <HeaderFooterWidget />
                                                    </Element>
                                                </Frame>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="w-72 shrink-0 transition-all">
                                    <SettingsPanel />
                                </div>
                            </div>
                        </div>
                    </Editor>
                </LandingPageDataContext.Provider>
            </div>

            {/* Tab: Settings */}
            <div className={`flex-1 overflow-y-auto p-8 bg-gray-50 ${activeTab === 'settings' ? 'block' : 'hidden'}`}>
                <div className="max-w-3xl mx-auto space-y-8 bg-white p-8 rounded-xl shadow-sm border border-gray-200">

                    <form action={saveBasicSettings} className="space-y-8">

                        {/* ── 글꼴(폰트) 설정 ─────────────────────────────── */}
                        <section>
                            <h2 className="text-xl font-bold text-brand-navy-900 border-b-2 border-brand-orange-500 pb-2 mb-2 inline-block">
                                글꼴(폰트) 설정
                            </h2>
                            <p className="text-sm text-gray-500 mb-6">홈페이지 전체에 적용되는 폰트를 선택합니다. 저장 후 새로고침하면 변경이 반영됩니다.</p>

                            {/* 실시간 미리보기 */}
                            <div className="bg-gray-900 rounded-xl p-5 mb-6 text-white space-y-1">
                                <p className="text-xs text-gray-400 mb-2 font-mono">PREVIEW</p>
                                <p style={{ fontFamily: headingFontCss }} className="text-2xl font-black">STIZ 농구교실 다산점</p>
                                <p style={{ fontFamily: bodyFontCss }} className="text-sm text-gray-300 leading-relaxed">
                                    아이들의 가능성을 이끌어드립니다. 전문 코치진의 체계적인 지도로 농구의 즐거움을 경험하세요.
                                </p>
                            </div>

                            {/* 본문 폰트 */}
                            <div className="mb-6">
                                <label className="block text-sm font-bold text-gray-700 mb-3">
                                    본문 폰트 <span className="text-xs text-gray-400 font-normal ml-1">일반 텍스트, 설명문에 적용</span>
                                </label>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    {BODY_FONT_OPTIONS.map(opt => (
                                        <FontCard
                                            key={opt.key}
                                            option={opt}
                                            selected={bodyFont === opt.key}
                                            name="siteBodyFont"
                                            onSelect={setBodyFont}
                                        />
                                    ))}
                                </div>
                            </div>

                            {/* 제목 폰트 */}
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-3">
                                    제목 폰트 <span className="text-xs text-gray-400 font-normal ml-1">H1~H6 제목에 적용</span>
                                </label>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    {HEADING_FONT_OPTIONS.map(opt => (
                                        <FontCard
                                            key={opt.key}
                                            option={opt}
                                            selected={headingFont === opt.key}
                                            name="siteHeadingFont"
                                            onSelect={setHeadingFont}
                                        />
                                    ))}
                                </div>
                            </div>
                        </section>

                        {/* ── 학원 소개 문구 ───────────────────────────────── */}
                        <section className="pt-6 border-t border-gray-100">
                            <h2 className="text-xl font-bold text-brand-navy-900 border-b-2 border-brand-orange-500 pb-2 mb-6 inline-block">
                                학원 소개 문구
                            </h2>
                            <p className="text-sm text-gray-500 mb-4">홈페이지 메인 화면과 학원소개 페이지에 표시됩니다.</p>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">메인 타이틀</label>
                                    <input
                                        name="introductionTitle"
                                        type="text"
                                        defaultValue={initialSettings?.introductionTitle || ""}
                                        placeholder="예: 다산신도시 No.1 스티즈농구교실"
                                        className="w-full border border-gray-300 rounded-lg p-2.5 text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-brand-orange-500 transition"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">
                                        원장 인사말
                                        <span className="ml-2 text-xs text-gray-400 font-normal">굵게·기울임·크기·색상·이미지 등 서식 편집 가능</span>
                                    </label>
                                    <RichTextEditor
                                        value={introText}
                                        onChange={setIntroText}
                                        placeholder="안녕하세요, 스티즈 농구교실 다산점입니다.&#10;&#10;저희 학원은 아이들이 농구를 통해..."
                                    />
                                </div>
                            </div>
                        </section>

                        {/* ── 연락처 ───────────────────────────────────────── */}
                        <section className="pt-6 border-t border-gray-100">
                            <h2 className="text-xl font-bold text-brand-navy-900 border-b-2 border-brand-orange-500 pb-2 mb-6 inline-block">
                                연락처 및 위치
                            </h2>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">대표 전화번호</label>
                                    <input
                                        name="contactPhone"
                                        type="text"
                                        defaultValue={initialSettings?.contactPhone || ""}
                                        placeholder="010-0000-0000"
                                        className="w-full border border-gray-300 rounded-lg p-2.5 text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-brand-orange-500 transition"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">오시는 길 (주소)</label>
                                    <input
                                        name="address"
                                        type="text"
                                        defaultValue={initialSettings?.address || ""}
                                        placeholder="경기도 남양주시 다산동 ..."
                                        className="w-full border border-gray-300 rounded-lg p-2.5 text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-brand-orange-500 transition"
                                    />
                                </div>
                            </div>
                        </section>

                        {/* ── 구글 캘린더 연동 ──────────────────────────────── */}
                        <section className="pt-6 border-t border-gray-100">
                            <h2 className="text-xl font-bold text-brand-navy-900 border-b-2 border-brand-orange-500 pb-2 mb-2 inline-block">
                                구글 캘린더 연동
                            </h2>
                            <p className="text-sm text-gray-500 mb-4">
                                구글 캘린더의 공개 ICS 주소를 입력하면 연간일정표에 자동으로 반영됩니다.
                            </p>
                            <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 mb-4 text-xs text-blue-700">
                                <strong>ICS 주소 확인 방법:</strong> 구글 캘린더 → 캘린더 설정 → &quot;캘린더 통합&quot; → &quot;iCal 형식의 공개 주소&quot; 복사
                            </div>
                            <input
                                name="googleCalendarIcsUrl"
                                type="url"
                                defaultValue={initialSettings?.googleCalendarIcsUrl || ""}
                                placeholder="https://calendar.google.com/calendar/ical/...@group.calendar.google.com/public/basic.ics"
                                className="w-full border border-gray-300 rounded-lg p-2.5 text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-brand-orange-500 transition font-mono"
                            />
                        </section>

                        <div className="pt-4 border-t border-gray-100 flex justify-end">
                            <ConfirmSubmitButton confirmMessage="변경 사항을 저장하시겠습니까?" className="bg-brand-orange-500 text-white px-6 py-2.5 rounded-lg font-bold hover:bg-orange-600 transition shadow">
                                저장하기
                            </ConfirmSubmitButton>
                        </div>
                    </form>

                    {/* ── 코치/강사진 관리 ─────────────────────────────────── */}
                    <section className="pt-8 border-t-4 border-gray-100">
                        <h2 className="text-xl font-extrabold text-gray-900 mb-6">코치/강사진 프로필 사진 연동 등록</h2>

                        <div className="bg-gray-50 p-5 rounded-xl border border-gray-200 mb-6">
                            <form action={addCoach} className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1">이름 *</label>
                                        <input name="name" type="text" placeholder="예: 홍길동" className="w-full border border-gray-300 rounded-md p-2 text-sm" required />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1">직책 *</label>
                                        <input name="role" type="text" placeholder="예: 원장, 코치" className="w-full border border-gray-300 rounded-md p-2 text-sm" required />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">약력 / 한줄 소개</label>
                                    <input name="description" type="text" className="w-full border border-gray-300 rounded-md p-2 text-sm" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">프로필 사진 (선택)</label>
                                    <input name="imageUrl" type="url" placeholder="이미지 주소 (예: https://.../photo.jpg)" className="w-full border border-gray-300 rounded-md p-2 text-sm" />
                                </div>
                                <div className="flex justify-end pt-2">
                                    <ConfirmSubmitButton confirmMessage="새 강사진을 추가하시겠습니까?" className="bg-brand-navy-900 text-white px-4 py-2 rounded-md font-bold hover:bg-gray-800 transition text-sm">
                                        추가하기
                                    </ConfirmSubmitButton>
                                </div>
                            </form>
                        </div>

                        <ul className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden">
                            {coaches.length === 0 && (
                                <li className="p-6 text-center text-gray-500 text-sm">등록된 강사진이 없습니다.</li>
                            )}
                            {coaches.map((coach) => (
                                <li key={coach.id} className="p-4 flex justify-between items-center bg-white">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-200 shrink-0">
                                            {coach.imageUrl ? (
                                                <img src={coach.imageUrl} alt={coach.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">No img</div>
                                            )}
                                        </div>
                                        <div>
                                            <div className="flex flex-wrap items-center gap-2 mb-1">
                                                <span className="font-bold text-gray-900">{coach.name}</span>
                                                <span className="text-xs bg-brand-orange-50 text-brand-orange-600 border border-brand-orange-200 px-2 py-0.5 rounded-full">{coach.role}</span>
                                            </div>
                                            <p className="text-xs text-gray-500 truncate max-w-[200px]">{coach.description}</p>
                                        </div>
                                    </div>
                                    <form>
                                        <input type="hidden" name="id" value={coach.id} />
                                        <ConfirmSubmitButton confirmMessage="삭제하시겠습니까?" formAction={handleDeleteCoach} className="text-red-500 hover:bg-red-50 px-3 py-1.5 rounded transition text-xs font-bold">
                                            삭제
                                        </ConfirmSubmitButton>
                                    </form>
                                </li>
                            ))}
                        </ul>
                    </section>
                </div>
            </div>
        </div>
    );
}
