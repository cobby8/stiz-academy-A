export type StaffBillingOwnership = {
  paymentClassId: string | null | undefined;
  accessibleClassIds: readonly string[];
};

/**
 * 청구서에 수업 ID가 명시되고 그 수업이 교사의 담당 범위일 때만 노출합니다.
 * 학생이 담당 수업을 듣는다는 사실만으로는 다른 수업·물품 청구의 소유권을 증명할 수 없습니다.
 */
export function canExposeStaffBilling({
  paymentClassId,
  accessibleClassIds,
}: StaffBillingOwnership) {
  if (!paymentClassId) return false;
  return accessibleClassIds.includes(paymentClassId);
}

export type StaffBillingGuardInput = {
  /** Payment에 실제로 저장된 반 ID. 과거 데이터는 비어 있을 수 있습니다. */
  paymentClassId: string | null | undefined;
  /** 청구서 금액과 결제 금액이 어긋난 상태 */
  amountMismatch: boolean;
  /** 청구서 학생과 결제 학생이 어긋난 상태 */
  studentMismatch: boolean;
};

export type StaffBillingGuard = {
  confirmable: boolean;
  blockReason: string | null;
};

/**
 * 교사가 "납부 확인 요청"을 눌러도 되는지 한 곳에서 판정합니다.
 *
 * 화면(버튼 비활성화)과 서버 액션(실제 차단)이 같은 함수를 쓰기 때문에
 * "버튼은 눌리는데 서버가 거부한다" 같은 어긋남이 생기지 않습니다.
 *
 * 중요: 여기서 막는 것은 "수납 확인 요청"뿐이고, 청구 자체는 화면에 그대로 보여 줍니다.
 * 문제가 있는 청구를 조용히 숨기면 선생님이 미납을 놓치기 때문입니다.
 */
export function resolveStaffBillingGuard({
  paymentClassId,
  amountMismatch,
  studentMismatch,
}: StaffBillingGuardInput): StaffBillingGuard {
  // 청구서와 결제의 학생이 다르면 어느 쪽이 맞는지 서버가 판단할 수 없습니다.
  if (studentMismatch) {
    return {
      confirmable: false,
      blockReason: "청구서와 결제의 학생 정보가 서로 달라 관리자 확인이 필요합니다.",
    };
  }
  // 금액이 어긋난 청구는 숨기지 않고 보여 주되, 틀린 금액으로 수납 처리되는 것만 막습니다.
  if (amountMismatch) {
    return {
      confirmable: false,
      blockReason: "청구서 금액과 결제 금액이 달라 관리자 확인이 필요합니다.",
    };
  }
  // 반 정보가 붙지 않은 과거 청구는 DB 복합 외래키(결제-반-학생-금액 일치)를 만족할 수 없어
  // 확인 요청 자체가 저장되지 않습니다. 그래서 요청 전에 미리 막고 사유를 알려 줍니다.
  if (!paymentClassId) {
    return {
      confirmable: false,
      blockReason: "이 청구에는 아직 반 정보가 연결되지 않아 관리자만 수납 처리할 수 있습니다.",
    };
  }
  return { confirmable: true, blockReason: null };
}
