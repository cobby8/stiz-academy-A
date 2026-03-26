"use client";

import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

// 요일 순서 — 월~일 표시용
const DAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// 요일별 헤더 배경색 — 각 요일을 시각적으로 구분
const DAY_BG: Record<string, string> = {
    Mon: "bg-blue-600", Tue: "bg-green-600", Wed: "bg-yellow-500",
    Thu: "bg-purple-600", Fri: "bg-red-500", Sat: "bg-brand-orange-500",
    Sun: "bg-gray-500",
};

// 요일별 카드 영역 배경색 — 헤더 색상과 어울리는 연한 톤
const DAY_CARD_BG: Record<string, string> = {
    Mon: "bg-blue-50/50 border-blue-100", Tue: "bg-green-50/50 border-green-100",
    Wed: "bg-yellow-50/50 border-yellow-100", Thu: "bg-purple-50/50 border-purple-100",
    Fri: "bg-red-50/50 border-red-100", Sat: "bg-orange-50/50 border-orange-100",
    Sun: "bg-gray-50/50 border-gray-100",
};

export type MergedSlot = {
    slotKey: string;
    dayKey: string;
    dayLabel: string;
    startTime: string;
    endTime: string;
    gradeRange: string;
    enrolled: number;
    displayLabel: string;
    note: string | null;
    capacity: number;
    isFull: boolean;
    coach: { name: string; role: string; imageUrl: string | null } | null;
    programId: string | null;
};

type Program = { id: string; name: string };

