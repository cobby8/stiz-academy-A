// 공지사항 페이지 로딩 중 보여줄 스켈레톤 UI
// 히어로 + 공지 리스트 형태로 실제 레이아웃과 유사하게 잡아둔다
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

        {/* 공지사항 리스트 스켈레톤 */}
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="bg-gray-200 rounded-xl h-20 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
