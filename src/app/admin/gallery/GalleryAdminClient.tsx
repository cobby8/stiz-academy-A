"use client";

import { useState, useTransition } from "react";
import { createGalleryPost, updateGalleryPost, deleteGalleryPost } from "@/app/actions/admin";
import { Plus, Trash2, Edit2, Eye, EyeOff, X, Upload, Image as ImageIcon } from "lucide-react";

type MediaItem = { url: string; type: "image" | "video" };
type GalleryPost = {
    id: string;
    classId: string | null;
    title: string | null;
    caption: string | null;
    mediaJSON: string;
    isPublic: boolean;
    createdAt: Date | string;
    className: string | null;
};
type ClassInfo = { id: string; name: string; program?: { name: string } | null };

export default function GalleryAdminClient({ posts, classes }: { posts: GalleryPost[]; classes: ClassInfo[] }) {
    const [isPending, startTransition] = useTransition();
    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [classId, setClassId] = useState<string>("");
    const [title, setTitle] = useState("");
    const [caption, setCaption] = useState("");
    const [isPublic, setIsPublic] = useState(true);
    const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
    const [uploading, setUploading] = useState(false);

    function resetForm() {
        setEditId(null);
        setClassId("");
        setTitle("");
        setCaption("");
        setIsPublic(true);
        setMediaItems([]);
        setShowForm(false);
    }

    function startEdit(post: GalleryPost) {
        setEditId(post.id);
        setClassId(post.classId || "");
        setTitle(post.title || "");
        setCaption(post.caption || "");
        setIsPublic(post.isPublic);
        try { setMediaItems(JSON.parse(post.mediaJSON)); } catch { setMediaItems([]); }
        setShowForm(true);
    }

    async function handleUpload(files: FileList | null) {
        if (!files || files.length === 0) return;
        setUploading(true);
        const newItems: MediaItem[] = [];
        for (const file of Array.from(files)) {
            const fd = new FormData();
            fd.append("file", file);
            fd.append("folder", "gallery");
            try {
                const res = await fetch("/api/upload", { method: "POST", body: fd });
                const data = await res.json();
                if (data.url) {
                    const type = file.type.startsWith("video/") ? "video" : "image";
                    newItems.push({ url: data.url, type });
                }
            } catch (e) {
                console.error("Upload failed:", e);
            }
        }
        setMediaItems(prev => [...prev, ...newItems]);
        setUploading(false);
    }

    function removeMedia(idx: number) {
        setMediaItems(prev => prev.filter((_, i) => i !== idx));
    }

    function handleSubmit() {
        if (mediaItems.length === 0) { alert("사진 또는 영상을 최소 1개 업로드해주세요."); return; }
        const payload = {
            classId: classId || null,
            title: title || null,
            caption: caption || null,
            mediaJSON: JSON.stringify(mediaItems),
            isPublic,
        };
        startTransition(async () => {
            if (editId) {
                await updateGalleryPost(editId, payload);
            } else {
                await createGalleryPost(payload);
            }
            resetForm();
        });
    }

    function handleDelete(id: string) {
        if (!confirm("이 게시물을 삭제하시겠습니까?")) return;
        startTransition(async () => {
            await deleteGalleryPost(id);
        });
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">사진/영상 갤러리</h1>
                    <p className="text-sm text-gray-500 mt-1">수업 사진과 영상을 업로드하고 학부모에게 공유하세요</p>
                </div>
                <button
                    onClick={() => { resetForm(); setShowForm(true); }}
                    className="flex items-center gap-2 bg-brand-orange-500 text-white px-4 py-2.5 rounded-xl font-bold hover:bg-orange-600 transition"
                >
                    <Plus size={18} /> 새 게시물
                </button>
            </div>

            {/* Form Modal */}
            {showForm && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => resetForm()}>
                    <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                            <h2 className="text-lg font-bold">{editId ? "게시물 수정" : "새 게시물"}</h2>
                            <button onClick={resetForm} className="p-1 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">반 (선택)</label>
                                <select value={classId} onChange={e => setClassId(e.target.value)}
                                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm">
                                    <option value="">전체 (반 미지정)</option>
                                    {classes.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}{c.program ? ` (${c.program.name})` : ""}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">제목 (선택)</label>
                                <input value={title} onChange={e => setTitle(e.target.value)}
                                    placeholder="예: 3월 둘째주 수업 사진"
                                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">설명</label>
                                <textarea value={caption} onChange={e => setCaption(e.target.value)}
                                    rows={3} placeholder="사진/영상에 대한 설명을 입력하세요"
                                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">사진/영상 업로드</label>
                                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:bg-gray-50 transition">
                                    <Upload className="text-gray-400 mb-2" size={24} />
                                    <span className="text-sm text-gray-500">{uploading ? "업로드 중..." : "클릭하여 파일 선택"}</span>
                                    <span className="text-xs text-gray-400 mt-1">이미지, 영상 모두 가능 (여러 파일 선택 가능)</span>
                                    <input type="file" className="hidden" multiple accept="image/*,video/*"
                                        onChange={e => handleUpload(e.target.files)} disabled={uploading} />
                                </label>
                                {mediaItems.length > 0 && (
                                    <div className="grid grid-cols-4 gap-2 mt-3">
                                        {mediaItems.map((m, i) => (
                                            <div key={i} className="relative group aspect-square rounded-lg overflow-hidden bg-gray-100">
                                                {m.type === "image" ? (
                                                    <img src={m.url} alt="" className="w-full h-full object-cover" />
                                                ) : (
                                                    <video src={m.url} className="w-full h-full object-cover" />
                                                )}
                                                <button onClick={() => removeMedia(i)}
                                                    className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition">
                                                    <X size={12} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                <input type="checkbox" id="isPublic" checked={isPublic} onChange={e => setIsPublic(e.target.checked)}
                                    className="rounded" />
                                <label htmlFor="isPublic" className="text-sm text-gray-700">홈페이지 갤러리에 공개</label>
                            </div>
                        </div>
                        <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
                            <button onClick={resetForm} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl transition">취소</button>
                            <button onClick={handleSubmit} disabled={isPending || uploading}
                                className="px-6 py-2 bg-brand-orange-500 text-white font-bold rounded-xl hover:bg-orange-600 transition disabled:opacity-50">
                                {isPending ? "저장 중..." : editId ? "수정" : "등록"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Gallery Grid */}
            {posts.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-gray-400">
                    <ImageIcon className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p className="font-medium">아직 갤러리 게시물이 없습니다</p>
                    <p className="text-sm mt-1">&quot;새 게시물&quot; 버튼으로 수업 사진을 업로드하세요</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {posts.map(post => {
                        let media: MediaItem[] = [];
                        try { media = JSON.parse(post.mediaJSON); } catch {}
                        const firstImage = media.find(m => m.type === "image");
                        return (
                            <div key={post.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition">
                                {/* Thumbnail */}
                                <div className="aspect-video bg-gray-100 relative">
                                    {firstImage ? (
                                        <img src={firstImage.url} alt={post.title || ""} className="w-full h-full object-cover" />
                                    ) : media[0]?.type === "video" ? (
                                        <video src={media[0].url} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="flex items-center justify-center h-full text-gray-300">
                                            <ImageIcon size={48} />
                                        </div>
                                    )}
                                    <div className="absolute top-2 right-2 flex gap-1">
                                        {post.isPublic ? (
                                            <span className="bg-green-500 text-white text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                                                <Eye size={10} /> 공개
                                            </span>
                                        ) : (
                                            <span className="bg-gray-500 text-white text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                                                <EyeOff size={10} /> 비공개
                                            </span>
                                        )}
                                        {media.length > 1 && (
                                            <span className="bg-black/60 text-white text-xs px-2 py-0.5 rounded-full">
                                                +{media.length - 1}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                {/* Info */}
                                <div className="p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <h3 className="font-bold text-gray-900 text-sm truncate">{post.title || "제목 없음"}</h3>
                                        <span className="text-xs text-gray-400 flex-shrink-0 ml-2">
                                            {new Date(post.createdAt).toLocaleDateString("ko-KR")}
                                        </span>
                                    </div>
                                    {post.className && (
                                        <span className="inline-block bg-blue-50 text-blue-600 text-xs px-2 py-0.5 rounded-full mb-2">{post.className}</span>
                                    )}
                                    {post.caption && (
                                        <p className="text-xs text-gray-500 line-clamp-2">{post.caption}</p>
                                    )}
                                    <div className="flex gap-2 mt-3 pt-3 border-t border-gray-50">
                                        <button onClick={() => startEdit(post)}
                                            className="flex items-center gap-1 text-xs text-gray-500 hover:text-brand-orange-500 transition">
                                            <Edit2 size={14} /> 수정
                                        </button>
                                        <button onClick={() => handleDelete(post.id)}
                                            className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-500 transition">
                                            <Trash2 size={14} /> 삭제
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
