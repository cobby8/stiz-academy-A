/**
 * 시뮬레이터 페이지 로딩 UI — Suspense fallback으로 자동 사용됨
 * 실제 콘텐츠와 비슷한 스켈레톤 형태로 표시하여 레이아웃 이동(Layout Shift)을 줄인다.
 */
export default function SimulatorLoading() {
    return (
        <div className="min-h-screen bg-white dark:bg-gray-800">
            {/* 히어로 영역 스켈레톤 */}
            <div className="bg-gradient-to-br from-brand-navy-900 via-brand-navy-800 to-brand-navy-900 py-16 md:py-20">
                <div className="max-w-6xl mx-auto px-6 md:px-4">
                    <div className="h-4 w-24 bg-white dark:bg-gray-800/10 rounded mb-4 animate-pulse" />
                    <div className="h-10 w-64 bg-white dark:bg-gray-800/10 rounded mb-4 animate-pulse" />
                    <div className="h-5 w-80 bg-white dark:bg-gray-800/10 rounded animate-pulse" />
                </div>
            </div>

            {/* 위저드 영역 스켈레톤 */}
            <div className="py-12 md:py-16 bg-surface-section dark:bg-gray-900 transition-colors duration-300">
                <div className="max-w-2xl mx-auto px-6">
                    {/* 단계 표시 바 */}
                    <div className="flex items-center justify-center gap-2 mb-10">
                        {[1, 2, 3].map((s) => (
                            <div key={s} className="flex items-center gap-2">
                                <div className="w-9 h-9 rounded-full bg-gray-200 animate-pulse" />
                                {s < 3 && <div className="w-12 sm:w-16 h-1 rounded-full bg-gray-200 animate-pulse" />}
                            </div>
                        ))}
                    </div>

                    {/* 카드 스켈레톤 */}
                    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 transition-colors duration-300 shadow-sm p-6 md:p-8">
                        <div className="h-7 w-48 bg-gray-100 dark:bg-gray-800 rounded mb-3 animate-pulse" />
                        <div className="h-4 w-64 bg-gray-100 dark:bg-gray-800 rounded mb-6 animate-pulse" />
                        <div className="h-12 w-full bg-gray-100 dark:bg-gray-800 rounded-xl mb-6 animate-pulse" />
                        <div className="h-12 w-full bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
                    </div>
                </div>
            </div>
        </div>
    );
}
