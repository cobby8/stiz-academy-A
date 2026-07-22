-- 동일 학생·보호자가 같은 특강에 활성 신청을 둘 이상 만들지 못하도록 식별 지문을 저장한다.
ALTER TABLE "SpecialProgramApplicationItem"
ADD COLUMN "applicantFingerprint" TEXT;

-- 기존 데이터는 같은 활성 신청이 이미 여러 개일 수 있으므로, 각 조합의 첫 항목에만 지문을 채운다.
-- 이 대표 항목이 이후의 모든 신규 중복 신청과 충돌해 기존 데이터도 보호한다.
-- 기존 활성 신청은 중복 여부와 관계없이 모두 지문을 채워 이후 신규 중복을 차단한다.
WITH ranked_active_items AS (
  SELECT item.id,
         encode(
           sha256(
             convert_to(
               lower(regexp_replace(application."childName", '\s+', '', 'g'))
               || '|' || to_char(application."childBirthDate" AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD')
               || '|' || regexp_replace(application."parentPhone", '[^0-9]', '', 'g'),
               'UTF8'
             )
           ),
           'hex'
         ) AS fingerprint,
         item.status
    FROM "SpecialProgramApplicationItem" item
    JOIN "SpecialProgramApplication" application ON application.id = item."applicationId"
   WHERE item.status IN ('PENDING', 'APPROVED', 'WAITLISTED')
)
UPDATE "SpecialProgramApplicationItem" item
   SET "applicantFingerprint" = ranked.fingerprint
  FROM ranked_active_items ranked
 WHERE item.id = ranked.id
   AND ranked.status IN ('PENDING', 'APPROVED', 'WAITLISTED');

CREATE INDEX "SpecialProgramApplicationItem_offeringId_applicantFinger_idx"
ON "SpecialProgramApplicationItem"("offeringId", "applicantFingerprint");

-- 부분 고유 인덱스는 취소·반려된 항목을 제외해, 종료 후에는 같은 특강에 다시 신청할 수 있게 한다.
-- 신규 동시 요청은 서비스가 같은 offering 행을 FOR UPDATE로 잠가 직렬 처리한다.
-- 기존 중복을 임의 취소하지 않기 위해 고유 인덱스는 만들지 않는다.
