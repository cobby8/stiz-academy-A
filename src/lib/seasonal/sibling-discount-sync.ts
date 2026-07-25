import type { Prisma } from "@prisma/client";

import {
  SIBLING_DISCOUNT_PERCENT,
  SIBLING_DISCOUNT_REASON,
  normalizeDiscountPhone,
  resolveSiblingKeys,
  type SiblingCandidate,
} from "./sibling-discount";

/**
 * 형제할인 반영의 단일 진입점.
 *
 * 특강 금액 계산은 공개 신청(service.ts)과 관리자 재배정(api/admin/seasonal/route.ts) 두 곳에 있었다.
 * 한쪽만 고치면 관리자가 반을 재배정하는 순간 할인이 조용히 사라지므로,
 * 두 경로 모두 "항목 금액을 저장한 뒤 이 함수를 부른다"로 통일한다.
 *
 * 이 함수는 항상 `tuitionPriceSnapshot`(할인 전 수강료)에서 다시 계산한다.
 * 이미 저장된 `priceSnapshot`을 입력으로 쓰지 않으므로 몇 번을 실행해도 결과가 같다(멱등).
 */

type RawRow = {
  applicationId: string;
  childName: string;
  childBirth: string | null;
  parentPhone: string;
  studentPhones: string[];
};

const CLOSED_APPLICATION_STATUSES = "'CANCELLED', 'REJECTED'";
const CLOSED_ITEM_STATUSES = "'CANCELLED', 'REJECTED'";

// 신청서의 학생과 같은 사람으로 보이는 원생을 찾아 전화번호를 합집합으로 모은다.
// 생년월일 비교식은 hasMatchingExistingStudent(service.ts)와 동일한 검증된 식을 그대로 쓴다.
// - Student.birthDate 는 timestamp(naive) 라서 UTC 로 해석한 뒤 KST 로 변환한다.
// - SpecialProgramApplication.childBirthDate 는 timestamptz 라서 KST 변환 한 번이면 된다.
const CANDIDATE_SQL = `
  SELECT app.id AS "applicationId",
         app."childName",
         to_char((app."childBirthDate" AT TIME ZONE 'Asia/Seoul')::date, 'YYYY-MM-DD') AS "childBirth",
         regexp_replace(COALESCE(app."parentPhone", ''), '[^0-9]', '', 'g') AS "parentPhone",
         COALESCE((
           SELECT array_agg(DISTINCT matched.phone)
             FROM (
               SELECT regexp_replace(COALESCE(parent.phone, ''), '[^0-9]', '', 'g') AS phone
                 FROM "Student" student
                 JOIN "User" parent ON parent.id = student."parentId"
                WHERE student.name = app."childName"
                  AND ((student."birthDate" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Seoul')::date
                      = (app."childBirthDate" AT TIME ZONE 'Asia/Seoul')::date
               UNION ALL
               SELECT regexp_replace(COALESCE(guardian.phone, ''), '[^0-9]', '', 'g')
                 FROM "Student" student
                 JOIN "Guardian" guardian ON guardian."studentId" = student.id
                WHERE student.name = app."childName"
                  AND ((student."birthDate" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Seoul')::date
                      = (app."childBirthDate" AT TIME ZONE 'Asia/Seoul')::date
             ) matched
            WHERE matched.phone <> ''
         ), ARRAY[]::text[]) AS "studentPhones"
    FROM "SpecialProgramApplication" app
   WHERE app."seasonId" = $1
     AND app.status NOT IN (${CLOSED_APPLICATION_STATUSES})
     AND EXISTS (
       SELECT 1 FROM "SpecialProgramApplicationItem" item
        WHERE item."applicationId" = app.id
          AND item.status NOT IN (${CLOSED_ITEM_STATUSES})
     )
`;

