/**
 * 방학특강 셔틀 "태워야 하는 학생" 판정의 단일 출처(Single Source of Truth).
 *
 * 왜 공용 모듈이 필요한가:
 * 같은 학생 명단을 세 화면이 각자 조회하고 있었는데, 제외 조건이 전부 달랐다.
 *   - 기존 노선 화면(shuttle/service.ts): 셔틀·신청서·수강항목은 걸렀지만 개설 취소 반은 안 걸렀다.
 *   - 통합 명단(seasonal/shuttle-roster.ts): WHERE 절 자체가 없어 취소자·취소 반이 전부 들어왔다.
 *   - 자동 배차(seasonal/shuttle-optimize.ts): 명단을 그대로 받아 쓰므로 같이 오염됐다.
 * 같은 실수가 세 번 반복됐으므로, 기준값과 SQL 조각을 여기 한 곳에만 둔다.
 *
 * 핵심 원칙: **허용 목록(allow-list)이 아니라 제외 목록(deny-list)으로 거른다.**
 * 'REQUESTED'만 허용하는 식으로 좁히면, 노선에 배정돼 status가 'ASSIGNED'로 바뀐
 * 정상 탑승자가 명단에서 통째로 사라진다(과거 실제 사고).
 */

/** 셔틀 신청·특강 신청서·수강 항목에서 "끝난" 상태값. 이 목록에 들면 태우지 않는다. */
export const CLOSED_SHUTTLE_STATUSES = ["CANCELLED", "REJECTED"];

/** 개설 자체가 취소된 반(수업이 사라진 반). 이 반 학생은 셔틀 대상이 아니다. */
export const CANCELLED_OFFERING_STATUS = "CANCELLED";

/**
 * 셔틀 신청 상태가 "탑승"인지 판정한다.
 * `status !== 'CANCELLED'` 로만 보면 REJECTED가 탑승으로 새기 때문에 목록으로 판정한다.
 */
export function isRidingShuttleStatus(status: unknown): boolean {
  return !CLOSED_SHUTTLE_STATUSES.includes(String(status));
}

/** 코드 상수를 SQL 리터럴 목록으로 바꾼다. 예: `'CANCELLED', 'REJECTED'` */
function sqlList(values: string[]): string {
  return values.map((v) => `'${v.replace(/'/g, "''")}'`).join(", ");
}

/**
 * "탑승 중인가"를 SQL에서 계산해야 할 때 쓰는 조각. 예: `r.status NOT IN ('CANCELLED', 'REJECTED')`
 * isRidingShuttleStatus(JS)와 반드시 같은 목록을 쓰게 하려고 여기서 만들어 준다.
 * (화면·쿼리 파일에 ["CANCELLED","REJECTED"]를 다시 적으면 또 갈라진다.)
 */
export function ridingShuttleStatusSql(alias: string): string {
  return `${alias}.status NOT IN (${sqlList(CLOSED_SHUTTLE_STATUSES)})`;
}

/**
 * $queryRawUnsafe 용 WHERE 조각을 만든다.
 * 값은 전부 위 코드 상수라서 외부 입력이 섞이지 않는다(주입 위험 없음).
 *
 * ⚠️ `it`(수강항목)·`o`(개설 반)는 LEFT JOIN으로 붙는 경우가 있다.
 * 그래서 `IS NULL OR ...` 가드를 반드시 함께 넣는다. 이게 없으면
 * 조인이 비어 있는 정상 행이 WHERE 절에서 통째로 사라진다.
 *
 * `shuttleRequest`(선택): 셔틀 신청 자체의 취소·거절까지 SQL에서 걸러야 하는 화면용.
 * - 통합 명단 화면은 이 값을 **주지 않는다**. '미탑승'으로 눌러둔 학생도 행은 남겨야
 *   나중에 다시 탑승으로 되돌릴 수 있기 때문이다(판정은 isRidingShuttleStatus로 한다).
 * - 자동 배차처럼 "실제로 태울 사람"만 뽑는 곳은 이 값을 줘서 SQL에서 바로 제외한다.
 */
export function seasonalShuttleEligibilitySql(alias: {
  application: string;
  item: string;
  offering: string;
  shuttleRequest?: string;
}): string {
  const closed = sqlList(CLOSED_SHUTTLE_STATUSES);
  const { application: a, item: it, offering: o, shuttleRequest: r } = alias;
  const parts = [
    `${a}.status NOT IN (${closed})`,
    `(${it}.id IS NULL OR ${it}.status NOT IN (${closed}))`,
    `(${o}.id IS NULL OR ${o}.status <> '${CANCELLED_OFFERING_STATUS}')`,
  ];
  // 셔틀 상태는 '탑승 여부'라서 항상 거르면 안 된다. 요청한 화면에서만 조건을 추가한다.
  if (r) parts.push(`${r}.status NOT IN (${closed})`);
  return parts.join("\n        AND ");
}
