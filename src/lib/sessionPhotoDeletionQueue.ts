import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidQueuedSessionPhotoRef, sessionPhotoDeletionRetrySeconds } from "@/lib/sessionPhotoManagementPolicy";

let tableEnsured = false;

export async function ensureSessionPhotoDeletionQueue() {
  if (tableEnsured) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "SessionPhotoDeletionJob" (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "photoId" TEXT NOT NULL UNIQUE,
      "storageBucket" TEXT NOT NULL,
      "storagePath" TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      attempts INTEGER NOT NULL DEFAULT 0,
      "nextAttemptAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "lockedAt" TIMESTAMPTZ,
      "lastError" TEXT,
      "deletedAt" TIMESTAMPTZ,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      ,CONSTRAINT "SessionPhotoDeletionJob_status_check_runtime"
        CHECK (status IN ('RESERVED', 'PENDING', 'PROCESSING', 'FAILED', 'DELETED'))
    )
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "SessionPhotoDeletionJob_queue_idx" ON "SessionPhotoDeletionJob" (status, "nextAttemptAt")`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "SessionPhotoDeletionJob" ENABLE ROW LEVEL SECURITY`);
  await prisma.$executeRawUnsafe(`REVOKE ALL ON TABLE "SessionPhotoDeletionJob" FROM anon, authenticated`);
  tableEnsured = true;
}

export async function enqueueSessionPhotoDeletion(
  tx: Prisma.TransactionClient,
  input: { photoId: string; storageBucket: string; storagePath: string },
) {
  await tx.$executeRawUnsafe(`
    INSERT INTO "SessionPhotoDeletionJob" (
      id, "photoId", "storageBucket", "storagePath", status, attempts,
      "nextAttemptAt", "createdAt", "updatedAt"
    ) VALUES (gen_random_uuid()::text, $1, $2, $3, 'PENDING', 0, NOW(), NOW(), NOW())
    ON CONFLICT ("photoId") DO NOTHING
  `, input.photoId, input.storageBucket, input.storagePath);
}

/** Upload 직후 cleanup 의도를 먼저 영구 기록해 DB 저장 실패나 프로세스 중단에도 파일이 남지 않게 한다. */
export async function reserveSessionPhotoCleanup(input: {
  photoId: string; storageBucket: string; storagePath: string;
}) {
  await ensureSessionPhotoDeletionQueue();
  await prisma.$executeRawUnsafe(`
    INSERT INTO "SessionPhotoDeletionJob" (
      id, "photoId", "storageBucket", "storagePath", status, attempts,
      "nextAttemptAt", "lockedAt", "createdAt", "updatedAt"
    ) VALUES (gen_random_uuid()::text, $1, $2, $3, 'RESERVED', 0, NOW(), date_trunc('milliseconds', NOW()), NOW(), NOW())
    ON CONFLICT ("photoId") DO UPDATE SET
      "storageBucket" = EXCLUDED."storageBucket", "storagePath" = EXCLUDED."storagePath",
      status = 'RESERVED', attempts = 0, "nextAttemptAt" = NOW(), "lockedAt" = date_trunc('milliseconds', NOW()),
      "lastError" = NULL, "deletedAt" = NULL, "updatedAt" = NOW()
  `, input.photoId, input.storageBucket, input.storagePath);
}

/** Session과 초안 저장이 성공한 트랜잭션 안에서만 임시 cleanup 예약을 취소한다. */
export async function cancelSessionPhotoCleanup(tx: Prisma.TransactionClient, photoId: string) {
  const deleted = await tx.$executeRawUnsafe(
    `DELETE FROM "SessionPhotoDeletionJob" WHERE "photoId" = $1 AND status = 'RESERVED'`,
    photoId,
  );
  if (deleted !== 1) throw new Error("사진 cleanup 예약 상태가 변경되어 업로드를 확정할 수 없습니다.");
}

export async function releaseSessionPhotoCleanup(photoId: string) {
  await prisma.$executeRawUnsafe(`
    UPDATE "SessionPhotoDeletionJob" SET status = 'PENDING', "lockedAt" = NULL,
      "nextAttemptAt" = NOW(), "updatedAt" = NOW()
     WHERE "photoId" = $1 AND status = 'RESERVED'
  `, photoId);
}

export async function processSessionPhotoDeletionQueue(limit = 5) {
  await ensureSessionPhotoDeletionQueue();
  let processed = 0;
  for (let index = 0; index < Math.max(1, Math.min(limit, 20)); index += 1) {
    const rows = await prisma.$queryRawUnsafe<Array<{
      id: string; storageBucket: string; storagePath: string; attempts: number; lockedAt: Date;
    }>>(`
      WITH candidate AS (
        SELECT id FROM "SessionPhotoDeletionJob"
         WHERE ((status IN ('PENDING', 'FAILED') AND "nextAttemptAt" <= NOW())
            OR (status = 'RESERVED' AND "lockedAt" < NOW() - INTERVAL '5 minutes')
            OR (status = 'PROCESSING' AND "lockedAt" < NOW() - INTERVAL '5 minutes'))
         ORDER BY "nextAttemptAt", "createdAt"
         FOR UPDATE SKIP LOCKED LIMIT 1
      )
      UPDATE "SessionPhotoDeletionJob" j
         SET status = 'PROCESSING', attempts = attempts + 1, "lockedAt" = date_trunc('milliseconds', NOW()), "updatedAt" = NOW()
        FROM candidate c WHERE j.id = c.id
      RETURNING j.id, j."storageBucket", j."storagePath", j.attempts, j."lockedAt"
    `);
    const job = rows[0];
    if (!job) break;
    processed += 1;
    if (!isValidQueuedSessionPhotoRef(job.storageBucket, job.storagePath)) {
      await prisma.$executeRawUnsafe(`
        UPDATE "SessionPhotoDeletionJob" SET status = 'FAILED', "lockedAt" = NULL,
          "lastError" = 'INVALID_REFERENCE: bucket or storage path rejected',
          "nextAttemptAt" = 'infinity'::timestamptz, "updatedAt" = NOW()
        WHERE id = $1 AND status = 'PROCESSING' AND "lockedAt" = $2
      `, job.id, job.lockedAt);
      continue;
    }
    const { error } = await createAdminClient().storage.from(job.storageBucket).remove([job.storagePath]);
    if (!error) {
      await prisma.$executeRawUnsafe(`
        UPDATE "SessionPhotoDeletionJob" SET status = 'DELETED', "deletedAt" = NOW(),
          "lockedAt" = NULL, "lastError" = NULL, "updatedAt" = NOW()
        WHERE id = $1 AND status = 'PROCESSING' AND "lockedAt" = $2
      `, job.id, job.lockedAt);
      continue;
    }
    const delaySeconds = sessionPhotoDeletionRetrySeconds(job.attempts);
    await prisma.$executeRawUnsafe(`
      UPDATE "SessionPhotoDeletionJob" SET status = 'FAILED', "lockedAt" = NULL,
        "lastError" = $2, "nextAttemptAt" = NOW() + ($3 * INTERVAL '1 second'), "updatedAt" = NOW()
       WHERE id = $1 AND status = 'PROCESSING' AND "lockedAt" = $4
    `, job.id, error.message.slice(0, 1000), delaySeconds, job.lockedAt);
  }
  return { processed };
}
