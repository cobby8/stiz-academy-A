import { prisma } from "@/lib/prisma";
import { publishGalleryPostToInstagram } from "@/lib/instagram";
import { ensureGalleryPostInstagramColumns } from "@/lib/instagramGallerySync";
import { getAcademySettings } from "@/lib/queries";
import {
  getQueuedSocialPostDrafts,
  getSocialPostDraftById,
  markSocialPostDraftFailed,
  markSocialPostDraftPublishAttempt,
  markSocialPostDraftPublished,
  markSocialPostDraftPublishing,
  markSocialPostDraftRetryScheduled,
  parseSocialDraftMedia,
  replaceSocialPostDraftMediaJSON,
  type SocialPostDraft,
} from "@/lib/socialDrafts";
import { materializePrivateMediaJSON } from "@/lib/sessionPhotoStorage";

const MAX_QUEUE_ATTEMPTS = 3;
const RETRY_DELAYS_MINUTES = [1, 5];

export function fullSocialCaption(caption?: string | null, hashtags?: string | null) {
  return [caption?.trim(), hashtags?.trim()].filter(Boolean).join("\n\n");
}

async function ensureDraftMediaIsPublic(draft: SocialPostDraft) {
  const mediaJSON = await materializePrivateMediaJSON(draft.id, draft.mediaJSON, {
    classId: draft.classId,
    sessionId: draft.sessionId,
  });
  if (mediaJSON === draft.mediaJSON) return draft;
  const updated = await replaceSocialPostDraftMediaJSON(draft.id, mediaJSON);
  if (!updated) throw new Error("게시용 사진 정보를 저장하지 못했습니다.");
  return updated;
}

export async function upsertGalleryPostFromSocialDraft(draft: SocialPostDraft) {
  draft = await ensureDraftMediaIsPublic(draft);
  await ensureGalleryPostInstagramColumns();

  const caption = fullSocialCaption(draft.caption, draft.hashtags);

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

  // 초안 ID에서 결정되는 고정 Gallery ID를 사용해 중복 클릭도 한 게시물로 합칩니다.
  const galleryPostId = `social-draft-${draft.id}`;
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `INSERT INTO "GalleryPost" (
       id, title, caption, "mediaJSON", "isPublic", source, "createdAt", "updatedAt"
     )
     VALUES (
       $1, $2, $3, $4, $5, 'STAFF_UPLOAD', NOW(), NOW()
     )
     ON CONFLICT (id) DO UPDATE SET
       title = EXCLUDED.title,
       caption = EXCLUDED.caption,
       "mediaJSON" = EXCLUDED."mediaJSON",
       "isPublic" = EXCLUDED."isPublic",
       "updatedAt" = NOW()
     RETURNING id`,
    galleryPostId,
    draft.title || "STIZ 수업 스케치",
    caption || null,
    draft.mediaJSON,
    draft.isPublic !== false,
  );

  return rows[0].id;
}

function nextRetryDate(attempts: number) {
  const delayMinutes = RETRY_DELAYS_MINUTES[Math.max(0, attempts - 1)] ?? RETRY_DELAYS_MINUTES.at(-1) ?? 5;
  return new Date(Date.now() + delayMinutes * 60 * 1000);
}

async function updateGalleryInstagramError(galleryPostId: string, error: string | null) {
  await prisma.$executeRawUnsafe(
    `UPDATE "GalleryPost"
     SET "instagramPublishError" = $1
     WHERE id = $2`,
    error,
    galleryPostId,
  );
}

