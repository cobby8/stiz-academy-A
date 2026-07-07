"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Camera, CheckCircle2, Loader2, RefreshCcw, Save, Sparkles, UploadCloud } from "lucide-react";
import { createSocialPostDraft, saveSocialPostDraft } from "@/app/actions/social-posts";
import InstagramFeedPreview, {
  type InstagramPreviewMediaItem,
} from "@/components/instagram/InstagramFeedPreview";
import type { SocialPostDraft } from "@/lib/socialDrafts";

const LESSON_TYPES = ["정규 수업", "기초반", "심화반", "게임 수업", "특강", "대회 준비"];
const MAX_UPLOAD_COUNT = 10;
const MAX_IMAGE_EDGE = 1600;

async function loadImage(file: File) {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function canvasToBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("이미지 압축에 실패했습니다."));
      },
      "image/jpeg",
      quality,
    );
  });
}

async function compressImage(file: File) {
  if (!file.type.startsWith("image/")) {
    throw new Error("사진 파일만 업로드할 수 있습니다.");
  }

  if (file.type === "image/gif" && file.size <= 5 * 1024 * 1024) {
    return file;
  }

  try {
    const image = await loadImage(file);
    const ratio = Math.min(1, MAX_IMAGE_EDGE / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * ratio));
    const height = Math.max(1, Math.round(image.height * ratio));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) throw new Error("이미지 변환을 준비하지 못했습니다.");
    context.drawImage(image, 0, 0, width, height);

    let blob = await canvasToBlob(canvas, 0.82);
    if (blob.size > 4.6 * 1024 * 1024) {
      blob = await canvasToBlob(canvas, 0.68);
    }

    const filename = file.name.replace(/\.[^.]+$/, "") || "stiz-photo";
    return new File([blob], `${filename}.jpg`, { type: "image/jpeg" });
  } catch (error) {
    if (file.size <= 5 * 1024 * 1024 && ["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      return file;
    }
    throw error;
  }
}

async function uploadImage(file: File): Promise<InstagramPreviewMediaItem> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("folder", "quick-post");

  const res = await fetch("/api/upload", { method: "POST", body: fd });
  const data = await res.json();
  if (!res.ok || !data.url) {
    throw new Error(data.error || "사진 업로드에 실패했습니다.");
  }

  return { url: data.url, type: "image" };
}

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
  const [isPending, startTransition] = useTransition();
  const busy = isPending;

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;

    setError(null);
    setMessage("사진을 올리고 AI 초안을 만드는 중입니다.");
    setDraft(null);
    setCaption("");
    setHashtags("");

    startTransition(async () => {
      try {
        const selected = Array.from(files).slice(0, MAX_UPLOAD_COUNT);
        const uploaded: InstagramPreviewMediaItem[] = [];

        for (const file of selected) {
          const compressed = await compressImage(file);
          uploaded.push(await uploadImage(compressed));
        }

        const result = await createSocialPostDraft({
          mediaJSON: JSON.stringify(uploaded),
          lessonType,
          memo,
          isPublic: true,
        });

        setMediaItems(uploaded);
        setDraft(result.draft);
        setCaption(result.draft.caption || "");
        setHashtags(result.draft.hashtags || "");
        setMessage("관리자 검토 대기 초안이 만들어졌습니다.");
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "초안을 만들지 못했습니다.");
        setMessage(null);
      } finally {
        if (inputRef.current) inputRef.current.value = "";
      }
    });
  }

  function handleSave() {
    if (!draft) return;

    setError(null);
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
        setMessage("수정 내용이 저장되었습니다.");
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "저장하지 못했습니다.");
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
            <InstagramFeedPreview
              mediaItems={mediaItems}
              caption={caption}
              hashtags={hashtags}
              editable
              onCaptionChange={setCaption}
              onHashtagsChange={setHashtags}
            />

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={busy}
                className="flex min-h-12 items-center justify-center gap-2 rounded-lg bg-brand-navy-900 px-3 text-sm font-black text-white disabled:opacity-60"
              >
                <Save size={18} />
                수정 저장
              </button>
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
            <p className="mt-1 text-xs">최종 게시는 관리자 승인 후 진행됩니다.</p>
          </div>
        )}

        {busy && (
          <div className="flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white p-4 text-sm font-bold text-gray-600">
            <Sparkles size={18} className="text-brand-orange-500" />
            처리 중입니다.
          </div>
        )}
      </div>
    </main>
  );
}
