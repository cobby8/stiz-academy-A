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
import { materializePrivateMediaJSON, plannedPublishedMediaCopyPaths, PUBLIC_GALLERY_BUCKET } from "@/lib/sessionPhotoStorage";
import { assertSocialDraftMediaConsent, withSocialDraftPublicationReservation } from "@/lib/studentMediaConsent";

const MAX_QUEUE_ATTEMPTS = 3;
const RETRY_DELAYS_MINUTES = [1, 5];

export function fullSocialCaption(caption?: string | null, hashtags?: string | null) {
  return [caption?.trim(), hashtags?.trim()].filter(Boolean).join("\n\n");
}

async function ensureDraftMediaIsPublic(draft: SocialPostDraft) {
  try {
    const mediaJSON = await materializePrivateMediaJSON(draft.id, draft.mediaJSON, {
      classId: draft.classId,
      sessionId: draft.sessionId,
    });
    if (mediaJSON === draft.mediaJSON) return draft;
    const updated = await replaceSocialPostDraftMediaJSON(draft.id, mediaJSON);
    if (!updated) throw new Error("게시용 사진 정보를 저장하지 못했습니다.");
    return updated;
  } catch (error) {
    for (const path of plannedPublishedMediaCopyPaths(draft.id, draft.mediaJSON)) {
      await prisma.$executeRawUnsafe(`
        INSERT INTO "StorageDeletionJob" (id,bucket,path,status,attempts,"nextAttemptAt","createdAt","updatedAt")
        VALUES (gen_random_uuid()::text,$1,$2,'PENDING',0,NOW(),NOW(),NOW()) ON CONFLICT (bucket,path) DO NOTHING
      `, PUBLIC_GALLERY_BUCKET, path);
    }
    throw error;
  }
}

