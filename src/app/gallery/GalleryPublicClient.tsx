"use client";

import { useState } from "react";
import { X, ChevronLeft, ChevronRight, Image as ImageIcon } from "lucide-react";

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

    if (posts.length === 0) {
        return (
            <div className="text-center py-20 text-gray-400">
                <ImageIcon className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p className="text-lg font-medium">아직 갤러리가 비어있습니다</p>
                <p className="text-sm mt-1">곧 수업 사진이 업로드됩니다.</p>
            </div>
        );
    }

    // All media items flattened for lightbox
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
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {posts.map((post, pi) => {
                    let media: MediaItem[] = [];
                    try { media = JSON.parse(post.mediaJSON); } catch {}
                    if (media.length === 0) return null;
                    return media.map((m, mi) => (
                        <div key={`${post.id}-${mi}`}
                            className="aspect-square rounded-xl overflow-hidden bg-gray-100 cursor-pointer relative group"
                            onClick={() => setLightbox({ postIdx: pi, mediaIdx: mi })}>
                            {m.type === "image" ? (
                                <img src={m.url} alt={post.title || ""} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                            ) : (
                                <video src={m.url} className="w-full h-full object-cover" muted />
                            )}
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                            {mi === 0 && post.title && (
                                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3">
                                    <p className="text-white text-xs font-medium truncate">{post.title}</p>
                                </div>
                            )}
                        </div>
                    ));
                })}
            </div>

            {/* Lightbox */}
            {lightbox && lbItem && (
                <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center" onClick={() => setLightbox(null)}>
                    <button onClick={() => setLightbox(null)} className="absolute top-4 right-4 text-white/80 hover:text-white z-10">
                        <X size={28} />
                    </button>
                    {lbFlatIdx > 0 && (
                        <button onClick={e => { e.stopPropagation(); prevLb(); }}
                            className="absolute left-4 text-white/60 hover:text-white z-10">
                            <ChevronLeft size={36} />
                        </button>
                    )}
                    {lbFlatIdx < allMedia.length - 1 && (
                        <button onClick={e => { e.stopPropagation(); nextLb(); }}
                            className="absolute right-4 text-white/60 hover:text-white z-10">
                            <ChevronRight size={36} />
                        </button>
                    )}
                    <div className="max-w-4xl max-h-[85vh] mx-4" onClick={e => e.stopPropagation()}>
                        {lbItem.media.type === "image" ? (
                            <img src={lbItem.media.url} alt="" className="max-w-full max-h-[75vh] object-contain rounded-lg" />
                        ) : (
                            <video src={lbItem.media.url} controls autoPlay className="max-w-full max-h-[75vh] rounded-lg" />
                        )}
                        {(lbItem.post.title || lbItem.post.caption) && (
                            <div className="mt-4 text-center">
                                {lbItem.post.title && <p className="text-white font-bold">{lbItem.post.title}</p>}
                                {lbItem.post.caption && <p className="text-white/70 text-sm mt-1">{lbItem.post.caption}</p>}
                                <p className="text-white/40 text-xs mt-2">{new Date(lbItem.post.createdAt).toLocaleDateString("ko-KR")}</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}
