// 학원소개 페이지 로딩 중 보여줄 스켈레톤 UI
// 실제 콘텐츠가 로드되기 전에 회색 박스 + 펄스 애니메이션으로 레이아웃을 미리 잡아둔다
export default function Loading() {
  return (
    <div className="animate-pulse">
      {/* 히어로 영역 스켈레톤 */}
      <div className="bg-brand-navy-900 h-48 md:h-56" />

      {/* 콘텐츠 영역 */}
      <div className="max-w-6xl mx-auto px-4 py-16 space-y-12">
        {/* 섹션 타이틀 스켈레톤 */}
        <div className="flex flex-col items-center gap-3">
          <div className="bg-gray-200 rounded-xl h-8 w-48" />
          <div className="bg-gray-200 rounded-xl h-4 w-72" />
        </div>

        {/* 카드 3개 (학원 소개 주요 항목) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-gray-200 rounded-xl h-56" />
          ))}
        </div>

        {/* 추가 텍스트 블록 스켈레톤 */}
        <div className="space-y-3">
          <div className="bg-gray-200 rounded-xl h-4 w-full" />
          <div className="bg-gray-200 rounded-xl h-4 w-5/6" />
          <div className="bg-gray-200 rounded-xl h-4 w-4/6" />
        </div>
      </div>
    </div>
  );
}
