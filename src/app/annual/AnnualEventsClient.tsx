"use client";

import { useState, useMemo } from "react";

const CATEGORY_STYLES: Record<string, { bg: string; text: string; dot: string; border: string }> = {
    대회: { bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500", border: "border-red-200" },
    방학: { bg: "bg-yellow-50", text: "text-yellow-700", dot: "bg-yellow-500", border: "border-yellow-200" },
    특별행사: { bg: "bg-purple-50", text: "text-purple-700", dot: "bg-purple-500", border: "border-purple-200" },
    정기행사: { bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500", border: "border-blue-200" },
    일반: { bg: "bg-gray-50", text: "text-gray-700", dot: "bg-gray-400", border: "border-gray-200" },
};

const MONTH_NAMES = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];

// date는 ISO 문자열로 전달됨
function formatDate(isoString: string, isAllDay: boolean): string {
    const d = new Date(isoString);
    const month = d.getMonth() + 1;
    const day = d.getDate();
    if (isAllDay) return `${month}월 ${day}일`;
    const hh = d.getHours().toString().padStart(2, "0");
    const mm = d.getMinutes().toString().padStart(2, "0");
    return `${month}월 ${day}일 ${hh}:${mm}`;
}

export interface SerializedEvent {
    id: string;
    title: string;
    date: string;        // ISO string
    endDate?: string;    // ISO string
    description?: string;
    category: string;
    isAllDay: boolean;
    source: "db" | "google";
}

interface Props {
    allEvents: SerializedEvent[];
}

export default function AnnualEventsClient({ allEvents }: Props) {
    const currentYear = new Date().getFullYear();
    const [selectedYear, setSelectedYear] = useState(currentYear);

    // 이벤트에서 사용 가능한 연도 목록 (내림차순)
    const availableYears = useMemo(() => {
        const yearSet = new Set<number>();
        allEvents.forEach((e) => yearSet.add(new Date(e.date).getFullYear()));
        // 현재 연도가 없으면 추가
        yearSet.add(currentYear);
        return Array.from(yearSet).sort((a, b) => b - a);
    }, [allEvents, currentYear]);

    // 선택 연도 일정 필터
    const filteredEvents = useMemo(
        () => allEvents.filter((e) => new Date(e.date).getFullYear() === selectedYear),
        [allEvents, selectedYear]
    );

    // 월별 그룹핑
    const eventsByMonth = useMemo(() => {
        const groups: Record<number, SerializedEvent[]> = {};
        filteredEvents.forEach((event) => {
            const month = new Date(event.date).getMonth();
            if (!groups[month]) groups[month] = [];
            groups[month].push(event);
        });
        return groups;
    }, [filteredEvents]);

    const activeMonths = Object.keys(eventsByMonth).map(Number).sort((a, b) => a - b);

    return (
        <section className="py-14 bg-gray-50">
            <div className="max-w-4xl mx-auto px-4">
                {/* 연도 선택 */}
                <div className="flex items-center gap-3 mb-8 flex-wrap">
                    <span className="text-sm font-bold text-gray-500">연도 선택:</span>
                    <div className="flex gap-2 flex-wrap">
                        {availableYears.map((year) => (
                            <button
                                key={year}
                                onClick={() => setSelectedYear(year)}
                                className={`px-4 py-1.5 rounded-full text-sm font-bold transition ${
                                    selectedYear === year
                                        ? "bg-brand-navy-900 text-white shadow"
                                        : "bg-white text-gray-600 border border-gray-200 hover:border-gray-400 hover:text-gray-900"
                                }`}
                            >
                                {year}년
                            </button>
                        ))}
                    </div>
                </div>

                {/* 일정 목록 */}
                {filteredEvents.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-2xl border border-gray-200 text-gray-400">
                        <div className="text-5xl mb-4">📅</div>
                        <p className="text-lg font-medium">{selectedYear}년 등록된 일정이 없습니다.</p>
                        <p className="text-sm mt-2">관리자가 일정을 등록하면 여기에 표시됩니다.</p>
                    </div>
                ) : (
                    <div className="space-y-8">
                        {activeMonths.map((month) => (
                            <div key={month}>
                                <h2 className="text-xl font-black text-brand-navy-900 mb-4 flex items-center gap-2">
                                    <span className="w-8 h-8 bg-brand-navy-900 text-white rounded-full flex items-center justify-center text-sm font-black">
                                        {month + 1}
                                    </span>
                                    {MONTH_NAMES[month]}
                                </h2>
                                <div className="space-y-3">
                                    {eventsByMonth[month].map((event) => {
                                        const catStyle = CATEGORY_STYLES[event.category] || CATEGORY_STYLES["일반"];
                                        return (
                                            <div
                                                key={event.id}
                                                className={`${catStyle.bg} rounded-xl p-4 border ${catStyle.border} flex flex-col sm:flex-row sm:items-start gap-3`}
                                            >
                                                {/* 날짜 영역 */}
                                                <div className="shrink-0 sm:min-w-[110px]">
                                                    <p className="font-black text-gray-900 text-sm">
                                                        {formatDate(event.date, event.isAllDay)}
                                                    </p>
                                                    {event.endDate && (
                                                        <p className="text-xs text-gray-500 mt-0.5">
                                                            ~ {formatDate(event.endDate, event.isAllDay)}
                                                        </p>
                                                    )}
                                                </div>

                                                {/* 내용 영역 */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex flex-wrap items-center gap-2 mb-1">
                                                        <span className={`flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full ${catStyle.bg} ${catStyle.text} border ${catStyle.border}`}>
                                                            <span className={`w-2 h-2 rounded-full ${catStyle.dot}`}></span>
                                                            {event.category || "일반"}
                                                        </span>
                                                        <h3 className="font-bold text-gray-900">{event.title}</h3>
                                                    </div>
                                                    {event.description && (
                                                        <p className="text-sm text-gray-600 mt-1 leading-relaxed">
                                                            {event.description}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </section>
    );
}
