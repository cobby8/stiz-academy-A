import GalleryLightboxController, { type GalleryLightboxItem } from "./GalleryLightboxController";
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
    const items = getGalleryItems(posts);

    // 빈 갤러리 — 아이콘 + 안내 메시지 표시
    if (items.length === 0) {
        return (
            <div className="text-center py-20 text-gray-400">
                <span className="material-symbols-outlined mx-auto mb-4 text-gray-300" style={{ fontSize: 64 }}>image</span>
                <p className="text-lg font-medium">아직 갤러리가 비어있습니다</p>
                <p className="text-sm mt-1">곧 수업 사진이 업로드됩니다.</p>
            </div>
        );
    }

    return (
        <>
            {/* 갤러리 그리드 — 반응형 2/3/4열 */}
            <div data-gallery-root className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
                {items.map((item, index) => (
                    <button
                        key={`${item.postId}-${item.mediaIdx}`}
                        type="button"
                        data-gallery-index={index}
                        className="aspect-square rounded-2xl overflow-hidden bg-gray-100 dark:bg-gray-800 cursor-pointer relative group shadow-sm hover:shadow-lg transition-all duration-300 text-left"
                        aria-label={`${item.title || "갤러리 이미지"} 크게 보기`}
                    >
                        {/* 미디어 — 이미지 또는 동영상 */}
                        {item.type === "image" ? (
                            <img
                                src={item.url}
                                alt={item.title || "갤러리 이미지"}
                                loading={index < 4 ? "eager" : "lazy"}
                                decoding="async"
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            />
                        ) : (
                            <>
                                <video src={item.url} className="w-full h-full object-cover" muted preload="metadata" />
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
                                {item.mediaIdx === 0 && item.title && (
                                    <p className="text-white text-sm font-bold truncate mb-1">{item.title}</p>
                                )}
                                {/* 날짜 표시 */}
                                <p className="text-white/70 text-xs flex items-center gap-1">
                                    <span className="material-symbols-outlined" style={{ fontSize: 10 }}>calendar_today</span>
                                    {item.displayDate}
                                </p>
                            </div>
                        </div>

                        {/* 모바일에서는 항상 제목 표시 (호버 불가하므로) */}
                        {item.mediaIdx === 0 && item.title && (
                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3 md:hidden">
                                <p className="text-white text-xs font-medium truncate">{item.title}</p>
                            </div>
                        )}
                    </button>
                ))}
            </div>

            <GalleryLightboxController items={items} />
        </>
    );
}

function getGalleryItems(posts: GalleryPost[]): GalleryLightboxItem[] {
    const items: GalleryLightboxItem[] = [];

    posts.forEach((post) => {
        let media: MediaItem[] = [];
        try {
            media = JSON.parse(post.mediaJSON);
        } catch {}

        media.forEach((item, mediaIdx) => {
            if (typeof item?.url !== "string" || item.url.trim().length === 0) return;

            const createdAt = new Date(post.createdAt);
            items.push({
                url: item.url,
                type: item.type === "video" ? "video" : "image",
                title: post.title,
                caption: post.caption,
                postId: post.id,
                mediaIdx,
                createdAt: createdAt.toISOString(),
                displayDate: createdAt.toLocaleDateString("ko-KR"),
            });
        });
    });

    return items;
}
