import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";
import type { SocialMediaItem } from "@/lib/socialCaptionAI";

export type SocialPostDraftStatus = "DRAFT" | "READY" | "PUBLISHED" | "REJECTED" | "FAILED";

export type SocialPostDraft = {
  id: string;
  authorUserId: string | null;
  authorName: string | null;
  authorRole: string | null;
  status: SocialPostDraftStatus;
  lessonType: string | null;
  memo: string | null;
  title: string | null;
  caption: string | null;
  hashtags: string | null;
  mediaJSON: string;
  isPublic: boolean;
  galleryPostId: string | null;
  instagramMediaId: string | null;
  instagramPermalink: string | null;
  instagramPublishError: string | null;
  submittedAt: string | null;
  publishedAt: string | null;
  rejectedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

let tableEnsured = false;

function toIso(value: unknown) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function mapDraft(row: any): SocialPostDraft {
  return {
    id: row.id,
    authorUserId: row.authorUserId ?? null,
    authorName: row.authorName ?? null,
    authorRole: row.authorRole ?? null,
    status: row.status,
    lessonType: row.lessonType ?? null,
    memo: row.memo ?? null,
    title: row.title ?? null,
    caption: row.caption ?? null,
    hashtags: row.hashtags ?? null,
    mediaJSON: row.mediaJSON || "[]",
    isPublic: row.isPublic !== false,
    galleryPostId: row.galleryPostId ?? null,
    instagramMediaId: row.instagramMediaId ?? null,
    instagramPermalink: row.instagramPermalink ?? null,
    instagramPublishError: row.instagramPublishError ?? null,
    submittedAt: toIso(row.submittedAt),
    publishedAt: toIso(row.publishedAt),
    rejectedAt: toIso(row.rejectedAt),
    createdAt: toIso(row.createdAt) || new Date().toISOString(),
    updatedAt: toIso(row.updatedAt) || new Date().toISOString(),
  };
}

export function parseSocialDraftMedia(mediaJSON: string): SocialMediaItem[] {
  try {
    const parsed = JSON.parse(mediaJSON);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is SocialMediaItem => {
      return typeof item?.url === "string" && (item.type === "image" || item.type === "video");
    });
  } catch {
    return [];
  }
}

export function safeSocialDraftMediaJSON(mediaJSON: string) {
  return JSON.stringify(parseSocialDraftMedia(mediaJSON));
}

export async function ensureSocialPostDraftTable() {
  if (tableEnsured) return;

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "SocialPostDraft" (
      id TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
      "authorUserId" TEXT,
      "authorName" TEXT,
      "authorRole" TEXT,
      status TEXT NOT NULL DEFAULT 'DRAFT',
      "lessonType" TEXT,
      memo TEXT,
      title TEXT,
      caption TEXT,
      hashtags TEXT,
      "mediaJSON" TEXT NOT NULL DEFAULT '[]',
      "isPublic" BOOLEAN NOT NULL DEFAULT true,
      "galleryPostId" TEXT,
      "instagramMediaId" TEXT,
      "instagramPermalink" TEXT,
      "instagramPublishError" TEXT,
      "submittedAt" TIMESTAMPTZ,
      "publishedAt" TIMESTAMPTZ,
      "rejectedAt" TIMESTAMPTZ,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "SocialPostDraft_status_idx" ON "SocialPostDraft" (status)`
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "SocialPostDraft_author_idx" ON "SocialPostDraft" ("authorUserId")`
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "SocialPostDraft_createdAt_idx" ON "SocialPostDraft" ("createdAt" DESC)`
  );

  tableEnsured = true;
}

export async function createSocialPostDraftRecord(data: {
  authorUserId: string;
  authorName: string;
  authorRole: string;
  lessonType?: string | null;
  memo?: string | null;
  title?: string | null;
  caption?: string | null;
  hashtags?: string | null;
  mediaJSON: string;
  isPublic?: boolean;
}) {
  await ensureSocialPostDraftTable();

  const rows = await prisma.$queryRawUnsafe<any[]>(
    `INSERT INTO "SocialPostDraft" (
       id, "authorUserId", "authorName", "authorRole", status,
       "lessonType", memo, title, caption, hashtags, "mediaJSON", "isPublic",
       "submittedAt", "createdAt", "updatedAt"
     )
     VALUES (
       (gen_random_uuid())::text, $1, $2, $3, 'READY',
       $4, $5, $6, $7, $8, $9, $10,
       NOW(), NOW(), NOW()
     )
     RETURNING *`,
    data.authorUserId,
    data.authorName,
    data.authorRole,
    data.lessonType || null,
    data.memo || null,
    data.title || null,
    data.caption || null,
    data.hashtags || null,
    safeSocialDraftMediaJSON(data.mediaJSON),
    data.isPublic !== false,
  );

  return mapDraft(rows[0]);
}

export async function getPendingSocialPostDrafts(limit = 30) {
  await requireAdmin();
  await ensureSocialPostDraftTable();

  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT * FROM "SocialPostDraft"
     WHERE status IN ('READY', 'FAILED')
     ORDER BY "createdAt" DESC
     LIMIT $1`,
    limit,
  );

  return rows.map(mapDraft);
}

