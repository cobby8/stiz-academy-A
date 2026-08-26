"use client";

import { useState } from "react";
import RouteSection from "@/components/seasonal/RouteSection";
import type { DispatchSuggestion } from "@/lib/seasonal/shuttle-optimize";

// 정규 셔틀 동적배차 — 요일별로 관리한다. 요일 탭을 고르면 그 요일의 등원 → 하원 노선을 함께 보여준다.
// 방학특강 배차 화면(DispatchClient)과 동일 UX 를 재사용하되, 관리 단위가 "날짜"가 아니라 "요일"이다.
// RouteSection 에 apiBase="/api/admin/regular/dispatch" 를 주입해 정규 저장/불러오기/재계산 엔드포인트를 태운다.
// 명단 편집(무료탑승 드래그·학생 상세 모달)은 방학특강 전용이라 rosterEditable=false 로 끈다.

const REGULAR_API = "/api/admin/regular/dispatch";
const DOW_LABEL: Record<string, string> = {
  Mon: "월요일", Tue: "화요일", Wed: "수요일", Thu: "목요일", Fri: "금요일", Sat: "토요일", Sun: "일요일",
};

export default function RegularDispatchClient({ weekdays, initialDay, initialPickup, initialDropoff, serviceMonth }: {
  weekdays: string[];            // 셔틀 학생이 있는 요일 목록("Mon" 등, 월→일 정렬)
  initialDay: string;            // 최초 표시 요일
  initialPickup: DispatchSuggestion;
  initialDropoff: DispatchSuggestion;
  serviceMonth: string;
}) {
  const [day, setDay] = useState<string>(initialDay);

  return (
    <div className="mx-auto max-w-6xl px-4 py-4">
      <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <h3 className="text-base font-black text-gray-900 dark:text-white">정규 셔틀 배차 · 하루 타임라인</h3>
        {/* 조작 설명은 뺐다. 좌표의 출처(학생 신청서)는 데이터 출처 정보라 반드시 남긴다. */}
        <p className="mt-0.5 text-[12.5px] text-gray-500 dark:text-gray-400">
          좌표는 <b>학생 신청서</b>에서 자동으로 가져옵니다.
        </p>

        {/* 요일 탭 — 노선 관리 단위 */}
        <div className="mt-3 flex flex-wrap items-center gap-1 rounded-xl bg-gray-100 p-1 dark:bg-gray-900">
          {weekdays.length === 0 && <span className="px-2 py-1 text-sm font-bold text-gray-400">셔틀 이용 학생이 있는 요일이 없습니다.</span>}
          {weekdays.map((w) => (
            <button key={w} onClick={() => setDay(w)}
              className={`min-h-9 rounded-lg px-4 text-sm font-black ${day === w ? "bg-white text-brand-navy-900 shadow dark:bg-gray-700 dark:text-white" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"}`}>
              {DOW_LABEL[w] ?? w}
            </button>
          ))}
        </div>

        <p className="mt-3 text-[12.5px] font-black text-gray-700 dark:text-gray-200">📅 {DOW_LABEL[day] ?? day} 노선</p>

        {/* 하루 타임라인: 등원 → 하원. date prop 자리에 요일 문자열을 넘긴다(RouteSection 은 이를 저장/조회 키로만 쓴다). */}
        <div className="mt-2 space-y-3">
          <RouteSection initial={initialPickup} date={day} refreshKey={0} apiBase={REGULAR_API} rosterEditable={false} serviceMonth={serviceMonth} />
          <RouteSection initial={initialDropoff} date={day} refreshKey={0} apiBase={REGULAR_API} rosterEditable={false} serviceMonth={serviceMonth} />
        </div>
      </div>
    </div>
  );
}
