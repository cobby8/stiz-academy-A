// 학생 조회에서 "병합으로 흡수된 학생"을 제외하는 공통 규칙.
//
// 배경: 중복 학생 정리는 하드 DELETE를 하지 않는다(`src/lib/studentMerge/engine.ts`).
// 흡수된 쪽 `Student` 행은 그대로 남고 `mergedIntoStudentId`에 대표 학생 id만 찍힌다.
// 그래서 이 조건을 걸지 않으면 학생 목록·정원·통계·명단·문자 발송 대상에
// 같은 사람이 두 번 나온다(= 유령 학생).
//
// ⚠️ 새로 학생을 조회하는 코드를 짤 때는 이 파일의 함수를 반드시 쓴다.
//    "Student" 를 FROM/JOIN 하는데 이 조건이 없으면 리뷰에서 잡아야 한다.
//
// 반대로, 아래 경우에는 **일부러 걸지 않는다**:
//  - 병합 관리/되돌리기 화면 (흡수된 쪽을 봐야 한다)
//  - 감사·이력 조회, 과거 기록의 학생 이름 표시
//  - 청구(Payment / PaymentInvoice) 목록 — 돈을 숨기는 쪽이 더 위험하다
//  - 특정 id 한 건을 그대로 읽는 상세 조회 (링크로 들어온 사람에게 404를 주지 않기 위해)

/**
 * `"Student"` 테이블 별칭에 붙일 제외 조건.
 * INNER JOIN / FROM 절에 쓴다 (WHERE 에 넣어도 안전).
 *
 * @param alias SQL 안에서 쓰는 "Student" 별칭 (예: `s`, `st`, `student`)
 */
export function notMergedStudent(alias: string): string {
    return `${alias}."mergedIntoStudentId" IS NULL`;
}

/**
 * LEFT JOIN 으로 붙인 `"Student"` 에 쓰는 형태.
 *
 * ⚠️ LEFT JOIN 결과가 NULL 일 수 있는 자리에 `notMergedStudent()` 를 WHERE 에 그냥 넣으면
 * 학생이 매칭되지 않은 행까지 통째로 사라진다(= 정상 데이터 소실).
 * 이 함수는 "학생이 안 붙은 행은 그대로 두고, 붙었는데 흡수된 경우에만 제외"한다.
 */
export function notMergedStudentOptional(alias: string): string {
    return `(${alias}.id IS NULL OR ${notMergedStudent(alias)})`;
}

/**
 * Prisma 클라이언트(`prisma.student.*`)용 where 조각.
 * `where: { ...NOT_MERGED_STUDENT, parentId }` 처럼 펼쳐 쓴다.
 */
export const NOT_MERGED_STUDENT = { mergedIntoStudentId: null } as const;
