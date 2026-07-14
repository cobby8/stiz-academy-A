"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { requireAdmin, requireStaff } from "@/lib/auth-guard";
import { generateSocialCaptionDraft } from "@/lib/socialCaptionAI";
import {
  publishSocialDraftToInstagramNow,
  upsertGalleryPostFromSocialDraft,
} from "@/lib/socialPostPublishing";
import {
  createSocialPostDraftRecord,
  getSocialPostDraftById,
  markSocialPostDraftPublishing,
  parseSocialDraftMedia,
  rejectSocialPostDraftRecord,
  safeSocialDraftMediaJSON,
  updateSocialPostDraftRecord,
  type SocialPostDraft,
} from "@/lib/socialDrafts";
import { removePublishedMediaCopies } from "@/lib/sessionPhotoStorage";

type SaveDraftInput = {
  title?: string | null;
  caption?: string | null;
  hashtags?: string | null;
  lessonType?: string | null;
  memo?: string | null;
  isPublic?: boolean;
};

function revalidateSocialPostPaths() {
  revalidateTag("admin-gallery", { expire: 0 });
  revalidatePath("/staff/quick-post");
  revalidatePath("/admin/gallery");
  revalidatePath("/gallery");
  revalidatePath("/mypage");
  revalidatePath("/");
}

export async function createSocialPostDraft(data: {
  mediaJSON: string;
  lessonType?: string | null;
  memo?: string | null;
  isPublic?: boolean;
  sessionId?: string | null;
  classId?: string | null;
  source?: string | null;
}) {
  const staff = await requireStaff();
  // 일반 빠른 업로드에서는 클라이언트가 보낸 저장소 메타데이터를 신뢰하지 않습니다.
  const mediaJSON = JSON.stringify(
    parseSocialDraftMedia(safeSocialDraftMediaJSON(data.mediaJSON)).map((item) => ({
      type: item.type,
      url: item.url,
    })),
  );
  const mediaItems = parseSocialDraftMedia(mediaJSON).filter((item) => item.type === "image");

  if (mediaItems.length === 0) {
    throw new Error("사진을 최소 1장 이상 올려주세요. 현재 자동 인스타 업로드는 사진만 지원합니다.");
  }

  const aiDraft = await generateSocialCaptionDraft({
    mediaItems,
    lessonType: data.lessonType,
    memo: data.memo,
  });

  const draft = await createSocialPostDraftRecord({
    authorUserId: staff.appUserId,
    authorName: staff.appUserName,
    authorRole: staff.appUserRole,
    lessonType: data.lessonType,
    memo: data.memo,
    title: aiDraft.title,
    caption: aiDraft.caption,
    hashtags: aiDraft.hashtags,
    mediaJSON,
    isPublic: data.isPublic !== false,
    sessionId: data.sessionId,
    classId: data.classId,
    source: data.source,
  });

  revalidateSocialPostPaths();
  return { ok: true, draft };
}

export async function saveSocialPostDraft(id: string, data: SaveDraftInput) {
  const staff = await requireStaff();
  const authorUserId = staff.appUserRole === "INSTRUCTOR" ? staff.appUserId : null;

  const draft = await updateSocialPostDraftRecord(id, data, { authorUserId });
  revalidateSocialPostPaths();
  return { ok: true, draft };
}

export async function rejectSocialPostDraft(id: string) {
  await requireAdmin();
  const currentDraft = await getSocialPostDraftById(id);
  const result = await rejectSocialPostDraftRecord(id);
  if (currentDraft) await removePublishedMediaCopies(currentDraft.id, currentDraft.mediaJSON);
  revalidateSocialPostPaths();
  return { ok: true, ...result };
}

function canPublishDraftStatus(status: SocialPostDraft["status"]) {
  return status === "READY" || status === "FAILED" || status === "PUBLISHING";
}

function assertCanPublishDraft(draft: SocialPostDraft | null, staff: Awaited<ReturnType<typeof requireStaff>>) {
  if (!draft || !canPublishDraftStatus(draft.status)) {
    throw new Error("게시할 수 있는 초안을 찾지 못했습니다.");
  }

  if (staff.appUserRole === "INSTRUCTOR" && draft.authorUserId !== staff.appUserId) {
    throw new Error("본인이 작성한 초안만 바로 게시할 수 있습니다.");
  }
}

export async function publishSocialPostDraftToGallery(id: string) {
  const staff = await requireAdmin();

  const currentDraft = await getSocialPostDraftById(id);
  assertCanPublishDraft(currentDraft, staff);

  const mediaItems = parseSocialDraftMedia(currentDraft!.mediaJSON).filter((item) => item.type === "image");
  if (mediaItems.length === 0) {
    throw new Error("인스타그램 자동 게시에는 사진이 최소 1장 필요합니다.");
  }

  const galleryPostId = await upsertGalleryPostFromSocialDraft(currentDraft!);
  const draft = await markSocialPostDraftPublishing(id, { galleryPostId });

  revalidateSocialPostPaths();
  return { ok: true, draft, galleryPostId };
}

export async function publishSocialPostDraftToInstagram(id: string) {
  const staff = await requireAdmin();

  const currentDraft = await getSocialPostDraftById(id);
  if (currentDraft?.status === "PUBLISHED") {
    return { ok: true, draft: currentDraft };
  }

  assertCanPublishDraft(currentDraft, staff);

  const mediaItems = parseSocialDraftMedia(currentDraft!.mediaJSON).filter((item) => item.type === "image");
  if (mediaItems.length === 0) {
    throw new Error("인스타그램 자동 게시에는 사진이 최소 1장 필요합니다.");
  }

  const result = await publishSocialDraftToInstagramNow(id, { queueMode: true });
  revalidateSocialPostPaths();
  return result;
}

export async function publishSocialPostDraft(id: string) {
  await publishSocialPostDraftToGallery(id);
  return publishSocialPostDraftToInstagram(id);
}
