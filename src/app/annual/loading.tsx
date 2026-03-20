// 연간일정 페이지 로딩 중 보여줄 스켈레톤 UI
// 히어로 + 캘린더 격자 형태로 실제 레이아웃과 유사하게 잡아둔다
export default function Loading() {
  return (
    <div className="animate-pulse">
      {/* 히어로 영역 스켈레톤 */}
      <div className="bg-brand-navy-900 h-48 md:h-56" />

      {/* 콘텐츠 영역 */}
      <div className="max-w-6xl mx-auto px-4 py-16 space-y-8">
        {/* 섹션 타이틀 스켈레톤 */}
        <div className="flex flex-col items-center gap-3">
          <div className="bg-gray-200 rounded-xl h-8 w-44" />
          <div className="bg-gray-200 rounded-xl h-4 w-60" />
        </div>

        {/* 월 네비게이션 스켈레톤 */}
        <div className="flex items-center justify-center gap-4">
          <div className="bg-gray-200 rounded-full h-10 w-10" />
          <div className="bg-gray-200 rounded-xl h-8 w-32" />
          <div className="bg-gray-200 rounded-full h-10 w-10" />
        </div>

        {/* 캘린더 격자 스켈레톤 (7열 x 5행) */}
        <div className="grid grid-cols-7 gap-1">
          {/* 요일 헤더 */}
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={`h-${i}`} className="bg-gray-200 rounded-lg h-8" />
          ))}
          {/* 날짜 셀 */}
          {Array.from({ length: 35 }).map((_, i) => (
            <div key={`d-${i}`} className="bg-gray-200 rounded-lg h-20 md:h-24" />
          ))}
        </div>
      </div>
    </div>
  );
}
