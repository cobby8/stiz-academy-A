"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import EventDetailPanel from "./EventDetailPanel";
import { DAY_NAMES } from "@/lib/classSchedule";

const SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5분

const CATEGORY_STYLES: Record<string, { bg: string; text: string; dot: string; border: string }> = {
    대회:     { bg: "bg-red-50",    text: "text-red-700",    dot: "bg-red-500",    border: "border-red-200"    },
    방학:     { bg: "bg-yellow-50", text: "text-yellow-700", dot: "bg-yellow-500", border: "border-yellow-200" },
    특별행사: { bg: "bg-purple-50", text: "text-purple-700", dot: "bg-purple-500", border: "border-purple-200" },
    정기행사: { bg: "bg-blue-50",   text: "text-blue-700",   dot: "bg-blue-500",   border: "border-blue-200"   },
    일반:     { bg: "bg-gray-50",   text: "text-gray-700",   dot: "bg-gray-400",   border: "border-gray-200"   },
};

const MONTH_NAMES = ["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"];
const DOW_KO = ["일","월","화","수","목","금","토"];

export interface SerializedEvent {
    id: string;
    title: string;
    date: string;
    endDate?: string;
    description?: string;
    category: string;
    isAllDay: boolean;
    url?: string;
    source: "db" | "google";
    // "n월 개강/종강/주차" 이벤트: 실제 날짜와 관계없이 n월 섹션에 표시
    academicYear?:  number;
    academicMonth?: number;
}

interface Props {
    allEvents: SerializedEvent[];
    classDays: number[];
    // 서버에서 계산된 수강 연도별·수강월별 수업일자: { 연도: { 수강월(0-11): { 요일(0-6): [ISO날짜, ...] } } }
    yearlySchedules: Record<number, Record<number, Record<number, string[]>>>;
}

