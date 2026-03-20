// 시간표 페이지 로딩 중 보여줄 스켈레톤 UI
// 히어로 + 필터 탭 + 시간표 격자로 실제 레이아웃을 미리 보여준다
export default function Loading() {
  return (
    <div className="animate-pulse">
      {/* 히어로 영역 스켈레톤 */}
      <div className="bg-brand-navy-900 h-48 md:h-56" />

      {/* 콘텐츠 영역 */}
      <div className="max-w-6xl mx-auto px-4 py-16 space-y-8">
        {/* 섹션 타이틀 스켈레톤 */}
        <div className="flex flex-col items-center gap-3">
          <div className="bg-gray-200 rounded-xl h-8 w-40" />
          <div className="bg-gray-200 rounded-xl h-4 w-64" />
        </div>

        {/* 필터 탭 스켈레톤 (프로그램 선택 버튼들) */}
        <div className="flex gap-3 justify-center flex-wrap">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-gray-200 rounded-full h-10 w-24" />
          ))}
        </div>

        {/* 시간표 격자 스켈레톤 (요일별 컬럼) */}
        <div className="grid grid-cols-5 md:grid-cols-7 gap-2">
          {/* 요일 헤더 */}
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={`h-${i}`} className="bg-gray-200 rounded-lg h-10 hidden md:block" />
          ))}
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={`hm-${i}`} className="bg-gray-200 rounded-lg h-10 md:hidden" />
          ))}
          {/* 시간표 셀 */}
          {Array.from({ length: 35 }).map((_, i) => (
            <div key={`c-${i}`} className="bg-gray-200 rounded-lg h-16 hidden md:block" />
          ))}
          {Array.from({ length: 25 }).map((_, i) => (
            <div key={`cm-${i}`} className="bg-gray-200 rounded-lg h-16 md:hidden" />
          ))}
        </div>
      </div>
    </div>
  );
}
