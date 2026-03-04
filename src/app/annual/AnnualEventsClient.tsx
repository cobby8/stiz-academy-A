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
}

interface Props {
    allEvents: SerializedEvent[];
    classDays: number[];
    // 서버에서 계산된 수강 연도별·수강월별 수업일자: { 연도: { 수강월(0-11): { 요일(0-6): [ISO날짜, ...] } } }
    yearlySchedules: Record<number, Record<number, Record<number, string[]>>>;
}

export default function AnnualEventsClient({ allEvents, classDays, yearlySchedules }: Props) {
    const router      = useRouter();
    const currentYear = new Date().getFullYear();
    const [selectedYear, setSelectedYear]           = useState(currentYear);
    const [selectedEvent, setSelectedEvent]         = useState<SerializedEvent | null>(null);
    const [openScheduleMonths, setOpenScheduleMonths] = useState<Set<number>>(new Set());
    const [lastSynced, setLastSynced]               = useState<Date>(() => new Date());

    // 5분마다 서버 컴포넌트 재조회 (구글 캘린더 자동 동기화)
    useEffect(() => {
        const id = setInterval(() => {
            router.refresh();
            setLastSynced(new Date());
        }, SYNC_INTERVAL_MS);
        return () => clearInterval(id);
    }, [router]);

    /* ── 연도 목록 ── */
    const availableYears = useMemo(() => {
        const s = new Set<number>();
        allEvents.forEach(e => s.add(new Date(e.date).getFullYear()));
        s.add(currentYear);
        return Array.from(s).sort((a, b) => b - a);
    }, [allEvents, currentYear]);

    /* ── 선택 연도 필터 ── */
    const filteredEvents = useMemo(
        () => allEvents.filter(e => new Date(e.date).getFullYear() === selectedYear),
        [allEvents, selectedYear],
    );

    /* ── month → dateKey → [events] ── */
    const byMonthDate = useMemo(() => {
        const g: Record<number, Record<string, SerializedEvent[]>> = {};
        filteredEvents.forEach(ev => {
            const d   = new Date(ev.date);
            const mon = d.getMonth();
            const key = ev.date.slice(0, 10);
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
                                const dateMap  = byMonthDate[mon];
                                const schedule = yearlySchedules[selectedYear]?.[mon];
                                const hasSchedule = !!schedule &&
                                    classDays.some(d => (schedule[d]?.length ?? 0) > 0);
                                const isOpen     = openScheduleMonths.has(mon);
                                const sortedKeys = Object.keys(dateMap).sort();

                                return (
                                    <div key={mon}>
                                        {/* ── 월 헤더 ── */}
                                        <div className="flex items-center gap-3 mb-3">
                                            <h2 className="text-xl font-black text-brand-navy-900 flex items-center gap-2">
                                                <span className="w-8 h-8 bg-brand-navy-900 text-white rounded-full flex items-center justify-center text-sm font-black">
                                                    {mon + 1}
                                                </span>
                                                {MONTH_NAMES[mon]}
                                            </h2>

                                            {/* 수업일자 확인 버튼 */}
                                            {hasSchedule && (
                                                <button
                                                    onClick={() => toggleSchedule(mon)}
                                                    className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border transition ${
                                                        isOpen
                                                            ? "bg-brand-navy-900 text-white border-brand-navy-900"
                                                            : "bg-white text-brand-navy-900 border-brand-navy-900/40 hover:border-brand-navy-900 hover:bg-gray-50"
                                                    }`}
                                                >
                                                    수업일자 확인
                                                    <span className="text-[10px]">{isOpen ? "▲" : "▼"}</span>
                                                </button>
                                            )}
                                        </div>

                                        {/* ── 수업일자 패널 ── */}
                                        {isOpen && schedule && (
                                            <div className="mb-4 bg-brand-navy-900 text-white rounded-xl px-5 py-4">
                                                <p className="text-[11px] font-bold text-blue-300 mb-3 uppercase tracking-wide">
                                                    {mon + 1}월 수업일자 &nbsp;·&nbsp; {classDays.map(d => DAY_NAMES[d]).join(" · ")} 기준
                                                </p>
                                                <div className="space-y-1.5">
                                                    {classDays.map(day => {
                                                        const dates = schedule[day] ?? [];
                                                        return (
                                                            <div key={day} className="flex items-baseline gap-3">
                                                                <span className="text-sm font-black w-5 shrink-0 text-white">
                                                                    {DAY_NAMES[day]}
                                                                </span>
                                                                <span className="text-sm text-blue-100 tracking-wide">
                                                                    {dates.length > 0
                                                                        ? dates.map(iso => {
                                                                            const d = new Date(iso);
                                                                            const dMon = d.getMonth();
                                                                            // 수강월과 다른 달인 경우 "M/D" 표시, 같은 달이면 "D일"
                                                                            return dMon !== mon
                                                                                ? `${dMon + 1}/${d.getDate()}`
                                                                                : `${d.getDate()}일`;
                                                                        }).join(",  ")
                                                                        : <span className="text-blue-400 italic text-xs">수업 없음</span>
                                                                    }
                                                                </span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}

                                        {/* ── 날짜별 이벤트 그룹 ── */}
                                        <div className="space-y-2">
                                            {sortedKeys.map(dateKey => {
                                                const events = dateMap[dateKey];
                                                const d   = new Date(dateKey);
                                                const mo  = d.getMonth() + 1;
                                                const day = d.getDate();
                                                const dow = DOW_KO[d.getDay()];

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
