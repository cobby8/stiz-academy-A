"use client";

import { useState } from "react";
import ConfirmSubmitButton from "./ConfirmSubmitButton";
import { updateAcademySettings } from "@/app/actions/admin";
import { BODY_FONT_OPTIONS, HEADING_FONT_OPTIONS, type FontOption } from "@/lib/fonts";
import dynamic from "next/dynamic";

// RichTextEditor는 SSR 불가 → dynamic import
const RichTextEditor = dynamic(() => import("@/components/RichTextEditor"), {
    ssr: false,
    loading: () => (
        <div className="border border-gray-300 rounded-md p-4 min-h-[150px] bg-gray-50 flex items-center justify-center text-sm text-gray-400">
            에디터 로딩중...
        </div>
    ),
});

// ─── 적용 범위 뱃지 ────────────────────────────────────────────────────────────
function AppliesTo({ pages }: { pages: string[] }) {
    return (
        <div className="flex flex-wrap gap-1.5 mt-1 mb-3">
            {pages.map((p) => (
                <span key={p} className="text-[11px] bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full font-medium">
                    📍 {p}
                </span>
            ))}
        </div>
    );
}

// ─── 폰트 선택 카드 ────────────────────────────────────────────────────────────
function FontCard({ option, selected, name, onSelect }: {
    option: FontOption;
    selected: boolean;
    name: string;
    onSelect: (key: string) => void;
}) {
    return (
        <label
            className={`cursor-pointer rounded-xl border-2 p-3.5 transition-all flex flex-col gap-1.5 ${
                selected ? "border-brand-orange-500 bg-orange-50 shadow-sm" : "border-gray-200 hover:border-gray-300 bg-white"
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
            <p style={{ fontFamily: option.css === "inherit" ? undefined : option.css }} className="text-sm text-gray-600 leading-snug truncate">
                {option.sample}
            </p>
            <p className="text-[10px] text-gray-400">{option.nameEn}</p>
        </label>
    );
}

// ─── 섹션 헤더 ────────────────────────────────────────────────────────────────
function SectionHeader({ title }: { title: string }) {
    return (
        <h2 className="text-xl font-bold text-brand-navy-900 border-b-2 border-brand-orange-500 pb-2 mb-2 inline-block">
            {title}
        </h2>
    );
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────
export default function AdminSettingsClient({
    initialSettings,
    fetchError,
}: {
    initialSettings: any;
    fetchError: boolean;
}) {
    const [actionError, setActionError] = useState<string | null>(null);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [bodyFont, setBodyFont] = useState<string>(initialSettings?.siteBodyFont || "system");
    const [headingFont, setHeadingFont] = useState<string>(
        HEADING_FONT_OPTIONS.some(f => f.key === initialSettings?.siteHeadingFont)
            ? initialSettings.siteHeadingFont
            : "same-as-body"
    );
    const [introText, setIntroText] = useState<string>(initialSettings?.introductionText || "");
    const [philosophyText, setPhilosophyText] = useState<string>(initialSettings?.philosophyText || "");
    const [facilitiesText, setFacilitiesText] = useState<string>(initialSettings?.facilitiesText || "");
    const [facilityImages, setFacilityImages] = useState<string[]>(() => {
        try {
            if (initialSettings?.facilitiesImagesJSON) return JSON.parse(initialSettings.facilitiesImagesJSON);
        } catch {}
        return [];
    });
    const [galleryImages, setGalleryImages] = useState<string[]>(() => {
        try {
            if (initialSettings?.galleryImagesJSON) return JSON.parse(initialSettings.galleryImagesJSON);
        } catch {}
        return [];
    });

    const bodyFontCss = BODY_FONT_OPTIONS.find(f => f.key === bodyFont)?.css ?? "";
    const headingFontCss = headingFont === "same-as-body"
        ? bodyFontCss
        : (HEADING_FONT_OPTIONS.find(f => f.key === headingFont)?.css ?? bodyFontCss);

    async function saveBasicSettings(formData: FormData) {
        setActionError(null);
        setSaveSuccess(true); // optimistic: 즉시 성공 표시 → INP ~10ms
        try {
            const data: any = {};
            formData.forEach((value, key) => {
                if (typeof value === "string") data[key] = value;
            });
            data.introductionText = introText;
            data.philosophyText = philosophyText;
            data.facilitiesText = facilitiesText;
            data.facilitiesImagesJSON = JSON.stringify(facilityImages.filter(u => u.trim()));
            data.galleryImagesJSON = JSON.stringify(galleryImages.filter(u => u.trim()));
            data.siteBodyFont = bodyFont;
            data.siteHeadingFont = headingFont;
            await updateAcademySettings(data);
            setTimeout(() => setSaveSuccess(false), 4000);
        } catch (e: any) {
            setSaveSuccess(false);
            setActionError(e.message || "저장 중 오류가 발생했습니다.");
        }
    }

    return (
        <div className="flex-1 overflow-y-auto p-8 bg-gray-50">
            {fetchError && (
                <div className="bg-red-50 text-red-600 p-4 rounded-lg font-medium border border-red-200 mb-6 text-sm">
                    데이터베이스 연결에 문제가 발생했습니다. 새 스키마 동기화(db push)가 필요합니다.
                </div>
            )}
            {saveSuccess && (
                <div className="bg-green-50 text-green-700 p-4 rounded-lg font-medium border border-green-200 mb-4 text-sm flex justify-between items-center">
                    <span>✓ 저장되었습니다. 폰트 변경은 새로고침 후 반영됩니다.</span>
                    <button onClick={() => setSaveSuccess(false)} className="text-green-400 hover:text-green-600 font-bold ml-4">✕</button>
                </div>
            )}
            {actionError && (
                <div className="bg-red-50 text-red-600 p-4 rounded-lg font-medium border border-red-200 mb-4 text-sm flex justify-between items-center">
                    <span>⚠ {actionError}</span>
                    <button onClick={() => setActionError(null)} className="text-red-400 hover:text-red-600 font-bold ml-4">✕</button>
                </div>
            )}

            <div className="max-w-3xl mx-auto space-y-8 bg-white p-8 rounded-xl shadow-sm border border-gray-200">
                <form action={saveBasicSettings} className="space-y-8">

                    {/* ── 폰트 설정 ───────────────────────────────────────── */}
                    <section>
                        <SectionHeader title="글꼴(폰트) 설정" />
                        <AppliesTo pages={["홈페이지 전체 (모든 페이지)"]} />

                        {/* 폰트 미리보기 */}
                        <div className="bg-gray-900 rounded-xl p-5 mb-6 text-white space-y-1">
                            <p className="text-xs text-gray-400 mb-2 font-mono">PREVIEW</p>
                            <p style={{ fontFamily: headingFontCss }} className="text-2xl font-black">STIZ 농구교실 다산점</p>
                            <p style={{ fontFamily: bodyFontCss }} className="text-sm text-gray-300 leading-relaxed">
                                아이들의 가능성을 이끌어드립니다. 전문 코치진의 체계적인 지도로 농구의 즐거움을 경험하세요.
                            </p>
                        </div>

                        <div className="mb-6">
                            <label className="block text-sm font-bold text-gray-700 mb-3">
                                본문 폰트
                                <span className="text-xs text-gray-400 font-normal ml-2">일반 텍스트, 설명문</span>
                            </label>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {BODY_FONT_OPTIONS.map(opt => (
                                    <FontCard key={opt.key} option={opt} selected={bodyFont === opt.key} name="siteBodyFont" onSelect={setBodyFont} />
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-3">
                                제목 폰트
                                <span className="text-xs text-gray-400 font-normal ml-2">H1~H3 제목에 적용</span>
                            </label>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {HEADING_FONT_OPTIONS.map(opt => (
                                    <FontCard key={opt.key} option={opt} selected={headingFont === opt.key} name="siteHeadingFont" onSelect={setHeadingFont} />
                                ))}
                            </div>
                        </div>
                    </section>

                    {/* ── 학원 소개 문구 ───────────────────────────────────── */}
                    <section className="pt-6 border-t border-gray-100">
                        <SectionHeader title="학원 소개 문구" />

                        <div className="space-y-5">
                            {/* 메인 타이틀 */}
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">
                                    메인 타이틀
                                </label>
                                <AppliesTo pages={["홈페이지 메인 히어로 제목"]} />
                                <input
                                    name="introductionTitle"
                                    type="text"
                                    defaultValue={initialSettings?.introductionTitle || ""}
                                    placeholder="예: 다산신도시 No.1 스티즈농구교실"
                                    className="w-full border border-gray-300 rounded-lg p-2.5 text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-brand-orange-500 transition"
                                />
                            </div>

                            {/* 원장 인사말 */}
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">
                                    원장 인사말 / 학원 소개
                                </label>
                                <AppliesTo pages={["홈페이지 메인 히어로 소개 문구", "학원소개 페이지 원장 인사말"]} />
                                <p className="text-xs text-gray-400 mb-2">
                                    굵게·기울임·색상·정렬 적용 가능. 줄바꿈은 Enter 키로 문단 구분, Shift+Enter로 줄바꿈.
                                </p>
                                <RichTextEditor
                                    value={introText}
                                    onChange={setIntroText}
                                    placeholder={"안녕하세요, 스티즈 농구교실 다산점입니다.\n\n아이들이 농구를 통해 협동심과 건강한 체력을 기를 수 있도록 최선을 다해 지도합니다."}
                                />
                            </div>
                        </div>
                    </section>

                    {/* ── 교육 이념 ──────────────────────────────────────── */}
                    <section className="pt-6 border-t border-gray-100">
                        <SectionHeader title="교육 이념" />
                        <AppliesTo pages={["학원소개 페이지 (원장 인사말 아래)"]} />
                        <p className="text-xs text-gray-400 mb-2">
                            학원의 교육 철학, 비전, 지도 방침 등을 작성합니다. 비워두면 섹션이 숨겨집니다.
                        </p>
                        <RichTextEditor
                            value={philosophyText}
                            onChange={setPhilosophyText}
                            placeholder={"우리 학원은 농구를 통해 아이들의 체력, 협동심, 리더십을 길러줍니다.\n\n모든 수업은 연령과 실력에 맞춘 단계별 커리큘럼으로 진행됩니다."}
                        />
                    </section>

                    {/* ── 시설 소개 ──────────────────────────────────────── */}
                    <section className="pt-6 border-t border-gray-100">
                        <SectionHeader title="시설 소개" />
                        <AppliesTo pages={["학원소개 페이지 (코치진 아래)"]} />

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">시설 설명</label>
                                <p className="text-xs text-gray-400 mb-2">비워두면 섹션이 숨겨집니다.</p>
                                <RichTextEditor
                                    value={facilitiesText}
                                    onChange={setFacilitiesText}
                                    placeholder="최신 시설과 안전한 환경에서 수업이 진행됩니다."
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">시설 사진 URL</label>
                                <p className="text-xs text-gray-400 mb-2">
                                    Supabase Storage 또는 외부 이미지 URL을 한 줄에 하나씩 입력합니다.
                                </p>
                                {facilityImages.map((url, i) => (
                                    <div key={i} className="flex gap-2 mb-2">
                                        <input
                                            type="url"
                                            value={url}
                                            onChange={(e) => {
                                                const next = [...facilityImages];
                                                next[i] = e.target.value;
                                                setFacilityImages(next);
                                            }}
                                            placeholder="https://..."
                                            className="flex-1 border border-gray-300 rounded-lg p-2 text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-brand-orange-500 transition font-mono"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setFacilityImages(facilityImages.filter((_, j) => j !== i))}
                                            className="text-red-400 hover:text-red-600 px-2 font-bold text-lg"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                ))}
                                <button
                                    type="button"
                                    onClick={() => setFacilityImages([...facilityImages, ""])}
                                    className="text-sm text-brand-orange-500 font-bold hover:underline"
                                >
                                    + 사진 URL 추가
                                </button>
                            </div>
                        </div>
                    </section>

                    {/* ── 포토갤러리 ──────────────────────────────────────── */}
                    <section className="pt-6 border-t border-gray-100">
                        <SectionHeader title="포토 갤러리" />
                        <AppliesTo pages={["홈페이지 (메인 랜딩)"]} />
                        <p className="text-xs text-gray-400 mb-2">
                            홈페이지에 표시할 학원 활동 사진 URL을 입력합니다. 비워두면 갤러리 섹션이 숨겨집니다.
                        </p>
                        {galleryImages.map((url, i) => (
                            <div key={i} className="flex gap-2 mb-2">
                                <input
                                    type="url"
                                    value={url}
                                    onChange={(e) => {
                                        const next = [...galleryImages];
                                        next[i] = e.target.value;
                                        setGalleryImages(next);
                                    }}
                                    placeholder="https://..."
                                    className="flex-1 border border-gray-300 rounded-lg p-2 text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-brand-orange-500 transition font-mono"
                                />
                                <button
                                    type="button"
                                    onClick={() => setGalleryImages(galleryImages.filter((_, j) => j !== i))}
                                    className="text-red-400 hover:text-red-600 px-2 font-bold text-lg"
                                >
                                    ✕
                                </button>
                            </div>
                        ))}
                        <button
                            type="button"
                            onClick={() => setGalleryImages([...galleryImages, ""])}
                            className="text-sm text-brand-orange-500 font-bold hover:underline"
                        >
                            + 사진 URL 추가
                        </button>
                    </section>

                    {/* ── 연락처 ───────────────────────────────────────────── */}
                    <section className="pt-6 border-t border-gray-100">
                        <SectionHeader title="연락처 및 위치" />
                        <AppliesTo pages={["모든 페이지 헤더 전화버튼", "학원소개 페이지 CTA", "홈 푸터"]} />

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

                    {/* ── 유튜브 영상 ───────────────────────────────────────── */}
                    <section className="pt-6 border-t border-gray-100">
                        <SectionHeader title="메인페이지 유튜브 영상" />
                        <AppliesTo pages={["메인 페이지 (홍보 영상)"]} />
                        <input
                            name="youtubeUrl"
                            type="text"
                            defaultValue={initialSettings?.youtubeUrl || ""}
                            placeholder="https://www.youtube.com/watch?v=XXXXXXXXXXX  또는 <iframe ...> 코드"
                            className="w-full border border-gray-300 rounded-lg p-2.5 text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-brand-orange-500 transition font-mono"
                        />
                        <p className="text-xs text-gray-400 mt-1.5">YouTube 영상 URL 또는 YouTube &quot;공유 → 퍼가기&quot; iframe 코드를 그대로 붙여넣으면 메인페이지에 자동 임베드됩니다. 비우면 영상 섹션이 숨겨집니다.</p>
                    </section>

                    {/* ── 구글 캘린더 ───────────────────────────────────────── */}
                    <section className="pt-6 border-t border-gray-100">
                        <SectionHeader title="구글 캘린더 연동" />
                        <AppliesTo pages={["연간일정표 페이지"]} />

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

                    {/* ── 구글시트 시간표 → 수업시간표 관리 메뉴로 이동됨 ── */}
                    <section className="pt-6 border-t border-gray-100">
                        <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-sm text-blue-800 flex items-center justify-between gap-4">
                            <span>구글시트 시간표 연동은 <strong>수업시간표 관리</strong> 메뉴에서 설정할 수 있습니다.</span>
                            <a href="/admin/schedule" className="shrink-0 font-bold underline hover:text-blue-900 whitespace-nowrap">
                                수업시간표 관리 →
                            </a>
                        </div>
                    </section>

                    {/* 저장 */}
                    <div className="pt-4 border-t border-gray-100 flex justify-end">
                        <ConfirmSubmitButton
                            confirmMessage="변경 사항을 저장하시겠습니까?"
                            className="bg-brand-orange-500 text-white px-6 py-2.5 rounded-lg font-bold hover:bg-orange-600 transition shadow"
                        >
                            저장하기
                        </ConfirmSubmitButton>
                    </div>
                </form>

                <div className="pt-4 border-t border-gray-100 bg-gray-50 rounded-lg p-4 flex items-center justify-between text-sm">
                    <span className="text-gray-500">코치/강사진 관리는 별도 메뉴로 이동되었습니다.</span>
                    <a href="/admin/coaches" className="font-bold text-brand-navy-900 underline hover:text-gray-600">
                        코치/강사진 관리 →
                    </a>
                </div>
            </div>
        </div>
    );
}