// 할인액은 정수 연산으로 계산한다. (tuition * 10) / 100 은 정수 나눗셈이라 원 단위 절사와 같다.
// JS 쪽 siblingDiscountAmount() 와 반드시 같은 값이 나오도록 맞춘 식이다.
const APPLY_SQL = `
  WITH computed AS (
    SELECT item.id,
           CASE
             WHEN $2 <> '' AND item."applicationId" = ANY(string_to_array($2, ','))
               THEN (item."tuitionPriceSnapshot" * ${SIBLING_DISCOUNT_PERCENT}) / 100
             ELSE 0
           END AS discount
      FROM "SpecialProgramApplicationItem" item
      JOIN "SpecialProgramApplication" app ON app.id = item."applicationId"
     WHERE app."seasonId" = $1
       AND item.status NOT IN (${CLOSED_ITEM_STATUSES})
       -- 이미 수강 등록·청구서로 넘어간 항목은 확정 금액이므로 절대 건드리지 않는다.
       AND item."enrollmentId" IS NULL
       AND item."paymentId" IS NULL
  )
  UPDATE "SpecialProgramApplicationItem" item
     SET "siblingDiscountSnapshot" = computed.discount,
         "discountReasonSnapshot" = CASE WHEN computed.discount > 0 THEN $3 ELSE NULL END,
         "priceSnapshot" = item."tuitionPriceSnapshot" - computed.discount + item."shuttleFeeSnapshot",
         "updatedAt" = NOW()
    FROM computed
   WHERE item.id = computed.id
     -- 값이 이미 맞으면 아무 행도 건드리지 않는다. 재실행해도 updatedAt 조차 흔들리지 않게 하는 멱등 가드.
     AND (item."siblingDiscountSnapshot" <> computed.discount
          OR item."priceSnapshot" <> item."tuitionPriceSnapshot" - computed.discount + item."shuttleFeeSnapshot")
  RETURNING item.id AS "itemId", item."applicationId"
`;

// 금액이 바뀐 신청서만 합계를 다시 맞춘다. 손대지 않은 신청서 금액은 그대로 둔다.
const REFRESH_TOTAL_SQL = `
  UPDATE "SpecialProgramApplication" app
     SET "totalPriceSnapshot" = totals.sum_price
    FROM (
      SELECT target.id, COALESCE(SUM(item."priceSnapshot"), 0)::int AS sum_price
        FROM "SpecialProgramApplication" target
        LEFT JOIN "SpecialProgramApplicationItem" item ON item."applicationId" = target.id
       WHERE target.id = ANY(string_to_array($1, ','))
       GROUP BY target.id
    ) totals
   WHERE app.id = totals.id
     AND app."totalPriceSnapshot" <> totals.sum_price
`;

/** 신청서 한 건을 형제 판정용 후보로 바꾼다. 신청서 보호자 번호와 원생 번호를 합집합으로 모은다. */
function toCandidate(row: RawRow): SiblingCandidate {
  const phones = new Set<string>();
  const parentPhone = normalizeDiscountPhone(row.parentPhone);
  if (parentPhone) phones.add(parentPhone);
  for (const phone of row.studentPhones ?? []) {
    const normalized = normalizeDiscountPhone(phone);
    if (normalized) phones.add(normalized);
  }
  return {
    key: row.applicationId,
    childName: row.childName,
    childBirth: row.childBirth,
    phones: [...phones],
  };
}

/** 이번 시즌에서 형제로 묶이는 신청 후보와 판정 결과를 읽기 전용으로 계산한다(DB 변경 없음). */
export async function loadSeasonSiblingPlan(db: Prisma.TransactionClient, seasonId: string) {
  const rows = await db.$queryRawUnsafe<RawRow[]>(CANDIDATE_SQL, seasonId);
  const candidates = rows.map(toCandidate);
  const siblingKeys = resolveSiblingKeys(candidates);
  return { candidates, siblingKeys };
}

/**
 * 시즌 전체의 형제할인을 다시 계산해 저장한다.
 * 항목 금액을 바꾸는 모든 경로(공개 신청, 관리자 반 재배정, 관리자 항목 추가) 뒤에 호출한다.
 */
export async function syncSeasonSiblingDiscounts(db: Prisma.TransactionClient, seasonId: string) {
  const { candidates, siblingKeys } = await loadSeasonSiblingPlan(db, seasonId);
  const siblingApplicationIds = candidates
    .map((candidate) => candidate.key)
    .filter((key) => siblingKeys.has(key));

  const updated = await db.$queryRawUnsafe<Array<{ itemId: string; applicationId: string }>>(
    APPLY_SQL,
    seasonId,
    siblingApplicationIds.join(","),
    SIBLING_DISCOUNT_REASON,
  );

  const touchedApplicationIds = [...new Set(updated.map((row) => row.applicationId))];
  if (touchedApplicationIds.length > 0) {
    await db.$executeRawUnsafe(REFRESH_TOTAL_SQL, touchedApplicationIds.join(","));
  }
  return {
    siblingApplicationIds,
    updatedItemIds: updated.map((row) => row.itemId),
    touchedApplicationIds,
  };
}