export async function getSocialPostDraftById(id: string) {
  await ensureSocialPostDraftTable();

  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT * FROM "SocialPostDraft" WHERE id = $1 LIMIT 1`,
    id,
  );

  return rows[0] ? mapDraft(rows[0]) : null;
}

export async function updateSocialPostDraftRecord(
  id: string,
  data: {
    title?: string | null;
    caption?: string | null;
    hashtags?: string | null;
    lessonType?: string | null;
    memo?: string | null;
    isPublic?: boolean;
  },
  options?: { authorUserId?: string | null },
) {
  await ensureSocialPostDraftTable();

  const rows = await prisma.$queryRawUnsafe<any[]>(
    `UPDATE "SocialPostDraft"
     SET title = $1,
         caption = $2,
         hashtags = $3,
         "lessonType" = $4,
         memo = $5,
         "isPublic" = $6,
         "updatedAt" = NOW()
     WHERE id = $7
       AND status IN ('DRAFT', 'READY', 'FAILED')
       AND ($8::text IS NULL OR "authorUserId" = $8)
     RETURNING *`,
    data.title || null,
    data.caption || null,
    data.hashtags || null,
    data.lessonType || null,
    data.memo || null,
    data.isPublic !== false,
    id,
    options?.authorUserId || null,
  );

  if (!rows[0]) {
    throw new Error("수정할 수 있는 초안을 찾지 못했습니다.");
  }

  return mapDraft(rows[0]);
}

export async function rejectSocialPostDraftRecord(id: string) {
  await ensureSocialPostDraftTable();

  const rows = await prisma.$queryRawUnsafe<any[]>(
    `UPDATE "SocialPostDraft"
     SET status = 'REJECTED', "rejectedAt" = NOW(), "updatedAt" = NOW()
     WHERE id = $1 AND status IN ('DRAFT', 'READY', 'FAILED')
     RETURNING *`,
    id,
  );

  if (!rows[0]) {
    throw new Error("반려할 수 있는 초안을 찾지 못했습니다.");
  }

  return mapDraft(rows[0]);
}

export async function markSocialPostDraftPublished(
  id: string,
  data: {
    galleryPostId: string;
    instagramMediaId?: string | null;
    instagramPermalink?: string | null;
  },
) {
  await ensureSocialPostDraftTable();

  const rows = await prisma.$queryRawUnsafe<any[]>(
    `UPDATE "SocialPostDraft"
     SET status = 'PUBLISHED',
         "galleryPostId" = $1,
         "instagramMediaId" = $2,
         "instagramPermalink" = $3,
         "instagramPublishError" = NULL,
         "publishedAt" = NOW(),
         "updatedAt" = NOW()
     WHERE id = $4
     RETURNING *`,
    data.galleryPostId,
    data.instagramMediaId || null,
    data.instagramPermalink || null,
    id,
  );

  return mapDraft(rows[0]);
}

export async function markSocialPostDraftFailed(
  id: string,
  data: {
    galleryPostId: string;
    error: string;
  },
) {
  await ensureSocialPostDraftTable();

  const rows = await prisma.$queryRawUnsafe<any[]>(
    `UPDATE "SocialPostDraft"
     SET status = 'FAILED',
         "galleryPostId" = $1,
         "instagramPublishError" = $2,
         "updatedAt" = NOW()
     WHERE id = $3
     RETURNING *`,
    data.galleryPostId,
    data.error,
    id,
  );

  return mapDraft(rows[0]);
}