function ScheduleFilter({ programs, allSlots, phone }: {
    programs: Program[];
    allSlots: MergedSlot[];
    phone: string;
}) {
    const searchParams = useSearchParams();
    const filterProgramId = searchParams.get("program") ?? undefined;

    // 프로그램 필터 적용 — 선택된 프로그램이 있으면 해당 프로그램만 표시
    let slots = allSlots;
    if (filterProgramId) {
        slots = allSlots.filter((s) => s.programId === filterProgramId);
    }

    // 요일별 그룹핑 + 시간순 정렬
    const byDay = DAY_ORDER.reduce<Record<string, MergedSlot[]>>((acc, d) => {
        acc[d] = slots.filter((s) => s.dayKey === d).sort((a, b) => a.startTime.localeCompare(b.startTime));
        return acc;
    }, {});
    const activeDays = DAY_ORDER.filter((d) => byDay[d].length > 0);
    const hasData = slots.length > 0;
    const selectedProgram = programs.find((p) => p.id === filterProgramId);

    return (
        <>
            {/* 프로그램 필터 탭 — 디자인 개선 (둥글고 부드러운 pill 스타일) */}
            {programs.length > 0 && (
                <div className="bg-white/80 backdrop-blur-sm border-b border-gray-100 sticky top-0 z-10">
                    <div className="max-w-6xl mx-auto px-4 py-4 flex flex-wrap gap-2 items-center">
                        <a
                            href="/schedule"
                            className={`text-sm font-bold px-5 py-2 rounded-full transition-all duration-200 ${
                                !filterProgramId
                                    ? "bg-brand-navy-900 text-white shadow-md"
                                    : "bg-gray-50 text-gray-600 hover:bg-gray-100 hover:shadow-sm border border-gray-200"
                            }`}
                        >
                            전체
                        </a>
                        {programs.map((p) => (
                            <a
                                key={p.id}
                                href={`/schedule?program=${p.id}`}
                                className={`text-sm font-bold px-5 py-2 rounded-full transition-all duration-200 ${
                                    filterProgramId === p.id
                                        ? "bg-brand-navy-900 text-white shadow-md"
                                        : "bg-gray-50 text-gray-600 hover:bg-gray-100 hover:shadow-sm border border-gray-200"
                                }`}
                            >
                                {p.name}
                            </a>
                        ))}
                    </div>
                </div>
            )}

            {/* 시간표 그리드 — 배경색을 따뜻한 톤으로 변경 */}
            <section className="py-16 md:py-20 bg-surface-section">
                <div className="max-w-6xl mx-auto px-4">
                    {/* 프로그램 필터 표시 배너 — 선택 시 상단에 안내 */}
                    {filterProgramId && selectedProgram && (
                        <div className="mb-6 bg-white border border-gray-100 rounded-2xl px-6 py-4 flex items-center justify-between gap-4 shadow-sm">
                            <div>
                                <p className="text-sm text-gray-400 mb-0.5 font-medium">프로그램 필터</p>
                                <p className="font-bold text-gray-900">{selectedProgram.name}</p>
                            </div>
                            <a href="/schedule" className="text-sm text-brand-orange-500 hover:text-brand-orange-600 font-bold transition">
                                전체 보기
                            </a>
                        </div>
                    )}

                    {/* 데이터 없을 때 안내 메시지 */}
                    {!hasData ? (
                        <div className="text-center py-20 text-gray-400 bg-white rounded-2xl border border-gray-100 shadow-sm">
                            <div className="text-5xl mb-4">🏀</div>
                            <p className="text-lg font-bold text-gray-500">
                                {filterProgramId ? "해당 프로그램의 수업이 없습니다." : "시간표를 준비 중입니다."}
                            </p>
                            <p className="text-sm mt-2 text-gray-400">문의: {phone}</p>
                        </div>
                    ) : (
                        <div data-tour-target="schedule-grid" className="space-y-8">
                            {activeDays.map((dayKey) => (
                                <div key={dayKey} className={`rounded-2xl border ${DAY_CARD_BG[dayKey]} overflow-hidden shadow-sm`}>
                                    {/* 요일 헤더 — 색상 바 + 클래스 수 표시 */}
                                    <div className={`${DAY_BG[dayKey]} text-white px-6 py-3.5 flex items-center gap-3`}>
                                        <span className="font-black text-lg">{byDay[dayKey][0].dayLabel}</span>
                                        <span className="text-white/70 text-sm font-medium">{byDay[dayKey].length}개 클래스</span>
                                    </div>

                                    {/* 클래스 카드 그리드 */}
                                    <div className="p-4 md:p-5">
                                        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                            {byDay[dayKey].map((slot) => (
                                                <div
                                                    key={slot.slotKey}
                                                    className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
                                                >
                                                    <div className="flex gap-3">
                                                        {/* 좌측: 수업 정보 */}
                                                        <div className="flex-1 min-w-0">
                                                            <h4 className="font-bold text-gray-900 mb-2 text-base">{slot.displayLabel}</h4>
                                                            {/* 시간 표시 */}
                                                            <div className="flex items-center gap-1.5 text-sm text-gray-700 mb-1">
                                                                <span className="text-gray-400">⏰</span>
                                                                <span className="font-semibold">{slot.startTime} ~ {slot.endTime}</span>
                                                            </div>
                                                            {/* 대상 학년 */}
                                                            {slot.gradeRange && (
                                                                <div className="flex items-center gap-1.5 text-sm text-gray-600 mb-1">
                                                                    <span className="text-gray-400">🎓</span>
                                                                    <span>{slot.gradeRange}</span>
                                                                </div>
                                                            )}
                                                            {/* 정원 프로그레스 바 — 마감/마감임박/여유 3단계 */}
                                                            <div className="mt-2.5 pt-2 border-t border-gray-50 flex items-center gap-2">
                                                                {slot.isFull ? (
                                                                    <span className="shrink-0 text-xs bg-red-500 text-white font-black px-2 py-0.5 rounded-full">마감</span>
                                                                ) : slot.enrolled > 10 ? (
                                                                    <span className="shrink-0 text-xs bg-brand-orange-500 text-white font-black px-2 py-0.5 rounded-full">마감임박</span>
                                                                ) : null}
                                                                <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                                                                    <div
                                                                        className={`h-full rounded-full transition-all ${slot.isFull ? "bg-red-400" : slot.enrolled > 10 ? "bg-brand-orange-500" : "bg-green-400"}`}
                                                                        style={{ width: `${Math.min(100, (slot.enrolled / slot.capacity) * 100)}%` }}
                                                                    />
                                                                </div>
                                                            </div>
                                                            {/* 메모 — 있을 때만 표시 */}
                                                            {slot.note && (
                                                                <p className="text-sm text-brand-orange-600 mt-2 font-medium">📌 {slot.note}</p>
                                                            )}
                                                        </div>

                                                        {/* 우측: 코치 프로필 — 있을 때만 표시 */}
                                                        {slot.coach && (
                                                            <div className="shrink-0 flex flex-col items-center gap-1 pt-0.5 w-[58px]">
                                                                {slot.coach.imageUrl ? (
                                                                    <Image
                                                                        src={slot.coach.imageUrl}
                                                                        alt={slot.coach.name}
                                                                        width={44}
                                                                        height={44}
                                                                        className="w-11 h-11 rounded-full object-cover border-2 border-gray-100"
                                                                    />
                                                                ) : (
                                                                    <div className="w-11 h-11 rounded-full bg-gray-200 flex items-center justify-center text-lg">🏀</div>
                                                                )}
                                                                <p className="text-xs font-bold text-gray-800 text-center leading-tight truncate w-full">{slot.coach.name}</p>
                                                                <p className="text-xs text-gray-400 text-center leading-tight truncate w-full">{slot.coach.role}</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </section>
        </>
    );
}

export default function ScheduleClient(props: { programs: Program[]; allSlots: MergedSlot[]; phone: string }) {
    return (
        <Suspense fallback={
            <div className="py-20 text-center text-gray-400">
                <div className="text-4xl mb-3">🏀</div>
                <p>시간표 불러오는 중...</p>
            </div>
        }>
            <ScheduleFilter {...props} />
        </Suspense>
    );
}
