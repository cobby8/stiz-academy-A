"use client";

import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

const DAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const DAY_BG: Record<string, string> = {
    Mon: "bg-blue-600", Tue: "bg-green-600", Wed: "bg-yellow-500",
    Thu: "bg-purple-600", Fri: "bg-red-500", Sat: "bg-brand-orange-500",
    Sun: "bg-gray-500",
};
const DAY_CARD_BG: Record<string, string> = {
    Mon: "bg-blue-50 border-blue-200", Tue: "bg-green-50 border-green-200",
    Wed: "bg-yellow-50 border-yellow-200", Thu: "bg-purple-50 border-purple-200",
    Fri: "bg-red-50 border-red-200", Sat: "bg-orange-50 border-orange-200",
    Sun: "bg-gray-50 border-gray-200",
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

    let slots = allSlots;
    if (filterProgramId) {
        slots = allSlots.filter((s) => s.programId === filterProgramId);
    }

    const byDay = DAY_ORDER.reduce<Record<string, MergedSlot[]>>((acc, d) => {
        acc[d] = slots.filter((s) => s.dayKey === d).sort((a, b) => a.startTime.localeCompare(b.startTime));
        return acc;
    }, {});
    const activeDays = DAY_ORDER.filter((d) => byDay[d].length > 0);
    const hasData = slots.length > 0;
    const selectedProgram = programs.find((p) => p.id === filterProgramId);

    return (
        <>
            {/* Program Filter Tabs */}
            {programs.length > 0 && (
                <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
                    <div className="max-w-5xl mx-auto px-4 py-3 flex flex-wrap gap-2 items-center">
                        <a
                            href="/schedule"
                            className={`text-sm font-bold px-4 py-1.5 rounded-full transition ${!filterProgramId ? "bg-brand-navy-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                        >
                            전체
                        </a>
                        {programs.map((p) => (
                            <a
                                key={p.id}
                                href={`/schedule?program=${p.id}`}
                                className={`text-sm font-bold px-4 py-1.5 rounded-full transition ${filterProgramId === p.id ? "bg-brand-navy-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                            >
                                {p.name}
                            </a>
                        ))}
                    </div>
                </div>
            )}

            {/* Schedule Grid */}
            <section className="py-14 bg-gray-50">
                <div className="max-w-5xl mx-auto px-4">
                    {filterProgramId && selectedProgram && (
                        <div className="mb-6 bg-white border border-gray-200 rounded-xl px-5 py-4 flex items-center justify-between gap-4">
                            <div>
                                <p className="text-xs text-gray-400 mb-0.5">프로그램 필터</p>
                                <p className="font-bold text-gray-900">{selectedProgram.name}</p>
                            </div>
                            <a href="/schedule" className="text-sm text-gray-500 hover:text-gray-700 font-medium underline">
                                전체 보기
                            </a>
                        </div>
                    )}
                    {!hasData ? (
                        <div className="text-center py-20 text-gray-400 bg-white rounded-2xl border border-gray-200">
                            <div className="text-5xl mb-4">📅</div>
                            <p className="text-lg font-medium">
                                {filterProgramId ? "해당 프로그램의 수업이 없습니다." : "시간표를 준비 중입니다."}
                            </p>
                            <p className="text-sm mt-2">문의: {phone}</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {activeDays.map((dayKey) => (
                                <div key={dayKey} className={`rounded-2xl border ${DAY_CARD_BG[dayKey]} overflow-hidden`}>
                                    <div className={`${DAY_BG[dayKey]} text-white px-5 py-3 flex items-center gap-3`}>
                                        <span className="font-black text-lg">{byDay[dayKey][0].dayLabel}</span>
                                        <span className="text-white/70 text-sm font-medium">{byDay[dayKey].length}개 클래스</span>
                                    </div>
                                    <div className="p-4">
                                        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                            {byDay[dayKey].map((slot) => (
                                                <div key={slot.slotKey} className="bg-white rounded-xl p-4 shadow-sm border border-white/80">
                                                    <div className="flex gap-3">
                                                        <div className="flex-1 min-w-0">
                                                            <h4 className="font-bold text-gray-900 mb-2 text-sm">{slot.displayLabel}</h4>
                                                            <div className="flex items-center gap-1.5 text-sm text-gray-700 mb-1">
                                                                <span className="text-gray-400">⏰</span>
                                                                <span className="font-semibold">{slot.startTime} ~ {slot.endTime}</span>
                                                            </div>
                                                            {slot.gradeRange && (
                                                                <div className="flex items-center gap-1.5 text-sm text-gray-600 mb-1">
                                                                    <span className="text-gray-400">🎓</span>
                                                                    <span>{slot.gradeRange}</span>
                                                                </div>
                                                            )}
                                                            <div className="mt-2 pt-2 border-t border-gray-100 flex items-center gap-2">
                                                                {slot.isFull ? (
                                                                    <span className="shrink-0 text-[10px] bg-red-500 text-white font-black px-2 py-0.5 rounded-full">마감</span>
                                                                ) : slot.enrolled > 10 ? (
                                                                    <span className="shrink-0 text-[10px] bg-brand-orange-500 text-white font-black px-2 py-0.5 rounded-full">마감임박</span>
                                                                ) : null}
                                                                <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                                                                    <div
                                                                        className={`h-full rounded-full transition-all ${slot.isFull ? "bg-red-400" : slot.enrolled > 10 ? "bg-brand-orange-500" : "bg-green-400"}`}
                                                                        style={{ width: `${Math.min(100, (slot.enrolled / slot.capacity) * 100)}%` }}
                                                                    />
                                                                </div>
                                                            </div>
                                                            {slot.note && (
                                                                <p className="text-xs text-brand-orange-600 mt-2 font-medium">📌 {slot.note}</p>
                                                            )}
                                                        </div>
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
                                                                <p className="text-[11px] font-bold text-gray-800 text-center leading-tight truncate w-full">{slot.coach.name}</p>
                                                                <p className="text-[10px] text-gray-400 text-center leading-tight truncate w-full">{slot.coach.role}</p>
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
                <div className="text-4xl mb-3">📅</div>
                <p>시간표 불러오는 중...</p>
            </div>
        }>
            <ScheduleFilter {...props} />
        </Suspense>
    );
}
