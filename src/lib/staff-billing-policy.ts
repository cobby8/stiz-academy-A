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
