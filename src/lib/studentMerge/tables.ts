// 학생 ID를 들고 있는 모든 컬럼 목록 (2026-07-26 DB 실측 기준, 총 28곳).
// 왜 손으로 적어 두는가: FK가 걸린 곳은 13곳뿐이고 나머지 15곳은 FK 없이 문자열로만 물려 있다.
// FK만 따라가면 그 15곳이 그대로 남아 "지워진 학생 ID를 가리키는 유령 행"이 된다.

export type StudentRefTable = {
  table: string;
  column: string;
  /**
   * studentId를 포함한 UNIQUE 제약의 나머지 컬럼들.
   * 여기 값이 있으면 그냥 UPDATE 할 수 없다(같은 조합이 대표 쪽에 이미 있으면 충돌).
   */
  conflictKeys?: string[];
  /** Payment의 연월 동결 규칙을 그대로 따라야 하는 청구 계열 테이블 */
  billingScoped?: boolean;
  /**
   * Payment(id, classId, studentId, amount) 복합 FK가 ON UPDATE CASCADE라
   * Payment를 옮기면 자동으로 따라온다. 직접 UPDATE 하면 오히려 FK가 깨진다.
   */
  cascadesFromPayment?: boolean;
  /** 이 모듈이 직접 처리하지 않고 별도 로직으로 다루는 테이블 */
  handledSeparately?: boolean;
};

export const STUDENT_REF_TABLES: StudentRefTable[] = [
  // --- FK 있음 ---
  { table: "Attendance", column: "studentId", conflictKeys: ["sessionId"] },
  { table: "Enrollment", column: "studentId", conflictKeys: ["classId"], handledSeparately: true },
  { table: "Guardian", column: "studentId" },
  { table: "Payment", column: "studentId", billingScoped: true, handledSeparately: true },
  {
    table: "ShuttleRoutePassenger",
    column: "studentId",
    conflictKeys: ["routePlanId", "sessionId", "locationKind"],
  },
  {
    table: "StaffPaymentConfirmationRequest",
    column: "studentId",
    billingScoped: true,
    cascadesFromPayment: true,
  },
  { table: "StudentMediaConsent", column: "studentId" },
  { table: "StudentRegistrationLedger", column: "studentId" },
  { table: "StudentSessionNote", column: "studentId", conflictKeys: ["sessionId"] },
  { table: "StudentSheetRawRow", column: "studentId" },
  { table: "StudentShuttleLocation", column: "studentId", conflictKeys: ["kind"] },
  { table: "StudentShuttleRide", column: "studentId" },
  { table: "StudentTeamRosterEntry", column: "studentId" },

  // --- FK 없음 (빠뜨리면 유령 ID가 남는 자리) ---
  { table: "EnrollmentApplication", column: "convertedStudentId" },
  { table: "Feedback", column: "studentId" },
  { table: "MakeupSession", column: "studentId" },
  { table: "MediaRevocationJob", column: "studentId" },
  { table: "NotificationDelivery", column: "studentId" },
  { table: "ParentRequest", column: "studentId" },
  { table: "PaymentInvoice", column: "studentId", billingScoped: true, handledSeparately: true },
  { table: "PaymentTransaction", column: "studentId", billingScoped: true, handledSeparately: true },
  { table: "SkillRecord", column: "studentId" },
  { table: "SpecialProgramApplication", column: "convertedStudentId" },
  { table: "SpecialProgramEnrollmentDate", column: "studentId" },
  { table: "SpecialProgramMakeup", column: "studentId" },
  { table: "TrialLead", column: "convertedStudentId" },
  { table: "Waitlist", column: "studentId", conflictKeys: ["classId"] },
];

/**
 * `SocialPostDraft.subjectStudentIdsJSON`은 학생 ID를 JSON 배열 문자열로 들고 있다.
 * 컬럼 UPDATE로는 못 고치므로 문자열 치환이 필요하다.
 * 2026-07-26 실측 기준 대상 16명에 대한 참조는 0건이라 이번 병합에서는 건드릴 것이 없다.
 */
export const JSON_STUDENT_REF = {
  table: "SocialPostDraft",
  column: "subjectStudentIdsJSON",
} as const;

/** 병합 엔진이 자동으로 훑는 테이블 (개별 로직으로 따로 처리하는 것 제외) */
export function autoMovableTables(): StudentRefTable[] {
  return STUDENT_REF_TABLES.filter((t) => !t.handledSeparately && !t.cascadesFromPayment);
}
