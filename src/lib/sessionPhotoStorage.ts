import { createAdminClient } from "@/lib/supabase/admin";

export const PRIVATE_SESSION_PHOTO_BUCKET = "staff-session-private";
export const PUBLIC_GALLERY_BUCKET = "uploads";

export type StoredSessionPhoto = {
  id: string;
  type: "image";
  url: string;
  storageBucket: string;
  storagePath: string;
  visibility: "PRIVATE" | "PUBLIC";
};

export type SessionPhotoEntry = string | StoredSessionPhoto;

export function parseSessionPhotoEntries(value: unknown): SessionPhotoEntry[] {
  const parsed = typeof value === "string" ? (() => {
    try { return JSON.parse(value); } catch { return []; }
  })() : value;
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((item): item is SessionPhotoEntry =>
    (typeof item === "string" && item.length <= 2048) ||
    (typeof item?.id === "string" && item.type === "image" && typeof item.url === "string" && typeof item.storageBucket === "string" && typeof item.storagePath === "string"),
  );
}

export function parseStoredSessionPhotos(value: unknown): StoredSessionPhoto[] {
  return parseSessionPhotoEntries(value).filter((item): item is StoredSessionPhoto => typeof item !== "string");
}

export async function ensurePrivateSessionPhotoBucket() {
  const supabase = createAdminClient();
  const { error } = await supabase.storage.createBucket(PRIVATE_SESSION_PHOTO_BUCKET, {
    public: false,
    fileSizeLimit: 1024 * 1024,
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
  });
  if (error && !/already exists|duplicate/i.test(error.message)) throw error;
  const { error: updateError } = await supabase.storage.updateBucket(PRIVATE_SESSION_PHOTO_BUCKET, {
    public: false,
    fileSizeLimit: 1024 * 1024,
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
  });
  if (updateError) throw updateError;
}

export function isValidPrivateSessionPhotoRef(
  media: Record<string, unknown>,
  input: { classId: string; sessionId: string },
) {
  if (media.storageBucket !== PRIVATE_SESSION_PHOTO_BUCKET || typeof media.storagePath !== "string" || typeof media.id !== "string") return false;
  const escapedClass = input.classId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const escapedSession = input.sessionId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const escapedPhoto = media.id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^staff-sessions/${escapedClass}/${escapedSession}/${escapedPhoto}\\.(jpg|png|webp)$`).test(media.storagePath);
}

export async function materializePrivateMediaJSON(
  draftId: string,
  mediaJSON: string,
  input: { classId: string | null; sessionId: string | null },
) {
  const raw: unknown = JSON.parse(mediaJSON);
  if (!Array.isArray(raw)) return mediaJSON;
  const supabase = createAdminClient();
  const converted = await Promise.all(raw.map(async (item, index) => {
    if (!item || typeof item !== "object") return item;
    const media = item as Record<string, unknown>;
    if (media.visibility !== "PRIVATE" || typeof media.storagePath !== "string") return item;
    if (!input.classId || !input.sessionId || !isValidPrivateSessionPhotoRef(media, { classId: input.classId, sessionId: input.sessionId })) {
      throw new Error("검증되지 않은 비공개 사진 경로입니다.");
    }
    const sourceBucket = PRIVATE_SESSION_PHOTO_BUCKET;
    const extension = media.storagePath.split(".").pop()?.toLowerCase() || "jpg";
    const publicPath = `published/social-drafts/${draftId}/${index}.${extension}`;
    const { data, error: downloadError } = await supabase.storage.from(sourceBucket).download(media.storagePath);
    if (downloadError || !data) throw new Error("비공개 수업 사진을 불러오지 못했습니다.");
    const { error: uploadError } = await supabase.storage.from(PUBLIC_GALLERY_BUCKET).upload(
      publicPath,
      Buffer.from(await data.arrayBuffer()),
      { contentType: data.type || `image/${extension === "jpg" ? "jpeg" : extension}`, cacheControl: "31536000", upsert: true },
    );
    if (uploadError) throw new Error("게시용 사진 사본을 만들지 못했습니다.");
    const publicUrl = supabase.storage.from(PUBLIC_GALLERY_BUCKET).getPublicUrl(publicPath).data.publicUrl;
    return { ...media, url: publicUrl, visibility: "PUBLIC", publishedStorageBucket: PUBLIC_GALLERY_BUCKET, publishedStoragePath: publicPath };
  }));
  return JSON.stringify(converted);
}

export async function removePublishedMediaCopies(draftId: string, mediaJSON: string) {
  const raw: unknown = JSON.parse(mediaJSON);
  if (!Array.isArray(raw)) return;
  const paths = raw.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const media = item as Record<string, unknown>;
    if (media.publishedStorageBucket !== PUBLIC_GALLERY_BUCKET || typeof media.publishedStoragePath !== "string") return [];
    const prefix = `published/social-drafts/${draftId}/`;
    return media.publishedStoragePath.startsWith(prefix) && !media.publishedStoragePath.includes("..")
      ? [media.publishedStoragePath]
      : [];
  });
  if (paths.length === 0) return;
  const { error } = await createAdminClient().storage.from(PUBLIC_GALLERY_BUCKET).remove(paths);
  if (error) throw new Error("반려된 게시용 사진 사본을 삭제하지 못했습니다.");
}