export default function AnnualEventsClient({ allEvents, classDays, yearlySchedules }: Props) {
    const router      = useRouter();
    const today       = useMemo(() => new Date(), []);
    const currentYear = today.getFullYear();
    const thisMonth   = today.getMonth();
    const nextMonth   = (thisMonth + 1) % 12;

    const [selectedYear, setSelectedYear]             = useState(currentYear);
    const [selectedEvent, setSelectedEvent]           = useState<SerializedEvent | null>(null);
    const [openScheduleMonths, setOpenScheduleMonths] = useState<Set<number>>(new Set());
    const [openMonths, setOpenMonths]                 = useState<Set<number>>(
        () => new Set([thisMonth, nextMonth])
    );
    const [lastSynced, setLastSynced]                 = useState<Date>(() => new Date());

    // 5분마다 서버 컴포넌트 재조회 (구글 캘린더 자동 동기화)
    useEffect(() => {
        const id = setInterval(() => {
            router.refresh();
            setLastSynced(new Date());
        }, SYNC_INTERVAL_MS);
        return () => clearInterval(id);
    }, [router]);

    // 연도 변경 시 openMonths 리셋: 당해 연도 → 이번달+다음달만, 다른 연도 → 전체 펼침
    useEffect(() => {
        if (selectedYear === currentYear) {
            setOpenMonths(new Set([thisMonth, nextMonth]));
        } else {
            setOpenMonths(new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]));
        }
        setOpenScheduleMonths(new Set());
    }, [selectedYear, currentYear, thisMonth, nextMonth]);

    function toggleMonth(mon: number) {
        setOpenMonths(prev => {
            const next = new Set(prev);
            next.has(mon) ? next.delete(mon) : next.add(mon);
            return next;
        });
    }

    /* ── 이벤트의 "표시 연도/월" 결정 ──
     * "n월 개강/종강/주차" 이벤트는 academicYear/Month를 우선 사용해 n월 섹션에 표시 */
    const displayYearOf  = (ev: SerializedEvent) => ev.academicYear  ?? new Date(ev.date).getUTCFullYear();
    const displayMonthOf = (ev: SerializedEvent) => ev.academicMonth ?? new Date(ev.date).getUTCMonth();

    /* ── 연도 목록 ── */
    const availableYears = useMemo(() => {
        const s = new Set<number>();
        allEvents.forEach(e => s.add(displayYearOf(e)));
        s.add(currentYear);
        return Array.from(s).sort((a, b) => b - a);
    }, [allEvents, currentYear]);

    /* ── 선택 연도 필터 ── */
    const filteredEvents = useMemo(
        () => allEvents.filter(e => displayYearOf(e) === selectedYear),
        [allEvents, selectedYear],
    );

    /* ── month → dateKey → [events] ── */
    const byMonthDate = useMemo(() => {
        const g: Record<number, Record<string, SerializedEvent[]>> = {};
        filteredEvents.forEach(ev => {
            const mon = displayMonthOf(ev);
            const key = ev.date.slice(0, 10); // 실제 날짜 (날짜 헤더에 표시됨)
            if (!g[mon])      g[mon]      = {};
            if (!g[mon][key]) g[mon][key] = [];
            g[mon][key].push(ev);
        });
        return g;
    }, [filteredEvents]);

    const activeMonths = Object.keys(byMonthDate).map(Number).sort((a, b) => a - b);

    function toggleSchedule(mon: number) {
        setOpenScheduleMonths(prev => {
            const next = new Set(prev);
            next.has(mon) ? next.delete(mon) : next.add(mon);
            return next;
        });
    }

    return (
        <>
            <section className="py-14 bg-gray-50">
                <div className="max-w-4xl mx-auto px-4">

                    {/* 연도 선택 + 동기화 시각 */}
                    <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
                        <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-sm font-bold text-gray-500">연도 선택:</span>
                        <div className="flex gap-2 flex-wrap">
                            {availableYears.map(year => (
                                <button
                                    key={year}
                                    onClick={() => setSelectedYear(year)}
                                    className={`px-4 py-1.5 rounded-full text-sm font-bold transition ${
                                        selectedYear === year
                                            ? "bg-brand-navy-900 text-white shadow"
                                            : "bg-white text-gray-600 border border-gray-200 hover:border-gray-400"
                                    }`}
                                >
                                    {year}년
                                </button>
                            ))}
                        </div>
                        </div>
                        <span className="text-xs text-gray-400 shrink-0">
                            🔄 {lastSynced.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })} 동기화
                        </span>
                    </div>

                    {/* 일정 없음 */}
                    {filteredEvents.length === 0 ? (
                        <div className="text-center py-20 bg-white rounded-2xl border border-gray-200 text-gray-400">
                            <div className="text-5xl mb-4">📅</div>
                            <p className="text-lg font-medium">{selectedYear}년 등록된 일정이 없습니다.</p>
                            <p className="text-sm mt-2">관리자가 일정을 등록하면 여기에 표시됩니다.</p>
                        </div>
                    ) : (
                        <div className="space-y-10">
                            {activeMonths.map(mon => {
                                const dateMap     = byMonthDate[mon];
                                const schedule    = yearlySchedules[selectedYear]?.[mon];
                                const hasSchedule = !!schedule &&
                                    Object.values(schedule).some(dates => dates.length > 0);
                                const isScheduleOpen = openScheduleMonths.has(mon);
                                const isMonthOpen    = openMonths.has(mon);
                                const sortedKeys  = Object.keys(dateMap).sort();
                                const eventCount  = Object.values(dateMap).flat().length;
                                // 현재 월/다음 달 여부 (선택 연도가 올해인 경우만 표시)
                                const isThisMonth = selectedYear === currentYear && mon === thisMonth;
                                const isNextMonth = selectedYear === currentYear && mon === nextMonth;

                                return (
                                    <div key={mon}>
                                        {/* ── 월 헤더 (클릭으로 접기/펼치기) ── */}
                                        <button
                                            onClick={() => toggleMonth(mon)}
                                            className="w-full flex items-center gap-3 mb-3 group text-left"
                                        >
                                            <h2 className="text-xl font-black text-brand-navy-900 flex items-center gap-2">
                                                <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-black transition ${
                                                    isMonthOpen
                                                        ? "bg-brand-navy-900 text-white"
                                                        : "bg-gray-200 text-gray-600 group-hover:bg-brand-navy-900/70 group-hover:text-white"
                                                }`}>
                                                    {mon + 1}
                                                </span>
                                                <span className={isMonthOpen ? "text-brand-navy-900" : "text-gray-500"}>
                                                    {MONTH_NAMES[mon]}
                                                </span>
                                            </h2>

                                            {/* 이번 달 / 다음 달 뱃지 */}
                                            {isThisMonth && (
                                                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-brand-orange-500 text-white leading-none">
                                                    이번 달
                                                </span>
                                            )}
                                            {isNextMonth && (
                                                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 leading-none">
                                                    다음 달
                                                </span>
                                            )}

                                            {/* 접혔을 때 이벤트 수 요약 */}
                                            {!isMonthOpen && (
                                                <span className="text-xs text-gray-400 font-medium">
                                                    일정 {eventCount}개
                                                </span>
                                            )}

                                            {/* 펼침/접힘 화살표 */}
                                            <span className={`ml-auto text-gray-400 text-sm transition-transform duration-200 ${isMonthOpen ? "rotate-180" : ""}`}>
                                                ▼
                                            </span>
                                        </button>

                                        {/* ── 접혔을 때 구분선 ── */}
                                        {!isMonthOpen && (
                                            <div className="border-b border-gray-200 mb-6" />
                                        )}

                                        {isMonthOpen && (
                                        <>
                                        {/* ── 수업일자 확인 버튼 ── */}
                                        {hasSchedule && (
                                            <div className="mb-3">
                                                <button
                                                    onClick={e => { e.stopPropagation(); toggleSchedule(mon); }}
                                                    className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border transition ${
                                                        isScheduleOpen
                                                            ? "bg-brand-navy-900 text-white border-brand-navy-900"
                                                            : "bg-white text-brand-navy-900 border-brand-navy-900/40 hover:border-brand-navy-900 hover:bg-gray-50"
                                                    }`}
                                                >
                                                    수업일자 확인
                                                    <span className="text-[10px]">{isScheduleOpen ? "▲" : "▼"}</span>
                                                </button>
                                            </div>
                                        )}

                                        {/* ── 수업일자 패널 ── */}
                                        {isScheduleOpen && schedule && (
                                            <div className="mb-4 bg-brand-navy-900 text-white rounded-xl px-5 py-4">
                                                <p className="text-[11px] font-bold text-blue-300 mb-3 uppercase tracking-wide">
                                                    {mon + 1}월 수업일자
                                                </p>
                                                <div className="space-y-1.5">
                                                    {[1, 2, 3, 4, 5, 6].map(day => {
                                                        const dates = schedule[day] ?? [];
                                                        if (dates.length === 0) return null;
                                                        return (
                                                            <div key={day} className="flex items-baseline gap-3">
                                                                <span className="text-sm font-black w-5 shrink-0 text-white">
                                                                    {DAY_NAMES[day]}
                                                                </span>
                                                                <span className="text-sm text-blue-100 tracking-wide">
                                                                    {dates.map(iso => {
                                                                        const d = new Date(iso);
                                                                        const dMon = d.getUTCMonth();
                                                                        // 수강월과 다른 달인 경우 "M/D" 표시, 같은 달이면 "D일"
                                                                        return dMon !== mon
                                                                            ? `${dMon + 1}/${d.getUTCDate()}`
                                                                            : `${d.getUTCDate()}일`;
                                                                    }).join(",  ")}
                                                                </span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}

                                        {/* ── 날짜별 이벤트 그룹 ── */}
                                        <div className="space-y-2 mb-6">
                                            {sortedKeys.map(dateKey => {
                                                const events = dateMap[dateKey];
                                                const d   = new Date(dateKey);
                                                // UTC 메서드 사용 — 날짜가 UTC 자정으로 정규화되어 있으므로
                                                const mo  = d.getUTCMonth() + 1;
                                                const day = d.getUTCDate();
                                                const dow = DOW_KO[d.getUTCDay()];

                                                return (
                                                    <div
                                                        key={dateKey}
                                                        className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm"
                                                    >
                                                        {/* 날짜 헤더 */}
                                                        <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
                                                            <span className="text-sm font-black text-gray-800">
                                                                {mo}월 {day}일
                                                            </span>
                                                            <span className="text-xs font-bold text-gray-400 bg-gray-200 px-1.5 py-0.5 rounded-full leading-none">
                                                                {dow}
                                                            </span>
                                                        </div>

                                                        {/* 이벤트 행 목록 */}
                                                        <div className="divide-y divide-gray-100">
                                                            {events.map(ev => {
                                                                const cat = CATEGORY_STYLES[ev.category] ?? CATEGORY_STYLES["일반"];
                                                                return (
                                                                    <button
                                                                        key={ev.id}
                                                                        onClick={() => setSelectedEvent(ev)}
                                                                        className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-gray-50 active:bg-gray-100 transition group"
                                                                    >
                                                                        <span className={`flex items-center gap-1.5 text-xs font-bold px-2 py-0.5 rounded-full border shrink-0 ${cat.bg} ${cat.text} ${cat.border}`}>
                                                                            <span className={`w-1.5 h-1.5 rounded-full ${cat.dot}`} />
                                                                            {ev.category || "일반"}
                                                                        </span>
                                                                        <span className="flex-1 text-sm font-bold text-gray-900 truncate">
                                                                            {ev.title}
                                                                            {/* 다일 이벤트: "~ M월 D일" 기간 표시 */}
                                                                            {ev.endDate && (() => {
                                                                                const e = new Date(ev.endDate);
                                                                                return (
                                                                                    <span className="ml-1.5 text-xs font-semibold text-gray-400">
                                                                                        ~ {e.getUTCMonth() + 1}월 {e.getUTCDate()}일
                                                                                    </span>
                                                                                );
                                                                            })()}
                                                                        </span>
                                                                        {ev.description && (
                                                                            <span className="hidden sm:block text-xs text-gray-400 truncate max-w-[180px]">
                                                                                {ev.description}
                                                                            </span>
                                                                        )}
                                                                        <span className="text-gray-300 group-hover:text-gray-500 transition text-lg shrink-0 leading-none">
                                                                            ›
                                                                        </span>
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        </>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </section>

            {/* 상세 패널 */}
            <EventDetailPanel
                event={selectedEvent}
                onClose={() => setSelectedEvent(null)}
            />
        </>
    );
}
