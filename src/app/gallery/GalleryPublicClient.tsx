"use client";

import { useState, useEffect, useCallback } from "react";
// Material Symbols Outlined 아이콘 사용 (프로젝트 conventions: lucide-react 금지)

type MediaItem = { url: string; type: "image" | "video" };
type GalleryPost = {
    id: string;
    title: string | null;
    caption: string | null;
    mediaJSON: string;
    createdAt: Date | string;
    className: string | null;
};

export default function GalleryPublicClient({ posts }: { posts: GalleryPost[] }) {
    const [lightbox, setLightbox] = useState<{ postIdx: number; mediaIdx: number } | null>(null);

    // 빈 갤러리 — 아이콘 + 안내 메시지 표시
    if (posts.length === 0) {
        return (
            <div className="text-center py-20 text-gray-400">
                <span className="material-symbols-outlined mx-auto mb-4 text-gray-300" style={{ fontSize: 64 }}>image</span>
                <p className="text-lg font-medium">아직 갤러리가 비어있습니다</p>
                <p className="text-sm mt-1">곧 수업 사진이 업로드됩니다.</p>
            </div>
        );
    }

    // 모든 미디어를 1차원 배열로 펼침 — 라이트박스 좌우 네비게이션용
    const allMedia: { media: MediaItem; post: GalleryPost; postIdx: number; mediaIdx: number }[] = [];
    posts.forEach((post, pi) => {
        let media: MediaItem[] = [];
        try { media = JSON.parse(post.mediaJSON); } catch {}
        media.forEach((m, mi) => { allMedia.push({ media: m, post, postIdx: pi, mediaIdx: mi }); });
    });

    const lbItem = lightbox ? allMedia.find(a => a.postIdx === lightbox.postIdx && a.mediaIdx === lightbox.mediaIdx) : null;
    const lbFlatIdx = lbItem ? allMedia.indexOf(lbItem) : -1;

    function nextLb() {
        if (lbFlatIdx < allMedia.length - 1) {
            const next = allMedia[lbFlatIdx + 1];
            setLightbox({ postIdx: next.postIdx, mediaIdx: next.mediaIdx });
        }
    }
    function prevLb() {
        if (lbFlatIdx > 0) {
            const prev = allMedia[lbFlatIdx - 1];
            setLightbox({ postIdx: prev.postIdx, mediaIdx: prev.mediaIdx });
        }
    }

    return (
        <>
            {/* 갤러리 그리드 — 반응형 2/3/4열 */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
                {posts.map((post, pi) => {
                    let media: MediaItem[] = [];
                    try { media = JSON.parse(post.mediaJSON); } catch {}
                    if (media.length === 0) return null;
                    return media.map((m, mi) => (
                        <div key={`${post.id}-${mi}`}
                            className="aspect-square rounded-2xl overflow-hidden bg-gray-100 dark:bg-gray-800 cursor-pointer relative group shadow-sm hover:shadow-lg transition-all duration-300"
                            onClick={() => setLightbox({ postIdx: pi, mediaIdx: mi })}>
                            {/* 미디어 — 이미지 또는 동영상 */}
                            {m.type === "image" ? (
                                <img src={m.url} alt={post.title || ""} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                            ) : (
                                <>
                                    <video src={m.url} className="w-full h-full object-cover" muted />
                                    {/* 동영상 재생 아이콘 표시 */}
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                        <div className="w-12 h-12 rounded-full bg-black/50 flex items-center justify-center">
                                            <span className="material-symbols-outlined text-white ml-1" style={{ fontSize: 20 }}>play_arrow</span>
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* 호버 오버레이 — 제목 + 날짜 표시 (개선된 그라데이션) */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/0 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                <div className="absolute bottom-0 left-0 right-0 p-3 md:p-4">
                                    {/* 게시물 제목 — 첫 번째 미디어에만 표시 */}
                                    {mi === 0 && post.title && (
                                        <p className="text-white text-sm font-bold truncate mb-1">{post.title}</p>
                                    )}
                                    {/* 날짜 표시 */}
                                    <p className="text-white/70 text-xs flex items-center gap-1">
                                        <span className="material-symbols-outlined" style={{ fontSize: 10 }}>calendar_today</span>
                                        {new Date(post.createdAt).toLocaleDateString("ko-KR")}
                                    </p>
                                </div>
                            </div>

                            {/* 모바일에서는 항상 제목 표시 (호버 불가하므로) */}
                            {mi === 0 && post.title && (
                                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3 md:hidden">
                                    <p className="text-white text-xs font-medium truncate">{post.title}</p>
                                </div>
                            )}
                        </div>
                    ));
                })}
            </div>

            {/* 라이트박스 — 전체화면 이미지/동영상 뷰어 + 좌우 네비게이션 */}
            {lightbox && lbItem && (
                <LightboxOverlay
                    item={lbItem}
                    flatIdx={lbFlatIdx}
                    total={allMedia.length}
                    onClose={() => setLightbox(null)}
                    onPrev={prevLb}
                    onNext={nextLb}
                />
            )}
        </>
    );
}

/**
 * LightboxOverlay — 전체화면 라이트박스 컴포넌트
 *
 * 라이트박스를 별도 컴포넌트로 분리하여:
 * 1. ESC 키 + 좌우 화살표 키보드 네비게이션 지원
 * 2. body 스크롤 잠금 처리
 * 3. 접근성 향상 (aria-label, 키보드 포커스)
 */
function LightboxOverlay({
    item,
    flatIdx,
    total,
    onClose,
    onPrev,
    onNext,
}: {
    item: { media: MediaItem; post: GalleryPost; postIdx: number; mediaIdx: number };
    flatIdx: number;
    total: number;
    onClose: () => void;
    onPrev: () => void;
    onNext: () => void;
}) {
    // 키보드 네비게이션 — ESC(닫기), 좌(이전), 우(다음)
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (e.key === "Escape") onClose();
        if (e.key === "ArrowLeft") onPrev();
        if (e.key === "ArrowRight") onNext();
    }, [onClose, onPrev, onNext]);

    useEffect(() => {
        document.addEventListener("keydown", handleKeyDown);
        // 라이트박스 열릴 때 body 스크롤 잠금
        document.body.style.overflow = "hidden";
        return () => {
            document.removeEventListener("keydown", handleKeyDown);
            document.body.style.overflow = "";
        };
    }, [handleKeyDown]);

    return (
        <div
            className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center"
            onClick={onClose}
            aria-label="갤러리 라이트박스"
        >
            {/* 닫기 버튼 */}
            <button
                onClick={onClose}
                className="absolute top-4 right-4 text-white/60 hover:text-white z-10 p-2 rounded-full hover:bg-white dark:hover:bg-gray-800/10 transition-colors"
                aria-label="닫기"
            >
                <span className="material-symbols-outlined" style={{ fontSize: 28 }}>close</span>
            </button>

            {/* 카운터 — 현재 위치 / 전체 개수 */}
            <div className="absolute top-5 left-1/2 -translate-x-1/2 text-white/40 text-sm z-10">
                {flatIdx + 1} / {total}
            </div>

            {/* 이전 버튼 */}
            {flatIdx > 0 && (
                <button
                    onClick={e => { e.stopPropagation(); onPrev(); }}
                    className="absolute left-2 md:left-6 text-white/40 hover:text-white z-10 p-2 rounded-full hover:bg-white dark:hover:bg-gray-800/10 transition-colors"
                    aria-label="이전 사진"
                >
                    <span className="material-symbols-outlined" style={{ fontSize: 36 }}>chevron_left</span>
                </button>
            )}

            {/* 다음 버튼 */}
            {flatIdx < total - 1 && (
                <button
                    onClick={e => { e.stopPropagation(); onNext(); }}
                    className="absolute right-2 md:right-6 text-white/40 hover:text-white z-10 p-2 rounded-full hover:bg-white dark:hover:bg-gray-800/10 transition-colors"
                    aria-label="다음 사진"
                >
                    <span className="material-symbols-outlined" style={{ fontSize: 36 }}>chevron_right</span>
                </button>
            )}

            {/* 미디어 콘텐츠 영역 */}
            <div className="max-w-5xl max-h-[90vh] mx-4 flex flex-col items-center" onClick={e => e.stopPropagation()}>
                {item.media.type === "image" ? (
                    <img
                        src={item.media.url}
                        alt={item.post.title || "갤러리 이미지"}
                        className="max-w-full max-h-[78vh] object-contain rounded-lg"
                    />
                ) : (
                    <video
                        src={item.media.url}
                        controls
                        autoPlay
                        className="max-w-full max-h-[78vh] rounded-lg"
                    />
                )}

                {/* 제목/설명/날짜 — 미디어 아래에 표시 */}
                {(item.post.title || item.post.caption) && (
                    <div className="mt-4 text-center max-w-lg">
                        {item.post.title && (
                            <p className="text-white font-bold text-lg">{item.post.title}</p>
                        )}
                        {item.post.caption && (
                            <p className="text-white/60 text-sm mt-1 leading-relaxed">{item.post.caption}</p>
                        )}
                        <p className="text-white/30 text-xs mt-3">
                            {new Date(item.post.createdAt).toLocaleDateString("ko-KR", {
                                year: "numeric",
                                month: "long",
                                day: "numeric",
                            })}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
