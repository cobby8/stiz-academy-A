"use server";

import {
  getStaffClassPeople,
  type StaffClassPerson,
} from "@/lib/staff-class-people";

export type LoadStaffClassPeopleResult =
  | { ok: true; people: StaffClassPerson[] }
  | { ok: false; message: string };

/** 수업 화면의 학생 상세 패널에 필요한 정보를 권한 검증 후 불러옵니다. */
export async function loadStaffClassPeople(input: {
  classId: string;
  sessionId?: string | null;
  sessionDateId?: string | null;
}): Promise<LoadStaffClassPeopleResult> {
  const classId = input.classId?.trim();
  const sessionId = input.sessionId?.trim() || null;
  const sessionDateId = input.sessionDateId?.trim() || null;

  if (!classId || classId.length > 100 || (sessionId && sessionId.length > 100) || (sessionDateId && sessionDateId.length > 100)) {
    return { ok: false, message: "수업 정보를 다시 확인해 주세요." };
  }

  const people = await getStaffClassPeople(classId, sessionId, sessionDateId);
  return { ok: true, people };
}
