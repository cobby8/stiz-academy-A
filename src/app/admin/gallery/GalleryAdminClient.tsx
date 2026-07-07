"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  Ban,
  CheckCircle2,
  Edit2,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Send,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { createGalleryPost, deleteGalleryPost, syncInstagramGalleryPosts, updateGalleryPost } from "@/app/actions/admin";
import { publishSocialPostDraft, rejectSocialPostDraft, saveSocialPostDraft } from "@/app/actions/social-posts";
import InstagramFeedPreview from "@/components/instagram/InstagramFeedPreview";
import type { SocialPostDraft } from "@/lib/socialDrafts";

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
type InstagramStatus = {
  profileUrl: string;
  businessAccountId: string;
  autoPublishEnabled: boolean;
  hasAccessToken: boolean;
  hasBusinessAccountId: boolean;
};

function normalizeInstagramProfileUrl(url: string) {
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("@")) return `https://www.instagram.com/${trimmed.slice(1)}`;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function parseMedia(mediaJSON: string): MediaItem[] {
  try {
    const parsed = JSON.parse(mediaJSON);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function GalleryAdminClient({
  posts,
  classes,
  instagramStatus,
  socialDrafts = [],
}: {
  posts: GalleryPost[];
  classes: ClassInfo[];
  instagramStatus?: InstagramStatus;
  socialDrafts?: SocialPostDraft[];
}) {
  const [isPending, startTransition] = useTransition();
  const [drafts, setDrafts] = useState(socialDrafts);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [classId, setClassId] = useState("");
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [syncResult, setSyncResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [draftMessage, setDraftMessage] = useState<string | null>(null);

  const instagramReady = Boolean(instagramStatus?.hasAccessToken && instagramStatus.hasBusinessAccountId);
  const instagramProfileUrl = normalizeInstagramProfileUrl(instagramStatus?.profileUrl || "");

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
    setMediaItems(parseMedia(post.mediaJSON));
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
          newItems.push({ url: data.url, type: "image" });
        }
      } catch (error) {
        console.error("Upload failed:", error);
      }
    }

    setMediaItems((prev) => [...prev, ...newItems]);
    setUploading(false);
  }

  function removeMedia(index: number) {
    setMediaItems((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
  }

  function handleSubmit() {
    if (mediaItems.length === 0) {
      alert("사진을 최소 1장 업로드해주세요.");
      return;
    }

    const payload = {
      classId: classId || null,
      title: title || null,
      caption: caption || null,
      mediaJSON: JSON.stringify(mediaItems),
      isPublic,
    };

    startTransition(async () => {
      if (editId) await updateGalleryPost(editId, payload);
      else await createGalleryPost(payload);
      resetForm();
    });
  }

  function handleDelete(id: string) {
    if (!confirm("이 갤러리 게시물을 삭제할까요?")) return;
    startTransition(async () => {
      await deleteGalleryPost(id);
    });
  }

  function handleInstagramSync() {
    setSyncResult(null);
    startTransition(async () => {
      try {
        const result = await syncInstagramGalleryPosts();
        setSyncResult({ ok: result.ok, message: result.message });
      } catch (error) {
        console.error("Instagram sync failed:", error);
        setSyncResult({ ok: false, message: "인스타그램 가져오기 중 오류가 발생했습니다." });
      }
    });
  }

  function patchDraft(id: string, patch: Partial<SocialPostDraft>) {
    setDrafts((prev) => prev.map((draft) => (draft.id === id ? { ...draft, ...patch } : draft)));
  }

  function handleDraftSave(draft: SocialPostDraft) {
    setDraftMessage(null);
    startTransition(async () => {
      try {
        const result = await saveSocialPostDraft(draft.id, {
          title: draft.title,
          caption: draft.caption,
          hashtags: draft.hashtags,
          lessonType: draft.lessonType,
          memo: draft.memo,
          isPublic: draft.isPublic,
        });
        patchDraft(draft.id, result.draft);
        setDraftMessage("초안 수정 내용을 저장했습니다.");
      } catch (error) {
        setDraftMessage(error instanceof Error ? error.message : "초안 저장에 실패했습니다.");
      }
    });
  }

  function handleDraftPublish(draft: SocialPostDraft) {
    if (!confirm("이 초안을 홈페이지 갤러리와 인스타그램에 게시할까요?")) return;
    setDraftMessage(null);
    startTransition(async () => {
      try {
        const result = await publishSocialPostDraft(draft.id);
        if (result.ok) {
          setDrafts((prev) => prev.filter((item) => item.id !== draft.id));
          setDraftMessage("홈페이지 갤러리와 인스타그램 게시가 완료되었습니다.");
        } else {
          patchDraft(draft.id, result.draft);
          setDraftMessage(result.error || "홈페이지 갤러리는 저장됐지만 인스타그램 게시에 실패했습니다.");
        }
      } catch (error) {
        setDraftMessage(error instanceof Error ? error.message : "게시 중 오류가 발생했습니다.");
      }
    });
  }

  function handleDraftReject(draft: SocialPostDraft) {
    if (!confirm("이 초안을 반려할까요?")) return;
    setDraftMessage(null);
    startTransition(async () => {
      try {
        await rejectSocialPostDraft(draft.id);
        setDrafts((prev) => prev.filter((item) => item.id !== draft.id));
        setDraftMessage("초안을 반려했습니다.");
      } catch (error) {
        setDraftMessage(error instanceof Error ? error.message : "반려 처리에 실패했습니다.");
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">사진/영상 갤러리</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            홈페이지 갤러리와 인스타그램 게시 흐름을 관리합니다.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/staff/quick-post"
            className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-bold text-gray-700 transition hover:border-brand-orange-500 hover:text-brand-orange-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
          >
            <Upload size={18} />
            선생님 업로드
          </Link>
          <button
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
            className="flex items-center gap-2 rounded-lg bg-brand-orange-500 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-orange-600 dark:bg-brand-neon-lime dark:text-brand-navy-900"
          >
            <Plus size={18} /> 새 게시물
          </button>
        </div>
      </div>

      {instagramStatus && (
        <section className="rounded-lg border border-gray-100 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-bold text-gray-900 dark:text-white">Instagram 연동</h2>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                    instagramReady ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"
                  }`}
                >
                  {instagramReady ? "준비 완료" : "설정 필요"}
                </span>
                {instagramStatus.autoPublishEnabled && (
                  <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700">
                    자동 업로드 ON
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                기존 인스타 게시물을 홈페이지 갤러리로 가져오고, 승인된 초안을 인스타그램에 게시합니다.
              </p>
              {syncResult && (
                <p className={`mt-1 text-xs font-medium ${syncResult.ok ? "text-green-600" : "text-red-600"}`}>
                  {syncResult.message}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              {instagramProfileUrl && (
                <a
                  href={instagramProfileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold text-gray-600 transition hover:border-brand-orange-500 hover:text-brand-orange-500 dark:border-gray-700 dark:text-gray-300"
                >
                  프로필 열기
                </a>
              )}
              <button
                onClick={handleInstagramSync}
                disabled={!instagramReady || isPending}
                className="flex items-center gap-2 rounded-lg bg-gray-900 px-3 py-2 text-xs font-bold text-white transition hover:bg-gray-700 disabled:opacity-40"
              >
                {isPending ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                인스타 가져오기
              </button>
            </div>
          </div>
        </section>
      )}

      <section className="rounded-lg border border-gray-100 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-black text-gray-900 dark:text-white">선생님 업로드 대기</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              문구를 직접 수정한 뒤 게시하면 홈페이지 갤러리와 인스타그램에 함께 반영됩니다.
            </p>
          </div>
          <span className="w-fit rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-600">
            {drafts.length}개 대기
          </span>
        </div>

        {draftMessage && (
          <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-bold text-gray-700">
            {draftMessage}
          </div>
        )}

        {drafts.length === 0 ? (
          <div className="mt-4 rounded-lg border border-dashed border-gray-300 p-8 text-center text-sm text-gray-400">
            승인 대기 중인 초안이 없습니다.
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            {drafts.map((draft) => {
              const media = parseMedia(draft.mediaJSON).filter((item) => item.type === "image");
              return (
                <div key={draft.id} className="grid gap-4 rounded-lg border border-gray-200 p-3 md:grid-cols-[minmax(220px,320px)_1fr]">
                  <InstagramFeedPreview
                    mediaItems={media}
                    caption={draft.caption || ""}
                    hashtags={draft.hashtags || ""}
                    editable
                    compact
                    onCaptionChange={(value) => patchDraft(draft.id, { caption: value })}
                    onHashtagsChange={(value) => patchDraft(draft.id, { hashtags: value })}
                  />
                  <div className="flex min-w-0 flex-col justify-between gap-3">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-orange-50 px-2 py-0.5 text-xs font-bold text-orange-700">
                          {draft.lessonType || "수업"}
                        </span>
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-bold text-gray-600">
                          {draft.authorName || "선생님"}
                        </span>
                        {draft.status === "FAILED" && (
                          <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-bold text-red-700">
                            재시도 필요
                          </span>
                        )}
                      </div>
                      <input
                        value={draft.title || ""}
                        onChange={(event) => patchDraft(draft.id, { title: event.target.value })}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-bold outline-none focus:border-brand-orange-500"
                        placeholder="게시물 제목"
                      />
                      {draft.memo && <p className="text-xs leading-5 text-gray-500">메모: {draft.memo}</p>}
                      {draft.instagramPublishError && (
                        <p className="rounded-lg bg-red-50 p-2 text-xs font-medium leading-5 text-red-700">
                          {draft.instagramPublishError}
                        </p>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => handleDraftSave(draft)}
                        disabled={isPending}
                        className="flex min-h-10 items-center justify-center gap-1 rounded-lg border border-gray-200 px-2 text-xs font-black text-gray-700 disabled:opacity-50"
                      >
                        <Save size={15} />
                        저장
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDraftPublish(draft)}
                        disabled={isPending}
                        className="flex min-h-10 items-center justify-center gap-1 rounded-lg bg-brand-orange-500 px-2 text-xs font-black text-white disabled:opacity-50"
                      >
                        <Send size={15} />
                        게시
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDraftReject(draft)}
                        disabled={isPending}
                        className="flex min-h-10 items-center justify-center gap-1 rounded-lg bg-gray-100 px-2 text-xs font-black text-gray-600 disabled:opacity-50"
                      >
                        <Ban size={15} />
                        반려
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={resetForm}>
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white shadow-2xl dark:bg-gray-800"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-100 p-6 dark:border-gray-800">
              <h2 className="text-lg font-bold">{editId ? "게시물 수정" : "새 게시물"}</h2>
              <button onClick={resetForm} className="rounded-lg p-1 hover:bg-gray-100 dark:hover:bg-gray-700">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4 p-6">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">반 선택</label>
                <select
                  value={classId}
                  onChange={(event) => setClassId(event.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm dark:border-gray-700"
                >
                  <option value="">전체 공개</option>
                  {classes.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                      {item.program ? ` (${item.program.name})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">제목</label>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="예: 3월 토요일 수업 스케치"
                  className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm dark:border-gray-700"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">설명</label>
                <textarea
                  value={caption}
                  onChange={(event) => setCaption(event.target.value)}
                  rows={3}
                  placeholder="게시물 설명을 입력하세요."
                  className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm dark:border-gray-700"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">사진 업로드</label>
                <label className="flex h-32 w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 transition hover:bg-gray-50 dark:bg-gray-900">
                  <Upload className="mb-2 text-gray-400" size={24} />
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {uploading ? "업로드 중..." : "클릭해서 사진 선택"}
                  </span>
                  <span className="mt-1 text-xs text-gray-400">여러 장 선택 가능</span>
                  <input
                    type="file"
                    className="hidden"
                    multiple
                    accept="image/*"
                    onChange={(event) => handleUpload(event.target.files)}
                    disabled={uploading}
                  />
                </label>
                {mediaItems.length > 0 && (
                  <div className="mt-3 grid grid-cols-4 gap-2">
                    {mediaItems.map((item, index) => (
                      <div key={`${item.url}-${index}`} className="group relative aspect-square overflow-hidden rounded-lg bg-gray-100">
                        <img src={item.url} alt="" className="h-full w-full object-cover" />
                        <button
                          onClick={() => removeMedia(index)}
                          className="absolute right-1 top-1 rounded-full bg-red-500 p-1 text-white opacity-0 transition group-hover:opacity-100"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={isPublic}
                  onChange={(event) => setIsPublic(event.target.checked)}
                  className="rounded"
                />
                <span className="text-sm text-gray-700 dark:text-gray-200">홈페이지 갤러리에 공개</span>
              </label>
            </div>
            <div className="flex justify-end gap-3 border-t border-gray-100 p-6 dark:border-gray-800">
              <button
                onClick={resetForm}
                className="rounded-lg px-4 py-2 text-sm text-gray-600 transition hover:bg-gray-100 dark:text-gray-300"
              >
                취소
              </button>
              <button
                onClick={handleSubmit}
                disabled={isPending || uploading}
                className="rounded-lg bg-brand-orange-500 px-6 py-2 text-sm font-bold text-white transition hover:bg-orange-600 disabled:opacity-50 dark:bg-brand-neon-lime dark:text-brand-navy-900"
              >
                {isPending ? "저장 중..." : editId ? "수정" : "등록"}
              </button>
            </div>
          </div>
        </div>
      )}

      {posts.length === 0 ? (
        <div className="rounded-lg border border-gray-100 bg-white p-12 text-center text-gray-400 dark:border-gray-700 dark:bg-gray-800">
          <ImageIcon className="mx-auto mb-3 h-12 w-12 text-gray-300" />
          <p className="font-medium">아직 갤러리 게시물이 없습니다.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => {
            const media = parseMedia(post.mediaJSON);
            const firstImage = media.find((item) => item.type === "image");
            return (
              <div
                key={post.id}
                className="overflow-hidden rounded-lg border border-gray-100 bg-white shadow-sm transition hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
              >
                <div className="relative aspect-video bg-gray-100 dark:bg-gray-900">
                  {firstImage ? (
                    <img src={firstImage.url} alt={post.title || ""} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-gray-300">
                      <ImageIcon size={48} />
                    </div>
                  )}
                  <div className="absolute right-2 top-2 flex gap-1">
                    {post.isPublic ? (
                      <span className="flex items-center gap-1 rounded-full bg-green-500 px-2 py-0.5 text-xs text-white">
                        <Eye size={10} /> 공개
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 rounded-full bg-gray-500 px-2 py-0.5 text-xs text-white">
                        <EyeOff size={10} /> 비공개
                      </span>
                    )}
                    {media.length > 1 && (
                      <span className="rounded-full bg-black/60 px-2 py-0.5 text-xs text-white">+{media.length - 1}</span>
                    )}
                  </div>
                </div>
                <div className="p-4">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <h3 className="truncate text-sm font-bold text-gray-900 dark:text-white">
                      {post.title || "제목 없음"}
                    </h3>
                    <span className="shrink-0 text-xs text-gray-400">
                      {new Date(post.createdAt).toLocaleDateString("ko-KR")}
                    </span>
                  </div>
                  {post.className && (
                    <span className="mb-2 inline-block rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-600">
                      {post.className}
                    </span>
                  )}
                  {post.caption && <p className="line-clamp-2 text-xs text-gray-500 dark:text-gray-400">{post.caption}</p>}
                  <div className="mt-3 flex gap-2 border-t border-gray-50 pt-3">
                    <button
                      onClick={() => startEdit(post)}
                      className="flex items-center gap-1 text-xs text-gray-500 transition hover:text-brand-orange-500"
                    >
                      <Edit2 size={14} /> 수정
                    </button>
                    <button
                      onClick={() => handleDelete(post.id)}
                      className="flex items-center gap-1 text-xs text-gray-500 transition hover:text-red-500"
                    >
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
