type Attempt = { target: string; status: string; verifiedAt: Date | string | null };

/** 세 장부의 성공과 재조회 증거가 모두 있어야 완료다. */
export function hasVerifiedSyncTargets(attempts: Attempt[]): boolean {
  return attempts.length === 3 && ["SHEET", "RALLYZ", "WEBSITE"].every(target => {
    const matching = attempts.filter(attempt => attempt.target === target);
    return matching.length === 1 && matching[0].status === "SUCCEEDED"
      && matching[0].verifiedAt !== null
      && Number.isFinite(new Date(matching[0].verifiedAt).getTime());
  });
}

type Transaction = {
  $queryRawUnsafe<T>(query: string, ...values: unknown[]): Promise<T>;
  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<number>;
};

/** 기존 동기화 거래 안에서만 실행한다. 불일치·미지원 반 변경은 완료로 만들지 않는다. */
export async function finalizeEnrollmentChangeSync(tx: Transaction, commandId: string) {
  const completed = await tx.$queryRawUnsafe<Array<{ id: string; requestId: string }>>(
    `WITH verified AS (
       SELECT r.id, c."requestId"
         FROM "OperationsCommand" c
         JOIN "OperationsRequest" o ON o.id=c."requestId"
         JOIN "EnrollmentChangeRequest" r ON r.id=c."afterJson"->>'enrollmentChangeRequestId'
         JOIN "Enrollment" e ON e.id=r."enrollmentId"
        WHERE c.id=$1 AND c.status='SYNCED' AND c."holdReason" IS NULL AND o."approvedAt" IS NOT NULL
          AND r.status='APPROVED' AND r."appliedAt" IS NULL
          AND c."idempotencyKey"='enrollment-change:' || r.id
          AND c."studentId"=r."studentId" AND e."studentId"=r."studentId"
          AND c.kind=r.kind AND c.kind IN ('PAUSE','WITHDRAW')
          AND c."afterJson"->>'parentConfirmed'='true'
          AND c."afterJson"->>'effectiveDate'=to_char(r."effectiveFrom",'YYYY-MM-DD')
          AND c."effectiveMonth"=to_char(r."effectiveFrom",'YYYY-MM')
          AND r."effectiveFrom" <= (now() AT TIME ZONE 'Asia/Seoul')::date
          AND c."afterJson"->>'fromClassId'=r."fromClassId"
          AND (c."afterJson"->>'toClassId') IS NOT DISTINCT FROM r."toClassId"
          AND e."classId"=r."fromClassId"
          AND e.status=CASE r.kind WHEN 'PAUSE' THEN 'PAUSED' ELSE 'WITHDRAWN' END
          AND (SELECT count(*) FROM "OperationsSyncAttempt" a WHERE a."commandId"=c.id)=3
          AND (SELECT count(DISTINCT a.target) FROM "OperationsSyncAttempt" a
                WHERE a."commandId"=c.id AND a.target IN ('SHEET','RALLYZ','WEBSITE')
                  AND a.status='SUCCEEDED' AND a."verifiedAt" IS NOT NULL
                  AND a."processingToken" IS NULL AND a."processingStartedAt" IS NULL)=3
        FOR UPDATE OF r, e
     )
     UPDATE "EnrollmentChangeRequest" r SET "appliedAt"=now(),"updatedAt"=now()
       FROM verified v WHERE r.id=v.id AND r."appliedAt" IS NULL
       RETURNING r.id, v."requestId"`, commandId,
  );
  for (const row of completed) {
    // 완료 표시와 감사기록을 하나의 거래로 묶어 어느 한쪽만 남지 않게 한다.
    await tx.$executeRawUnsafe(
      `INSERT INTO "OperationsAuditLog" (id,"requestId",action,"actorType","detailsJson")
       VALUES (gen_random_uuid()::text,$1,'ENROLLMENT_CHANGE_SYNC_COMPLETED','SYSTEM',$2::jsonb)`,
      row.requestId, JSON.stringify({ enrollmentChangeRequestId: row.id, commandId, notificationsSent: false }),
    );
  }
  return completed.length;
}
