export type RegistrationCheck = {
  key: string;
  label: string;
  status: "VERIFIED" | "CHECK_REQUIRED";
  detail: string;
};

export type RegistrationEvidence = {
  studentId: string | null;
  assignedClassIds: string[];
  activeClassIds: string[];
  shuttleNeeded: boolean;
  commands: Array<{ status: string; syncAttempts: Array<{ target: string; status: string; verifiedAt: Date | null }> }>;
  invoiceCandidates: number;
};

// 승인 상태와 등록 절차 완료는 다릅니다. 서로 연결되지 않은 기록을 완료 증거로 승격하지 않습니다.
export function registrationReadiness(input: RegistrationEvidence) {
  const siteReady = Boolean(input.studentId) && input.assignedClassIds.length > 0
    && input.assignedClassIds.every((id) => input.activeClassIds.includes(id));
  const checks: RegistrationCheck[] = [{ key: "site", label: "사이트 반 배정", status: siteReady ? "VERIFIED" : "CHECK_REQUIRED", detail: siteReady ? "학생 ID와 배정된 모든 반의 ACTIVE 수강 확인" : "학생 연결과 배정 반의 현재 수강 상태 확인 필요" }];
  for (const target of ["SHEET", "RALLYZ"] as const) {
    const verified = input.commands.filter((command) => command.syncAttempts.some((attempt) => attempt.target === target && attempt.status === "SUCCEEDED" && attempt.verifiedAt)).length;
    checks.push({ key: target, label: target === "SHEET" ? "시트 등록·재조회" : "Rallyz 등록·재조회", status: "CHECK_REQUIRED", detail: `학생의 CLASS_ADD 원장 ${input.commands.length}건 중 재조회 기록 ${verified}건. 해당 신청·반·적용월과 연결 확인 필요` });
  }
  for (const [key, label, detail] of [
    ["invoice", "최초 청구서", `유효 청구 후보 ${input.invoiceCandidates}건. 최초 적용기간·반·일할계산·금액 대조 필요`],
    ["invoice-notification", "최초 청구 안내", "정확한 청구서와 연결된 발송 결과 확인 필요"],
    ["rallyz-invite", "Rallyz 보호자 초대·연결", "사이트 보호자 연결만으로 Rallyz 연결을 완료 처리하지 않음"],
    ["uniform", "유니폼·제품 안내", "홈페이지 /shop 안내 전달 및 유니폼 신청 여부 확인 필요"],
    ["teacher", "담당 선생님·연간일정 안내", "최종 배정 반의 담당자 및 연간일정 안내 전달 확인 필요"],
  ]) checks.push({ key, label, detail, status: "CHECK_REQUIRED" });
  if (input.shuttleNeeded) checks.push({ key: "shuttle", label: "셔틀 배차·기사님 안내", detail: "승하차 장소·확정 시간·배정 기사 안내 전달 확인 필요", status: "CHECK_REQUIRED" });
  return { complete: checks.every((check) => check.status === "VERIFIED"), checks };
}
