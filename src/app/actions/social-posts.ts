"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireStaff } from "@/lib/auth-guard";
import { generateSocialCaptionDraft } from "@/lib/socialCaptionAI";
import { publishGalleryPostToInstagram } from "@/lib/instagram";
import { ensureGalleryPostInstagramColumns } from "@/lib/instagramGallerySync";
import { getAcademySettings } from "@/lib/queries";
import {
  createSocialPostDraftRecord,
  getSocialPostDraftById,
  markSocialPostDraftFailed,
  markSocialPostDraftPublished,
  parseSocialDraftMedia,
  rejectSocialPostDraftRecord,
  safeSocialDraftMediaJSON,
  updateSocialPostDraftRecord,
  type SocialPostDraft,
} from "@/lib/socialDrafts";

type SaveDraftInput = {
  title?: string | null;
  caption?: string | null;
  hashtags?: string | null;
  lessonType?: string | null;
  memo?: string | null;
  isPublic?: boolean;
};

function fullCaption(caption?: string | null, hashtags?: string | null) {
  return [caption?.trim(), hashtags?.trim()].filter(Boolean).join("\n\n");
}

function revalidateSocialPostPaths() {
  revalidatePath("/staff/quick-post");
  revalidatePath("/admin/gallery");
  revalidatePath("/gallery");
  revalidatePath("/mypage");
  revalidatePath("/");
}

async function upsertGalleryPostFromDraft(draft: SocialPostDraft) {
  await ensureGalleryPostInstagramColumns();

  const caption = fullCaption(draft.caption, draft.hashtags);

  if (draft.galleryPostId) {
    await prisma.$executeRawUnsafe(
      `UPDATE "GalleryPost"
       SET title = $1,
           caption = $2,
           "mediaJSON" = $3,
           "isPublic" = $4,
           source = 'STAFF_UPLOAD',
           "updatedAt" = NOW()
       WHERE id = $5`,
      draft.title || "STIZ 수업 스케치",
      caption || null,
      draft.mediaJSON,
      draft.isPublic !== false,
      draft.galleryPostId,
    );
    return draft.galleryPostId;
  }

  const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `INSERT INTO "GalleryPost" (
       id, title, caption, "mediaJSON", "isPublic", source, "createdAt", "updatedAt"
     )
     VALUES (
       (gen_random_uuid())::text, $1, $2, $3, $4, 'STAFF_UPLOAD', NOW(), NOW()
     )
     RETURNING id`,
    draft.title || "STIZ 수업 스케치",
    caption || null,
    draft.mediaJSON,
    draft.isPublic !== false,
  );

  return rows[0].id;
}

export async function createSocialPostDraft(data: {
  mediaJSON: string;
  lessonType?: string | null;
  memo?: string | null;
  isPublic?: boolean;
}) {
  const staff = await requireStaff();
  const mediaJSON = safeSocialDraftMediaJSON(data.mediaJSON);
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
  const draft = await rejectSocialPostDraftRecord(id);
  revalidateSocialPostPaths();
  return { ok: true, draft };
}

export async function publishSocialPostDraft(id: string) {
  await requireAdmin();

  const currentDraft = await getSocialPostDraftById(id);
  if (!currentDraft || (currentDraft.status !== "READY" && currentDraft.status !== "FAILED")) {
    throw new Error("게시할 수 있는 초안을 찾지 못했습니다.");
  }

  const mediaItems = parseSocialDraftMedia(currentDraft.mediaJSON).filter((item) => item.type === "image");
  if (mediaItems.length === 0) {
    throw new Error("인스타그램 자동 게시에는 사진이 최소 1장 필요합니다.");
  }

  const galleryPostId = await upsertGalleryPostFromDraft(currentDraft);
  const settings = (await getAcademySettings()) as any;
  const caption = fullCaption(currentDraft.caption, currentDraft.hashtags);
  const result = await publishGalleryPostToInstagram({
    businessAccountId: settings.instagramBusinessAccountId,
    caption,
    mediaJSON: currentDraft.mediaJSON,
  });

  if (result.attempted && result.ok) {
    await prisma.$executeRawUnsafe(
      `UPDATE "GalleryPost"
       SET "instagramMediaId" = $1,
           "instagramPermalink" = $2,
           "instagramPublishedAt" = NOW(),
           "instagramPublishError" = NULL
       WHERE id = $3`,
      result.instagramMediaId || null,
      result.permalink || null,
      galleryPostId,
    );

    const draft = await markSocialPostDraftPublished(id, {
      galleryPostId,
      instagramMediaId: result.instagramMediaId || null,
      instagramPermalink: result.permalink || null,
    });

    revalidateSocialPostPaths();
    return { ok: true, draft };
  }

  const error = result.attempted
    ? result.error || "인스타그램 게시에 실패했습니다."
    : result.skippedReason || "인스타그램 게시 설정이 아직 준비되지 않았습니다.";

  await prisma.$executeRawUnsafe(
    `UPDATE "GalleryPost"
     SET "instagramPublishError" = $1
     WHERE id = $2`,
    error,
    galleryPostId,
  );

  const draft = await markSocialPostDraftFailed(id, { galleryPostId, error });
  revalidateSocialPostPaths();
  return { ok: false, draft, error };
}
