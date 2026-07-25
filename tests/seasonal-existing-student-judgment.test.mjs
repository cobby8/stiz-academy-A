import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const service = await readFile(new URL("../src/lib/seasonal/service.ts", import.meta.url), "utf8");

// hasMatchingExistingStudent()의 SQL 본문만 잘라낸다.
const judgmentSql = service.slice(
  service.indexOf("async function hasMatchingExistingStudent"),
  service.indexOf("function applicationResponse"),
);

test("기존회원 판정은 현재 재원 중(ACTIVE)인 학생만 인정한다", () => {
  // 휴원(PAUSED)·퇴원(WITHDRAWN)·과거 이력자가 할인을 받지 못하게 막는 핵심 조건.
  assert.match(judgmentSql, /EXISTS\s*\(\s*SELECT 1\s+FROM "Enrollment" enrollment/);
  assert.match(judgmentSql, /enrollment\."studentId" = student\.id/);
  assert.match(judgmentSql, /enrollment\.status = 'ACTIVE'/);
});

test("기존회원 판정에서 휴원·퇴원 상태를 인정하지 않는다", () => {
  // 주석에는 PAUSED/WITHDRAWN이 설명으로 등장하므로, 실제 SQL 조건절만 골라서 검사한다.
  const statusConditions = judgmentSql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .match(/enrollment\.status\s*(?:=|IN)\s*[^\n]+/g) ?? [];

  assert.equal(statusConditions.length, 1, "재원 상태 조건은 정확히 하나여야 한다");
  assert.match(statusConditions[0], /=\s*'ACTIVE'/);
  assert.doesNotMatch(statusConditions[0], /PAUSED|WITHDRAWN/);
});

test("특강 전용 반 등록은 정규반 수강으로 치지 않는다", () => {
  // 승인 전환이 특강 반에도 ACTIVE Enrollment를 만들기 때문에 걸러내야 한다.
  assert.match(judgmentSql, /JOIN "Class" class ON class\.id = enrollment\."classId"/);
  assert.match(judgmentSql, /class\."dayOfWeek" = 'Seasonal'/);
  assert.match(judgmentSql, /SELECT 1 FROM "SpecialProgramOffering" offering/);
  assert.match(judgmentSql, /offering\."linkedClassId" = class\.id/);
});

test("특강 제외 조건은 반드시 두 조건을 함께 만족할 때만 적용한다", () => {
  // 연결 반은 정규반일 수도 있다("연결 정규 반 ID" 입력).
  // "연결됨"만으로 제외하면 그 정규반 원생 전원이 할인을 잃는 치명적 부작용이 생긴다.
  const excludeClause = judgmentSql.slice(judgmentSql.indexOf("AND NOT ("));
  assert.match(excludeClause, /class\."dayOfWeek" = 'Seasonal'\s*\n\s*AND EXISTS/);
  // linkedClassId 조건이 단독으로 제외 근거가 되어서는 안 된다.
  assert.doesNotMatch(
    judgmentSql,
    /AND NOT EXISTS \(\s*SELECT 1 FROM "SpecialProgramOffering"/,
    "연결 여부만으로 제외하면 정규반 원생이 할인을 잃는다",
  );
});

test("생년월일 2단계 시간대 변환식을 단순화하지 않는다", () => {
  // "Student"."birthDate"는 timestamp(naive) 컬럼이다.
  // 첫 AT TIME ZONE 'UTC'가 naive→UTC 순간 "해석", 두 번째가 KST "변환"이다.
  // 실측상 이 식이 295건 중 293건 정확하고, naive 날짜부분을 그대로 쓰면 149건만 맞는다.
  assert.match(
    judgmentSql,
    /\(\(student\."birthDate" AT TIME ZONE 'UTC'\) AT TIME ZONE 'Asia\/Seoul'\)::date/,
  );
  // 날짜 부분을 그대로 쓰는 잘못된 "수정"이 다시 들어오는 것을 막는다.
  assert.doesNotMatch(judgmentSql, /student\."birthDate"::date/);
});

test("이름·생년월일·연락처 조건이 모두 유지된다", () => {
  assert.match(judgmentSql, /student\.name = \$\{input\.child\.name\}/);
  assert.match(judgmentSql, /regexp_replace\(COALESCE\(parent\.phone, ''\), '\[\^0-9\]', '', 'g'\)/);
  assert.match(judgmentSql, /regexp_replace\(COALESCE\(guardian\.phone, ''\), '\[\^0-9\]', '', 'g'\)/);
});

test("PgBouncer 대응을 위해 $queryRaw 계열을 계속 사용한다", () => {
  assert.match(judgmentSql, /prisma\.\$queryRaw/);
});

// --- 판정 규칙 참조 모델 --------------------------------------------------
// SQL과 동일한 의미를 JS로 옮겨, 재원 상태·생년월일 저장 형식별 결과를 고정한다.

/** naive timestamp 문자열을 SQL과 같은 방식(UTC 해석 → KST 변환)으로 날짜만 뽑는다. */
function studentBirthDateInSeoul(naiveTimestamp) {
  const asUtcInstant = new Date(`${naiveTimestamp.replace(" ", "T")}Z`);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(asUtcInstant);
}

/** 신청서의 childBirthDate(timestamptz)를 KST 날짜로 바꾼다. */
function applicantBirthDateInSeoul(isoInstant) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(isoInstant));
}

