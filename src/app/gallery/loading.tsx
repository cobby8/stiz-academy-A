// 갤러리 페이지 로딩 중 보여줄 스켈레톤 UI
// 히어로 + 이미지 카드 격자 형태로 실제 갤러리 레이아웃과 유사하게 잡아둔다
export default function Loading() {
  return (
    <div className="animate-pulse">
      {/* 히어로 영역 스켈레톤 */}
      <div className="bg-brand-navy-900 h-48 md:h-56" />

      {/* 콘텐츠 영역 */}
      <div className="max-w-6xl mx-auto px-4 py-16 space-y-8">
        {/* 섹션 타이틀 스켈레톤 */}
        <div className="flex flex-col items-center gap-3">
          <div className="bg-gray-200 rounded-xl h-8 w-36" />
          <div className="bg-gray-200 rounded-xl h-4 w-56" />
        </div>

        {/* 이미지 격자 스켈레톤 (2x3 또는 3x3) */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="space-y-2">
              {/* 이미지 자리 (정사각형 비율) */}
              <div className="bg-gray-200 rounded-xl aspect-square" />
              {/* 캡션 자리 */}
              <div className="bg-gray-200 rounded-xl h-4 w-3/4" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
