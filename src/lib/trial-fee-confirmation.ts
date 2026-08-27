export type TrialFeeConfirmationResult = {
    found: boolean;
    changed: boolean;
    alreadyConfirmed: boolean;
};

type TrialFeeConfirmationDb = {
    $queryRawUnsafe<T>(query: string, ...values: unknown[]): Promise<T>;
};

type TrialFeeConfirmationTransactionDb = {
    $transaction<T>(callback: (tx: TrialFeeConfirmationDb & {
        $executeRawUnsafe(query: string, ...values: unknown[]): Promise<number>;
    }) => Promise<T>): Promise<T>;
};

export type TrialFeeAuditActor = {
    userId: string | null;
    userName: string | null;
};

/**
 * 체험비 확인은 false→true 한 번만 성공하도록 DB 조건부 갱신으로 처리한다.
 * 동시에 여러 요청이 들어와도 RETURNING을 받은 한 요청만 changed=true가 된다.
 */
export async function confirmTrialFeeOnce(
    db: TrialFeeConfirmationDb,
    trialLeadId: string,
): Promise<TrialFeeConfirmationResult> {
    const changedRows = await db.$queryRawUnsafe<Array<{ id: string }>>(
        `UPDATE "TrialLead"
         SET "trialFeeConfirmed" = true,
             "updatedAt" = NOW()
         WHERE id = $1
           AND COALESCE("trialFeeConfirmed", false) = false
         RETURNING id`,
        trialLeadId,
    );

    if (changedRows.length > 0) {
        return { found: true, changed: true, alreadyConfirmed: false };
    }

    // 갱신되지 않았다면 이미 확인된 행인지, 존재하지 않는 행인지 구분한다.
    const existingRows = await db.$queryRawUnsafe<Array<{ trialFeeConfirmed: boolean | null }>>(
        `SELECT "trialFeeConfirmed"
         FROM "TrialLead"
         WHERE id = $1
         LIMIT 1`,
        trialLeadId,
    );
    if (existingRows.length === 0) {
        return { found: false, changed: false, alreadyConfirmed: false };
    }

    return {
        found: true,
        changed: false,
        alreadyConfirmed: Boolean(existingRows[0].trialFeeConfirmed),
    };
}

/** 입금 확인과 감사 이력을 같은 트랜잭션에 묶어 반쪽 저장을 방지한다. */
export async function confirmTrialFeeWithAudit(
    db: TrialFeeConfirmationTransactionDb,
    trialLeadId: string,
    actor: TrialFeeAuditActor,
): Promise<TrialFeeConfirmationResult> {
    return db.$transaction(async (tx) => {
        const result = await confirmTrialFeeOnce(tx, trialLeadId);
        if (!result.changed) return result;

        await tx.$executeRawUnsafe(
            `INSERT INTO "ApplicationContactLog" (
                id, "targetType", "trialLeadId", "enrollmentApplicationId", action, note,
                "createdByUserId", "createdByName", "createdAt", "updatedAt"
            ) VALUES (
                gen_random_uuid()::text, 'TRIAL', $1, NULL, 'UPDATED',
                '체험비 입금 확인', $2, $3, NOW(), NOW()
            )`,
            trialLeadId,
            actor.userId,
            actor.userName,
        );
        return result;
    });
}
