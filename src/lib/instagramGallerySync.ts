import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  fetchRecentInstagramMedia,
  toGalleryMediaJSON,
  type InstagramRemoteMedia,
} from "@/lib/instagram";
import {
  isDurableGalleryMediaUrl,
  parseGalleryMediaJSON,
  type GalleryMediaItem,
} from "@/lib/galleryMedia";

export type InstagramGallerySyncResult = {
  ok: boolean;
  imported: number;
  refreshed: number;
  skipped: number;
  fetched: number;
  message: string;
};

type InstagramGalleryInsert = {
  title: string;
  caption: string | null;
  mediaJSON: string;
  externalId: string;
  externalUrl: string | null;
  publishedAt: string | null;
};

let galleryInstagramColumnsEnsured = false;

export async function ensureGalleryPostInstagramColumns() {
  if (galleryInstagramColumnsEnsured) return;

  const columns: [string, string][] = [
    ["source", "TEXT DEFAULT 'WEBSITE'"],
    ["externalId", "TEXT"],
    ["externalUrl", "TEXT"],
    ["instagramMediaId", "TEXT"],
    ["instagramPermalink", "TEXT"],
    ["instagramPublishedAt", "TIMESTAMPTZ"],
    ["instagramPublishError", "TEXT"],
  ];

  for (const [col, type] of columns) {
    try {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "GalleryPost" ADD COLUMN IF NOT EXISTS "${col}" ${type}`,
      );
    } catch (error) {
      console.warn(`[instagram/gallery-sync] ensure column "${col}" failed:`, (error as Error).message);
    }
  }

  galleryInstagramColumnsEnsured = true;
}

function toInsertRow(media: InstagramRemoteMedia): InstagramGalleryInsert | null {
  const mediaJSON = toGalleryMediaJSON(media);
  if (mediaJSON === "[]") return null;

  const caption = media.caption?.trim() || null;
  const title = caption ? caption.split("\n")[0].slice(0, 80) : "Instagram 게시물";

  return {
    title,
    caption,
    mediaJSON,
    externalId: media.id,
    externalUrl: media.permalink ?? null,
    publishedAt: media.timestamp ?? null,
  };
}

function safePathSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 80) || "media";
}

async function compressImageForInstagramArchive(buffer: Buffer) {
  const sharp = (await import("sharp")).default;
  return sharp(buffer, { failOn: "none" })
    .rotate()
    .resize({
      width: 1440,
      height: 1440,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({
      quality: 58,
      effort: 6,
      smartSubsample: true,
    })
    .toBuffer();
}

async function archiveInstagramImage({
  url,
  externalId,
  index,
}: {
  url: string;
  externalId: string;
  index: number;
}) {
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; STIZGallerySync/1.0)",
      Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
    },
  });

  if (!response.ok) {
    throw new Error(`Instagram image download failed: ${response.status}`);
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.startsWith("image/")) {
    throw new Error(`Instagram media is not an image: ${contentType || "unknown"}`);
  }

  const original = Buffer.from(await response.arrayBuffer());
  const compressed = await compressImageForInstagramArchive(original);
  const supabase = createAdminClient();
  const bucket = "uploads";
  await supabase.storage.createBucket(bucket, { public: true }).catch(() => {});

  const path = `instagram-gallery/${safePathSegment(externalId)}-${index}-${Date.now()}.webp`;
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, compressed, {
      contentType: "image/webp",
      cacheControl: "31536000",
      upsert: true,
    });

  if (error) {
    throw new Error(`Supabase upload failed: ${error.message}`);
  }

  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path);
  return urlData.publicUrl;
}

async function archiveInstagramMediaJSON(mediaJSON: string, externalId: string) {
  const items = parseGalleryMediaJSON(mediaJSON);
  if (items.length === 0) return mediaJSON;

  const archivedItems: GalleryMediaItem[] = [];
  for (const [index, item] of items.entries()) {
    if (item.type !== "image") {
      archivedItems.push(item);
      continue;
    }

    if (isDurableGalleryMediaUrl(item.url)) {
      archivedItems.push(item);
      continue;
    }

    const archivedUrl = await archiveInstagramImage({
      url: item.url,
      externalId,
      index,
    });
    archivedItems.push({ ...item, url: archivedUrl });
  }

  return JSON.stringify(archivedItems);
}

export async function syncInstagramGalleryPostsToDb({
  businessAccountId,
  limit = 25,
}: {
  businessAccountId?: string | null;
  limit?: number;
}): Promise<InstagramGallerySyncResult> {
  try {
    await ensureGalleryPostInstagramColumns();

    const result = await fetchRecentInstagramMedia({ businessAccountId, limit });
    if (!result.ok) {
      return {
        ok: false,
        imported: 0,
        refreshed: 0,
        skipped: 0,
        fetched: 0,
        message: result.reason,
      };
    }

    const candidates = result.media
      .map(toInsertRow)
      .filter((row): row is InstagramGalleryInsert => row !== null);

    const archivedCandidates: InstagramGalleryInsert[] = [];
    for (const candidate of candidates) {
      try {
        archivedCandidates.push({
          ...candidate,
          mediaJSON: await archiveInstagramMediaJSON(candidate.mediaJSON, candidate.externalId),
        });
      } catch (error) {
        console.warn(
          `[instagram/gallery-sync] archive failed for ${candidate.externalId}:`,
          (error as Error).message,
        );
      }
    }

    if (archivedCandidates.length === 0) {
      return {
        ok: true,
        imported: 0,
        refreshed: 0,
        skipped: candidates.length,
        fetched: result.media.length,
        message: `인스타그램 게시물 0개를 가져왔고 ${result.media.length}개는 건너뛰었습니다.`,
      };
    }

    const idPlaceholders = archivedCandidates.map((_, index) => `$${index + 1}`).join(", ");
    const existingRows = await prisma.$queryRawUnsafe<Array<{ externalId: string }>>(
      `SELECT "externalId" AS "externalId"
       FROM "GalleryPost"
       WHERE source = 'INSTAGRAM'
         AND "externalId" IN (${idPlaceholders})`,
      ...archivedCandidates.map((row) => row.externalId),
    );
    const existingIds = new Set(existingRows.map((row) => row.externalId).filter(Boolean));
    const rowsToRefresh = archivedCandidates.filter((row) => existingIds.has(row.externalId));
    const rowsToInsert = archivedCandidates.filter((row) => !existingIds.has(row.externalId));

    if (rowsToRefresh.length > 0) {
      const refreshValuesSql = rowsToRefresh
        .map((_, rowIndex) => {
          const base = rowIndex * 3;
          return `($${base + 1}::text, $${base + 2}::text, $${base + 3}::text)`;
        })
        .join(", ");
      const refreshValues = rowsToRefresh.flatMap((row) => [
        row.mediaJSON,
        row.externalId,
        row.externalUrl,
      ]);

      await prisma.$executeRawUnsafe(
        `UPDATE "GalleryPost" AS g
         SET "mediaJSON" = incoming.media_json,
             "externalUrl" = incoming.external_url,
             "updatedAt" = NOW()
         FROM (VALUES ${refreshValuesSql}) AS incoming(media_json, external_id, external_url)
         WHERE g.source = 'INSTAGRAM'
           AND g."externalId" = incoming.external_id`,
        ...refreshValues,
      );
    }

    if (rowsToInsert.length === 0) {
      return {
        ok: true,
        imported: 0,
        refreshed: rowsToRefresh.length,
        skipped: result.media.length,
        fetched: result.media.length,
        message: `인스타그램 새 게시물 0개를 가져왔고 기존 ${rowsToRefresh.length}개의 이미지 주소를 갱신했습니다.`,
      };
    }

    const valuesSql = rowsToInsert
      .map((_, rowIndex) => {
        const base = rowIndex * 6;
        return `($${base + 1}::text, $${base + 2}::text, $${base + 3}::text, $${base + 4}::text, $${base + 5}::text, $${base + 6}::timestamptz)`;
      })
      .join(", ");
    const values = rowsToInsert.flatMap((row) => [
      row.title,
      row.caption,
      row.mediaJSON,
      row.externalId,
      row.externalUrl,
      row.publishedAt,
    ]);

    const insertedRows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `INSERT INTO "GalleryPost"
          (id, title, caption, "mediaJSON", "isPublic", source, "externalId", "externalUrl", "createdAt", "updatedAt")
       SELECT gen_random_uuid()::text,
              incoming.title,
              incoming.caption,
              incoming.media_json,
              true,
              'INSTAGRAM',
              incoming.external_id,
              incoming.external_url,
              COALESCE(incoming.published_at, NOW()),
              NOW()
       FROM (VALUES ${valuesSql}) AS incoming(title, caption, media_json, external_id, external_url, published_at)
       WHERE NOT EXISTS (
         SELECT 1
         FROM "GalleryPost" g
         WHERE g.source = 'INSTAGRAM'
           AND g."externalId" = incoming.external_id
       )
       RETURNING id`,
      ...values,
    );

    const imported = insertedRows.length;
    const skipped = result.media.length - imported;

    return {
      ok: true,
      imported,
      refreshed: rowsToRefresh.length,
      skipped,
      fetched: result.media.length,
      message: `인스타그램 새 게시물 ${imported}개를 가져왔고 기존 ${rowsToRefresh.length}개의 이미지 주소를 갱신했습니다.`,
    };
  } catch (error) {
    console.error("[instagram/gallery-sync] failed:", error);
    return {
      ok: false,
      imported: 0,
      refreshed: 0,
      skipped: 0,
      fetched: 0,
      message: "인스타그램 동기화 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
    };
  }
}
