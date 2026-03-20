// 체험신청 페이지 로딩 중 보여줄 스켈레톤 UI
// 히어로 + 안내 카드 2개 형태로 실제 레이아웃과 유사하게 잡아둔다
export default function Loading() {
  return (
    <div className="animate-pulse">
      {/* 히어로 영역 스켈레톤 */}
      <div className="bg-brand-navy-900 h-48 md:h-56" />

      {/* 콘텐츠 영역 */}
      <div className="max-w-6xl mx-auto px-4 py-16 space-y-12">
        {/* 섹션 타이틀 스켈레톤 */}
        <div className="flex flex-col items-center gap-3">
          <div className="bg-gray-200 rounded-xl h-8 w-44" />
          <div className="bg-gray-200 rounded-xl h-4 w-72" />
        </div>

        {/* 카드 2개 (신청 안내 + 신청 폼) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* 안내 카드 */}
          <div className="bg-gray-200 rounded-xl h-72" />
          {/* 신청 폼 카드 */}
          <div className="bg-gray-200 rounded-xl h-72" />
        </div>
      </div>
    </div>
  );
}