async function upsertGalleryPostFromSocialDraftLocked(draft: SocialPostDraft) {
  await assertSocialDraftMediaConsent(draft, "GALLERY");
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
    await prisma.$executeRawUnsafe(
      `UPDATE "SocialPostDraft" SET status = 'PUBLISHING', "updatedAt" = NOW() WHERE id = $1 AND status IN ('READY', 'FAILED')`,
      draft.id,
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

  await prisma.$executeRawUnsafe(
    `UPDATE "SocialPostDraft" SET "galleryPostId" = $2, status = 'PUBLISHING', "updatedAt" = NOW()
      WHERE id = $1 AND status IN ('READY', 'FAILED', 'PUBLISHING')`,
    draft.id,
    rows[0].id,
  );

  return rows[0].id;
}

export async function upsertGalleryPostFromSocialDraft(
  draft: SocialPostDraft,
  options: { consentLocked?: boolean } = {},
) {
  if (options.consentLocked) return upsertGalleryPostFromSocialDraftLocked(draft);
  return withSocialDraftPublicationReservation(draft.id, "GALLERY", async (snapshot, attemptId) => {
    try {
      const galleryPostId = await upsertGalleryPostFromSocialDraftLocked(snapshot);
      await prisma.$executeRawUnsafe(`UPDATE "SocialPublishAttempt" SET state='PUBLISHED', "providerMediaId"=$2, "updatedAt"=NOW() WHERE id=$1`, attemptId, galleryPostId);
      return galleryPostId;
    } catch (error) {
      await prisma.$executeRawUnsafe(`UPDATE "SocialPublishAttempt" SET state='FAILED', "lastError"=$2, "updatedAt"=NOW() WHERE id=$1`, attemptId, error instanceof Error ? error.message.slice(0, 1000) : "Gallery publish failed");
      throw error;
    }
  });
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
  return withSocialDraftPublicationReservation(id, "INSTAGRAM", async (snapshot, attemptId) => {
    await prisma.$executeRawUnsafe(`UPDATE "SocialPublishAttempt" SET state='AMBIGUOUS', "updatedAt"=NOW() WHERE id=$1`, attemptId);
    try {
      return await publishSocialDraftToInstagramNowLocked(snapshot, attemptId, options);
    } catch (error) {
      await prisma.$executeRawUnsafe(`UPDATE "SocialPublishAttempt" SET "lastError"=$2, "updatedAt"=NOW() WHERE id=$1`, attemptId, error instanceof Error ? error.message.slice(0, 1000) : "Instagram result unknown");
      await prisma.$executeRawUnsafe(`
        WITH attempt AS (SELECT * FROM "SocialPublishAttempt" WHERE id=$1), subjects AS (
          SELECT jsonb_array_elements_text(stiz_try_jsonb(a."subjectSnapshotJSON")) AS "studentId", a.* FROM attempt a
        ), latest AS (
          SELECT DISTINCT ON (c."studentId") c."studentId", c.id AS "consentId" FROM "StudentMediaConsent" c
          JOIN subjects s ON s."studentId"=c."studentId" ORDER BY c."studentId", c."recordedAt" DESC, c.id DESC
        )
        INSERT INTO "MediaRevocationJob" (id,"studentId","consentId","draftId",channel,"resourceId","resourceUrl",status,attempts,"nextAttemptAt","lastError","createdAt","updatedAt")
        SELECT gen_random_uuid()::text,l."studentId",l."consentId",a."draftId",'INSTAGRAM',a.id,a."providerPermalink",'MANUAL_REQUIRED',0,NOW(),
          'Instagram 게시 결과가 불명확합니다. Meta에서 게시 여부를 직접 확인하세요. providerMediaId='||COALESCE(a."providerMediaId",'unknown'),NOW(),NOW()
        FROM attempt a CROSS JOIN latest l
        ON CONFLICT ("consentId","draftId",channel) DO UPDATE SET status='MANUAL_REQUIRED', "resourceId"=EXCLUDED."resourceId", "resourceUrl"=EXCLUDED."resourceUrl", "lastError"=EXCLUDED."lastError", "updatedAt"=NOW()
      `, attemptId);
      throw error;
    }
  });
}

async function publishSocialDraftToInstagramNowLocked(
  currentDraft: SocialPostDraft,
  attemptId: string,
  options: { queueMode?: boolean } = {},
) {
  const id = currentDraft.id;
  if (currentDraft?.status === "PUBLISHED") {
    return { ok: true as const, draft: currentDraft, skipped: true as const };
  }

  if (!currentDraft || !["READY", "FAILED", "PUBLISHING"].includes(currentDraft.status)) {
    throw new Error("게시할 수 있는 초안을 찾지 못했습니다.");
  }

  // 대기 중 동의가 철회될 수 있으므로 실제 외부 발행 직전에 다시 확인합니다.
  await assertSocialDraftMediaConsent(currentDraft, "INSTAGRAM");

  currentDraft = await ensureDraftMediaIsPublic(currentDraft);

  const mediaItems = parseSocialDraftMedia(currentDraft.mediaJSON).filter((item) => item.type === "image");
  if (mediaItems.length === 0) {
    throw new Error("인스타그램 자동 게시에는 사진이 최소 1장 필요합니다.");
  }

  const galleryPostId = currentDraft.galleryPostId || await upsertGalleryPostFromSocialDraft(currentDraft, { consentLocked: true });
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

  const settings = await getAcademySettings();
  const caption = fullSocialCaption(currentDraft.caption, currentDraft.hashtags);
  const result = await publishGalleryPostToInstagram({
    businessAccountId: settings.instagramBusinessAccountId,
    caption,
    mediaJSON: currentDraft.mediaJSON,
  });

  if (result.attempted && result.ok) {
    // Persist the provider identity before any derived DB updates; later failures remain recoverable.
    await prisma.$executeRawUnsafe(`
      UPDATE "SocialPublishAttempt" SET state='PUBLISHED', "providerMediaId"=$2, "providerPermalink"=$3,
        "providerResultJSON"=$4, "updatedAt"=NOW() WHERE id=$1
    `, attemptId, result.instagramMediaId || null, result.permalink || null, JSON.stringify(result));
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

  await prisma.$executeRawUnsafe(
    `UPDATE "SocialPublishAttempt" SET state='FAILED', "lastError"=$2, "providerResultJSON"=$3, "updatedAt"=NOW() WHERE id=$1`,
    attemptId, error, JSON.stringify(result),
  );
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
      const ambiguous = await prisma.$queryRawUnsafe<Array<{ id: string }>>(`
        SELECT id FROM "SocialPublishAttempt" WHERE "draftId"=$1 AND channel='INSTAGRAM' AND state='AMBIGUOUS' LIMIT 1
      `, draft.id);
      if (ambiguous[0]) {
        await prisma.$executeRawUnsafe(`
          UPDATE "SocialPostDraft" SET status='FAILED', "instagramNextRetryAt"=NULL,
            "instagramPublishError"='Instagram 게시 결과 확인 필요', "updatedAt"=NOW() WHERE id=$1
        `, draft.id);
        results.push({ id: draft.id, ok: false, status: "FAILED", retryScheduled: false, error: "Instagram 게시 결과가 불명확하여 자동 재발행을 중단했습니다." });
        continue;
      }
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