/**
 * 등록 목록을 SQL과 같은 방식으로 평가한다.
 * `{ status, seasonalOnlyClass }` 형태이며, 편의를 위해 문자열은 정규반 등록으로 본다.
 */
function hasActiveRegularEnrollment(enrollments = []) {
  return enrollments
    .map((entry) => (typeof entry === "string" ? { status: entry, seasonalOnlyClass: false } : entry))
    .some((entry) => entry.status === "ACTIVE" && !entry.seasonalOnlyClass);
}

function judgeExistingStudent(applicant, students) {
  return students.some((student) =>
    student.name === applicant.name
    && studentBirthDateInSeoul(student.birthDate) === applicantBirthDateInSeoul(applicant.birthDate)
    && (student.parentPhone === applicant.parentPhone || (student.guardianPhones ?? []).includes(applicant.parentPhone))
    // 현재 정규반에 재원 중인 등록이 최소 한 건 있어야 한다.
    && hasActiveRegularEnrollment(student.enrollmentStatuses),
  );
}

test("생년월일 저장 형식이 UTC 자정이든 KST 자정이든 같은 날짜로 판정된다", () => {
  // 김대후: 시트 원본 2015-12-02, DB는 UTC 자정 형식으로 저장됨.
  assert.equal(studentBirthDateInSeoul("2015-12-02 00:00:00"), "2015-12-02");
  // 이한나: 시트 원본 2016-12-13, DB는 KST 자정 형식(전날 15:00)으로 저장됨.
  assert.equal(studentBirthDateInSeoul("2016-12-12 15:00:00"), "2016-12-13");
  // 전서호: 시트 원본 2016-03-07, KST 자정 형식.
  assert.equal(studentBirthDateInSeoul("2016-03-06 15:00:00"), "2016-03-07");
});

test("두 저장 형식 모두 실제 신청서와 매칭된다", () => {
  const utcMidnightStudent = {
    name: "김대후",
    birthDate: "2015-12-02 00:00:00",
    parentPhone: "01049134275",
    enrollmentStatuses: ["ACTIVE"],
  };
  const kstMidnightStudent = {
    name: "이한나",
    birthDate: "2016-12-12 15:00:00",
    parentPhone: "01047838923",
    enrollmentStatuses: ["ACTIVE"],
  };

  assert.equal(
    judgeExistingStudent(
      { name: "김대후", birthDate: "2015-12-01T15:00:00Z", parentPhone: "01049134275" },
      [utcMidnightStudent],
    ),
    true,
  );
  assert.equal(
    judgeExistingStudent(
      { name: "이한나", birthDate: "2016-12-12T15:00:00Z", parentPhone: "01047838923" },
      [kstMidnightStudent],
    ),
    true,
  );
});

