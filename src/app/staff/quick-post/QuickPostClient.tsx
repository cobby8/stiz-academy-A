"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowRight, Camera, CheckCircle2, Loader2, RefreshCcw, Save, Send, Sparkles, UploadCloud } from "lucide-react";
import {
  createSocialPostDraft,
  publishSocialPostDraftToGallery,
  publishSocialPostDraftToInstagram,
  saveSocialPostDraft,
} from "@/app/actions/social-posts";
import InstagramFeedPreview, {
  type InstagramPreviewMediaItem,
} from "@/components/instagram/InstagramFeedPreview";
import { uploadImagesWithProgress } from "@/lib/clientImageUpload";
import type { SocialPostDraft } from "@/lib/socialDrafts";

const LESSON_TYPES = ["정규 수업", "기초반", "심화반", "게임 수업", "특강", "대회 준비"];
const MAX_UPLOAD_COUNT = 10;
type UploadProgress = { done: number; total: number };

export default function QuickPostClient({
  currentUser,
}: {
  currentUser: { name: string; role: string };
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [lessonType, setLessonType] = useState(LESSON_TYPES[0]);
  const [memo, setMemo] = useState("");
  const [mediaItems, setMediaItems] = useState<InstagramPreviewMediaItem[]>([]);
  const [draft, setDraft] = useState<SocialPostDraft | null>(null);
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progressText, setProgressText] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [instagramPosting, setInstagramPosting] = useState(false);
  const [isPending, startTransition] = useTransition();
  const busy = isPending || isWorking;
  const canApprove = currentUser.role === "ADMIN" || currentUser.role === "VICE_ADMIN";
  const isPublished = draft?.status === "PUBLISHED";
  const hasInstagramIssue = draft?.status === "FAILED";
  const hasPublishingStatus = draft?.status === "PUBLISHING";
  const isPublishingInstagram = instagramPosting;
  const needsInstagramRetry = hasInstagramIssue || hasPublishingStatus;

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;

    setError(null);
    setMessage("사진을 올리고 AI 초안을 만드는 중입니다.");
    setProgressText("사진을 압축하고 업로드하는 중입니다.");
    setDraft(null);
    setCaption("");
    setHashtags("");
    setUploadProgress({ done: 0, total: Math.min(files.length, MAX_UPLOAD_COUNT) });
    setIsWorking(true);

    startTransition(async () => {
      try {
        const { items: uploaded, failedNames, skippedCount } = await uploadImagesWithProgress(files, {
          folder: "quick-post",
          limit: MAX_UPLOAD_COUNT,
          onProgress: (done, total) => setUploadProgress({ done, total }),
        });

        if (uploaded.length === 0) {
          throw new Error("업로드된 사진이 없습니다. 사진을 다시 선택해주세요.");
        }

        setMediaItems(uploaded as InstagramPreviewMediaItem[]);
        setProgressText("AI 문구를 만드는 중입니다.");

        const result = await createSocialPostDraft({
          mediaJSON: JSON.stringify(uploaded),
          lessonType,
          memo,
          isPublic: true,
        });

        setDraft(result.draft);
        setCaption(result.draft.caption || "");
        setHashtags(result.draft.hashtags || "");

        const notes = [
          skippedCount > 0 ? `최대 ${MAX_UPLOAD_COUNT}장만 처리했습니다.` : null,
          failedNames.length > 0 ? `${failedNames.length}장은 업로드하지 못했습니다.` : null,
        ].filter(Boolean);
        setMessage(
          `${uploaded.length}장 업로드 완료. AI 초안이 만들어졌습니다. 문구를 확인한 뒤 바로 게시할 수 있습니다.${
            notes.length > 0 ? ` ${notes.join(" ")}` : ""
          }`,
        );
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "초안을 만들지 못했습니다.");
        setMessage(null);
      } finally {
        setIsWorking(false);
        setProgressText(null);
        setUploadProgress(null);
        if (inputRef.current) inputRef.current.value = "";
      }
    });
  }

  function handleSave() {
    if (!draft) return;

    setError(null);
    setProgressText("수정 내용을 저장하는 중입니다.");
    setIsWorking(true);
    startTransition(async () => {
      try {
        const result = await saveSocialPostDraft(draft.id, {
          title: draft.title,
          caption,
          hashtags,
          lessonType,
          memo,
          isPublic: draft.isPublic,
        });
        setDraft(result.draft);
        setMessage("수정 내용이 저장됐습니다.");
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "저장하지 못했습니다.");
      } finally {
        setIsWorking(false);
        setProgressText(null);
      }
    });
  }

  async function publishInstagramInBackground(draftId: string) {
    setInstagramPosting(true);
    try {
      const result = await publishSocialPostDraftToInstagram(draftId);
      setDraft(result.draft);

      if (result.ok) {
        setMessage("인스타그램 게시까지 완료됐습니다.");
        setError(null);
        return;
      }

      setMessage("홈페이지 갤러리에는 게시됐습니다. 인스타그램 게시만 확인이 필요합니다.");
      setError(result.error || "인스타그램 게시 설정을 확인해주세요.");
    } catch (caught) {
      setMessage("홈페이지 갤러리에는 게시됐습니다. 인스타그램 게시만 다시 시도해주세요.");
      setError(caught instanceof Error ? caught.message : "인스타그램 게시 중 오류가 발생했습니다.");
    } finally {
      setInstagramPosting(false);
    }
  }

  function handlePublish() {
    if (!draft) return;

    setError(null);
    setMessage("홈페이지 갤러리에 먼저 게시하는 중입니다.");
    setProgressText("수정 내용을 저장하는 중입니다.");
    setIsWorking(true);
    startTransition(async () => {
      try {
        const saved = await saveSocialPostDraft(draft.id, {
          title: draft.title,
          caption,
          hashtags,
          lessonType,
          memo,
          isPublic: draft.isPublic,
        });
        setProgressText("홈페이지 갤러리에 게시하는 중입니다.");
        const result = await publishSocialPostDraftToGallery(saved.draft.id);
        setDraft(result.draft);
        setMessage("홈페이지 갤러리에 게시됐습니다. 인스타그램은 이어서 게시 중입니다.");
        setProgressText(null);
        setIsWorking(false);
        void publishInstagramInBackground(result.draft.id);
      } catch (caught) {
        setMessage(null);
        setError(caught instanceof Error ? caught.message : "게시하지 못했습니다.");
        setIsWorking(false);
        setProgressText(null);
      }
    });
  }

  function resetFlow() {
    setDraft(null);
    setMediaItems([]);
    setCaption("");
    setHashtags("");
    setMessage(null);
    setError(null);
    setProgressText(null);
    setUploadProgress(null);
    setInstagramPosting(false);
  }

  return (
    <main className="min-h-screen bg-surface-warm px-4 py-5">
      <div className="mx-auto max-w-md space-y-4">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-brand-orange-600">{currentUser.role}</p>
            <h1 className="text-2xl font-black text-brand-navy-900">사진 올리기</h1>
            <p className="text-sm text-gray-600">{currentUser.name} 선생님</p>
          </div>
          <Link href="/" className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-600">
            홈
          </Link>
        </header>

        <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="grid grid-cols-2 gap-2">
            {LESSON_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setLessonType(type)}
                className={`min-h-10 rounded-lg border px-3 text-sm font-bold transition ${
                  lessonType === type
                    ? "border-brand-orange-500 bg-orange-50 text-brand-orange-700"
                    : "border-gray-200 bg-white text-gray-600"
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          <textarea
            value={memo}
            onChange={(event) => setMemo(event.target.value)}
            rows={3}
            className="mt-3 w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm leading-6 outline-none focus:border-brand-orange-500"
            placeholder="오늘 수업 포인트를 짧게 적어주세요"
          />

          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            disabled={busy}
            onChange={(event) => handleFiles(event.target.files)}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="mt-3 flex min-h-14 w-full items-center justify-center gap-2 rounded-lg bg-brand-orange-500 px-4 py-3 text-sm font-black text-white transition hover:bg-brand-orange-600 disabled:opacity-60"
          >
            {busy ? <Loader2 size={20} className="animate-spin" /> : <Camera size={20} />}
            사진 선택하고 AI 초안 만들기
          </button>
        </section>

        {message && (
          <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm font-bold text-green-700">
            <CheckCircle2 size={17} />
            {message}
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700">
            {error}
          </div>
        )}

        {draft && (
          <section className="space-y-3">
            <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-green-800">
              <div className="flex items-center gap-2 text-sm font-black">
                <CheckCircle2 size={18} />
                {isPublished
                  ? "게시 완료"
                  : isPublishingInstagram
                    ? "홈페이지 게시 완료"
                  : needsInstagramRetry
                    ? "홈페이지 게시 완료"
                    : "AI 초안 준비 완료"}
              </div>
              <p className="mt-2 text-xs leading-5 text-green-700">
                {isPublished
                  ? "홈페이지 갤러리와 인스타그램 게시가 완료됐습니다."
                  : isPublishingInstagram
                    ? "홈페이지 갤러리는 완료됐고, 인스타그램 게시를 진행 중입니다."
                  : hasPublishingStatus
                    ? "홈페이지 갤러리는 완료됐습니다. 인스타그램 게시 상태가 멈춘 경우 다시 게시를 눌러 이어갈 수 있습니다."
                  : hasInstagramIssue
                    ? "사진은 홈페이지 갤러리에 올라갔고, 인스타그램 게시만 다시 시도하거나 관리자 설정을 확인하면 됩니다."
                    : "문구를 확인하고 필요한 부분을 수정한 뒤 바로 게시할 수 있습니다."}
              </p>
              {canApprove && (
                <Link
                  href="/admin/gallery"
                  className="mt-3 flex min-h-11 items-center justify-center gap-2 rounded-lg bg-green-700 px-3 text-sm font-black text-white"
                >
                  관리자 갤러리 보기
                  <ArrowRight size={17} />
                </Link>
              )}
              {isPublished && (
                <div className="mt-3 grid grid-cols-1 gap-2">
                  <Link
                    href="/gallery"
                    className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-green-200 bg-white px-3 text-sm font-black text-green-700"
                  >
                    홈페이지 갤러리 보기
                    <ArrowRight size={17} />
                  </Link>
                  {draft?.instagramPermalink && (
                    <a
                      href={draft.instagramPermalink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-green-700 px-3 text-sm font-black text-white"
                    >
                      인스타그램 게시물 보기
                      <ArrowRight size={17} />
                    </a>
                  )}
                </div>
              )}
            </div>

            <InstagramFeedPreview
              mediaItems={mediaItems}
              caption={caption}
              hashtags={hashtags}
              editable={!isPublished}
              onCaptionChange={setCaption}
              onHashtagsChange={setHashtags}
            />

            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={busy || isPublished}
                className="flex min-h-12 items-center justify-center gap-2 rounded-lg bg-brand-navy-900 px-3 text-sm font-black text-white disabled:opacity-60"
              >
                <Save size={18} />
                수정 저장
              </button>
              {!isPublished && (
                <button
                  type="button"
                  onClick={handlePublish}
                  disabled={busy || isPublishingInstagram}
                  className="flex min-h-12 items-center justify-center gap-2 rounded-lg bg-brand-orange-500 px-3 text-sm font-black text-white disabled:opacity-60"
                >
                  {isPublishingInstagram ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                  {isPublishingInstagram ? "인스타그램 게시 중" : needsInstagramRetry ? "인스타그램 다시 게시" : "바로 게시"}
                </button>
              )}
              <button
                type="button"
                onClick={resetFlow}
                disabled={busy}
                className="flex min-h-12 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-sm font-black text-gray-700 disabled:opacity-60"
              >
                <RefreshCcw size={18} />
                새로 작성
              </button>
            </div>
          </section>
        )}

        {!draft && !busy && (
          <div className="rounded-lg border border-dashed border-gray-300 bg-white/70 p-6 text-center text-gray-500">
            <UploadCloud className="mx-auto mb-2 h-9 w-9 text-gray-400" />
            <p className="text-sm font-bold">사진을 고르면 인스타 피드 형태로 미리보기가 만들어집니다.</p>
            <p className="mt-1 text-xs">문구를 확인한 뒤 승인 과정 없이 바로 게시할 수 있습니다.</p>
          </div>
        )}

        {isPublishingInstagram && !busy && (
          <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm font-bold text-blue-700">
            <Loader2 size={18} className="mt-0.5 shrink-0 animate-spin" />
            <div>
              <p>인스타그램 게시 중입니다.</p>
              <p className="mt-1 text-xs font-medium text-blue-600">
                홈페이지 갤러리는 이미 반영됐습니다. 잠시 뒤 결과가 표시됩니다.
              </p>
            </div>
          </div>
        )}

        {busy && (
          <div className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-4 text-sm font-bold text-gray-600">
            <Sparkles size={18} className="mt-0.5 shrink-0 text-brand-orange-500" />
            <div className="min-w-0 flex-1">
              <p>{progressText || "처리 중입니다."}</p>
              {uploadProgress && uploadProgress.total > 0 && (
                <div className="mt-2">
                  <div className="flex justify-between text-[11px] text-gray-400">
                    <span>사진 업로드</span>
                    <span>
                      {uploadProgress.done}/{uploadProgress.total}
                    </span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full bg-brand-orange-500 transition-all"
                      style={{ width: `${Math.round((uploadProgress.done / uploadProgress.total) * 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