export async function publishSocialDraftToInstagramNow(
  id: string,
  options: { queueMode?: boolean } = {},
) {
  let currentDraft = await getSocialPostDraftById(id);
  if (currentDraft?.status === "PUBLISHED") {
    return { ok: true as const, draft: currentDraft, skipped: true as const };
  }

  if (!currentDraft || !["READY", "FAILED", "PUBLISHING"].includes(currentDraft.status)) {
    throw new Error("게시할 수 있는 초안을 찾지 못했습니다.");
  }

  currentDraft = await ensureDraftMediaIsPublic(currentDraft);

  const mediaItems = parseSocialDraftMedia(currentDraft.mediaJSON).filter((item) => item.type === "image");
  if (mediaItems.length === 0) {
    throw new Error("인스타그램 자동 게시에는 사진이 최소 1장 필요합니다.");
  }

  const galleryPostId = currentDraft.galleryPostId || await upsertGalleryPostFromSocialDraft(currentDraft);
  let workingDraft = currentDraft;
  if (!currentDraft.galleryPostId || (options.queueMode && currentDraft.status !== "PUBLISHING")) {
    workingDraft = await markSocialPostDraftPublishing(id, { galleryPostId });
  }

  const attemptDraft = options.queueMode
    ? await markSocialPostDraftPublishAttempt(id)
    : workingDraft;

  if (options.queueMode && !attemptDraft) {
    const latest = await getSocialPostDraftById(id);
    return { ok: true as const, draft: latest ?? currentDraft, skipped: true as const };
  }

  const settings = (await getAcademySettings()) as any;
  const caption = fullSocialCaption(currentDraft.caption, currentDraft.hashtags);
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

    return { ok: true as const, draft };
  }

  const error = result.attempted
    ? result.error || "인스타그램 게시에 실패했습니다."
    : result.skippedReason || "인스타그램 게시 설정이 아직 준비되지 않았습니다.";

  await updateGalleryInstagramError(galleryPostId, error);

  const attempts = attemptDraft?.instagramPublishAttempts ?? currentDraft.instagramPublishAttempts;
  if (options.queueMode && result.attempted && attempts < MAX_QUEUE_ATTEMPTS) {
    const draft = await markSocialPostDraftRetryScheduled(id, {
      galleryPostId,
      error,
      nextRetryAt: nextRetryDate(attempts),
    });

    return { ok: false as const, draft, error, retryScheduled: true as const };
  }

  const draft = await markSocialPostDraftFailed(id, { galleryPostId, error });
  return { ok: false as const, draft, error };
}

export async function processSocialPostPublishQueue(limit = 1) {
  const drafts = await getQueuedSocialPostDrafts(limit);
  const results = [];

  for (const draft of drafts) {
    try {
      const result = await publishSocialDraftToInstagramNow(draft.id, { queueMode: true });
      results.push({
        id: draft.id,
        ok: result.ok,
        status: result.draft.status,
        retryScheduled: "retryScheduled" in result ? result.retryScheduled === true : false,
        error: "error" in result ? result.error : null,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "인스타그램 게시 처리 중 오류가 발생했습니다.";
      const attempts = draft.instagramPublishAttempts + 1;

      if (draft.galleryPostId && attempts < MAX_QUEUE_ATTEMPTS) {
        const scheduled = await markSocialPostDraftRetryScheduled(draft.id, {
          galleryPostId: draft.galleryPostId,
          error: message,
          nextRetryAt: nextRetryDate(attempts),
        });

        results.push({
          id: draft.id,
          ok: false,
          status: scheduled.status,
          retryScheduled: true,
          error: message,
        });
        continue;
      }

      if (draft.galleryPostId) {
        const failed = await markSocialPostDraftFailed(draft.id, {
          galleryPostId: draft.galleryPostId,
          error: message,
        });

        results.push({
          id: draft.id,
          ok: false,
          status: failed.status,
          retryScheduled: false,
          error: message,
        });
        continue;
      }

      results.push({
        id: draft.id,
        ok: false,
        status: draft.status,
        retryScheduled: false,
        error: message,
      });
    }
  }

  return {
    ok: results.every((result) => result.ok || result.retryScheduled),
    processed: results.length,
    succeeded: results.filter((result) => result.ok).length,
    retryScheduled: results.filter((result) => result.retryScheduled).length,
    failed: results.filter((result) => !result.ok && !result.retryScheduled).length,
    results,
  };
}