test("재원 상태에 따라 기존회원 판정이 갈린다", () => {
  const applicant = { name: "홍길동", birthDate: "2015-05-04T15:00:00Z", parentPhone: "01012345678" };
  const base = { name: "홍길동", birthDate: "2015-05-05 00:00:00", parentPhone: "01012345678" };

  const cases = [
    { label: "재원 중", enrollmentStatuses: ["ACTIVE"], expected: true },
    { label: "휴원", enrollmentStatuses: ["PAUSED"], expected: false },
    { label: "퇴원", enrollmentStatuses: ["WITHDRAWN"], expected: false },
    { label: "등록 없음", enrollmentStatuses: [], expected: false },
    // 반 이동 시 예전 반이 PAUSED로 남는다. ACTIVE가 한 건이라도 있으면 재원 중이다.
    { label: "반 이동(ACTIVE+PAUSED)", enrollmentStatuses: ["ACTIVE", "PAUSED"], expected: true },
    { label: "재등록(WITHDRAWN+ACTIVE)", enrollmentStatuses: ["WITHDRAWN", "ACTIVE"], expected: true },
  ];

  for (const scenario of cases) {
    assert.equal(
      judgeExistingStudent(applicant, [{ ...base, enrollmentStatuses: scenario.enrollmentStatuses }]),
      scenario.expected,
      `${scenario.label} 판정이 기대와 다르다`,
    );
  }
});

test("특강 등록만 있는 학생은 기존회원이 아니고, 정규반 등록이 있으면 기존회원이다", () => {
  const applicant = { name: "홍길동", birthDate: "2015-05-04T15:00:00Z", parentPhone: "01012345678" };
  const base = { name: "홍길동", birthDate: "2015-05-05 00:00:00", parentPhone: "01012345678" };

  const seasonal = { status: "ACTIVE", seasonalOnlyClass: true };
  const regular = { status: "ACTIVE", seasonalOnlyClass: false };

  const cases = [
    { label: "특강 등록만 있음", enrollments: [seasonal], expected: false },
    { label: "정규반 등록만 있음", enrollments: [regular], expected: true },
    { label: "특강 + 정규반 둘 다 있음", enrollments: [seasonal, regular], expected: true },
    // 특강 등록이 여러 건이어도 정규반이 없으면 여전히 신규다.
    { label: "특강 등록 여러 건", enrollments: [seasonal, seasonal], expected: false },
    // 정규반을 특강에 연결한 경우, 그 반은 실제 요일을 가지므로 정규반으로 남는다.
    { label: "특강에 연결된 정규반", enrollments: [regular], expected: true },
  ];

  for (const scenario of cases) {
    assert.equal(
      judgeExistingStudent(applicant, [{ ...base, enrollmentStatuses: scenario.enrollments }]),
      scenario.expected,
      `${scenario.label} 판정이 기대와 다르다`,
    );
  }
});

test("휴원 상태의 정규반 등록은 특강 여부와 무관하게 기존회원이 아니다", () => {
  const applicant = { name: "홍길동", birthDate: "2015-05-04T15:00:00Z", parentPhone: "01012345678" };
  const base = { name: "홍길동", birthDate: "2015-05-05 00:00:00", parentPhone: "01012345678" };

  assert.equal(
    judgeExistingStudent(applicant, [{
      ...base,
      enrollmentStatuses: [{ status: "PAUSED", seasonalOnlyClass: false }, { status: "ACTIVE", seasonalOnlyClass: true }],
    }]),
    false,
  );
});

test("연락처는 학부모 계정 또는 Guardian 중 하나만 맞아도 인정한다", () => {
  const applicant = { name: "홍길동", birthDate: "2015-05-04T15:00:00Z", parentPhone: "01099998888" };
  const viaGuardian = {
    name: "홍길동",
    birthDate: "2015-05-05 00:00:00",
    parentPhone: "01011112222",
    guardianPhones: ["01099998888"],
    enrollmentStatuses: ["ACTIVE"],
  };
  assert.equal(judgeExistingStudent(applicant, [viaGuardian]), true);

  // 연락처가 어디에도 없으면 재원 중이어도 매칭되지 않는다.
  assert.equal(
    judgeExistingStudent(applicant, [{ ...viaGuardian, guardianPhones: [] }]),
    false,
  );
});

test("생년월일이나 이름이 다르면 재원 중이어도 매칭되지 않는다", () => {
  const applicant = { name: "홍길동", birthDate: "2015-05-04T15:00:00Z", parentPhone: "01012345678" };
  const base = {
    name: "홍길동",
    birthDate: "2015-05-05 00:00:00",
    parentPhone: "01012345678",
    enrollmentStatuses: ["ACTIVE"],
  };

  assert.equal(judgeExistingStudent(applicant, [{ ...base, name: "홍길순" }]), false);
  assert.equal(judgeExistingStudent(applicant, [{ ...base, birthDate: "2015-09-17 00:00:00" }]), false);
});
