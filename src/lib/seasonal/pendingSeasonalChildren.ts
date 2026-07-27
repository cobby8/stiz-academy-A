// ── 방학특강 "미전환(전환 대기) 자녀" 그룹핑·중복제거 순수 로직 ──────────────
// 학부모 대시보드(getMyPageData)는 Student 테이블만 보기 때문에, 방학특강만 신청하고
// 아직 정식 학생(Student)으로 전환되지 않은 자녀는 대시보드에 전혀 안 보인다.
// 이 모듈은 전화번호로 조회한 방학특강 신청 "좌석 행"들을 자녀 단위로 묶고,
// 이미 정식 학생으로 전환된 신청은 제외(중복 노출 방지)하는 순수 함수를 담는다.
//
// ★ 순수 함수(의존성 0) — DB/서버 import 없음 → 유닛 테스트가 직접 import 가능.

// 조회 함수(getPendingSeasonalChildren)가 넘겨주는 한 행(좌석 단위)의 형태.
export type PendingSeatRow = {
  applicationId: string;
  childName: string | null;
  childGrade: string | null;
  // 전환 여부 판정용 필드 — 이 둘 중 하나라도 "전환됨"이면 그 행은 제외한다.
  convertedStudentId: string | null; // 신청이 이미 Student로 전환됐다면 그 Student.id
  conversionStatus: string | null; // 항목(item)의 전환 상태 (COMPLETED = 전환 끝)
  offeringTitle: string | null; // 신청한 특강 이름
  // 좌석(회차) 정보 — 좌석이 하나도 없는 신청이면 아래 3개가 모두 null 일 수 있다.
  enrollmentDateId: string | null;
  isFuture: boolean | null; // 이 회차가 아직 오지 않았는지(예정)
  attendanceStatus: string | null; // null(미확인) | PRESENT | LATE | ABSENT | EXCUSED
};

// 화면에 뿌릴 자녀 단위 묶음 결과.
export type PendingSeasonalChild = {
  childName: string;
  childGrade: string | null;
  offeringTitles: string[]; // 신청한 특강 이름(중복 제거)
  upcomingCount: number; // 예정(아직 안 온) 회차 수
  pastCount: number; // 지난 회차 수
  attendance: {
    present: number;
    late: number;
    absent: number;
    excused: number;
  };
};

// 한 행이 "이미 전환됨"인지 판정 — 이런 행은 정식 학생 카드에 이미 뜨므로 제외한다.
// 1) 항목의 conversionStatus === 'COMPLETED' 이거나
// 2) 신청의 convertedStudentId 가 현재 대시보드 자녀(studentIds) 안에 있으면 전환됨.
function isConverted(row: PendingSeatRow, convertedStudentIds: Set<string>): boolean {
  if (row.conversionStatus === "COMPLETED") return true;
  if (row.convertedStudentId && convertedStudentIds.has(row.convertedStudentId)) return true;
  return false;
}

// 자녀 식별 키 — 이름 + 학년 조합(같은 이름 다른 학년은 별개 자녀로 취급).
function childKey(row: PendingSeatRow): string {
  return `${(row.childName || "").trim()}||${(row.childGrade || "").trim()}`;
}

// 좌석 행 배열을 자녀 단위로 묶고, 전환된 신청은 제외한다.
// studentIds = 현재 대시보드에 이미 뜨는 정식 학생 id 목록(중복 노출 방지용).
export function groupPendingChildren(
  rows: PendingSeatRow[],
  studentIds: string[],
): PendingSeasonalChild[] {
  const convertedStudentIds = new Set(studentIds.filter(Boolean));
  const map = new Map<string, PendingSeasonalChild>();

  for (const row of rows) {
    // 1) 전환 완료된 행은 건너뛴다(정식 학생 카드에 이미 노출됨).
    if (isConverted(row, convertedStudentIds)) continue;
    // 2) 이름이 비어 있으면 자녀로 묶을 수 없으니 건너뛴다(안전).
    if (!row.childName || !row.childName.trim()) continue;

    const key = childKey(row);
    let entry = map.get(key);
    if (!entry) {
      entry = {
        childName: row.childName.trim(),
        childGrade: row.childGrade?.trim() || null,
        offeringTitles: [],
        upcomingCount: 0,
        pastCount: 0,
        attendance: { present: 0, late: 0, absent: 0, excused: 0 },
      };
      map.set(key, entry);
    }

    // 특강 이름 누적(중복 제거).
    if (row.offeringTitle && !entry.offeringTitles.includes(row.offeringTitle)) {
      entry.offeringTitles.push(row.offeringTitle);
    }

    // 좌석(회차)이 있는 행만 회차/출결을 집계한다.
    if (row.enrollmentDateId) {
      if (row.isFuture) entry.upcomingCount += 1;
      else entry.pastCount += 1;

      switch (row.attendanceStatus) {
        case "PRESENT":
          entry.attendance.present += 1;
          break;
        case "LATE":
          entry.attendance.late += 1;
          break;
        case "ABSENT":
          entry.attendance.absent += 1;
          break;
        case "EXCUSED":
          entry.attendance.excused += 1;
          break;
      }
    }
  }

  return Array.from(map.values());
}
