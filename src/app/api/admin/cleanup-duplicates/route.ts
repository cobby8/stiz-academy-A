/**
 * 중복 학생 데이터 정리용 API
 *
 * GET  /api/admin/cleanup-duplicates — 중복 학생 목록 미리보기 (삭제 전 확인용)
 * POST /api/admin/cleanup-duplicates — 불완전한 중복 학생 실제 삭제
 *
 * 중복 판정 기준:
 * - 같은 이름(name)의 Student가 2명 이상
 * - 완전한 데이터: school이 있거나 grade가 '-'가 아닌 실제 값
 * - 불완전 데이터: school이 null/빈값이고 grade가 null/'-'
 * - 생년월일이 2000-01-01이면 특히 의심 (수동 등록 시 임시값)
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";

export const dynamic = "force-dynamic";

// 학생 데이터가 "불완전"한지 판별하는 함수
// school이 없고, grade가 없거나 '-'이면 불완전
function isIncomplete(student: {
  school: string | null;
  grade: string | null;
}): boolean {
  const noSchool = !student.school || student.school.trim() === "";
  const noGrade = !student.grade || student.grade.trim() === "" || student.grade.trim() === "-";
  return noSchool && noGrade;
}

// 생년월일이 2000-01-01인지 확인 (수동 등록 시 임시값으로 자주 사용됨)
function isSuspiciousBirthDate(birthDate: string): boolean {
  return birthDate.startsWith("2000-01-01");
}

/**
 * GET: 중복 학생 미리보기
 * 같은 이름이 2명 이상인 그룹에서 완전/불완전을 분류하고 삭제 대상 목록 반환
 */
export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "인증 필요" }, { status: 401 });
  }

  try {
    // 1단계: 같은 이름이 2명 이상인 이름 목록 조회
    const duplicateNames = await prisma.$queryRawUnsafe<{ name: string; cnt: number }[]>(
      `SELECT name, COUNT(*)::int as cnt
       FROM "Student"
       GROUP BY name
       HAVING COUNT(*) >= 2
       ORDER BY name`
    );

    if (duplicateNames.length === 0) {
      return NextResponse.json({
        message: "중복 학생이 없습니다.",
        groups: [],
        totalToDelete: 0,
      });
    }

    // 2단계: 중복 이름에 해당하는 학생 전체 데이터 조회
    const nameList = duplicateNames.map((d) => d.name);
    // IN 절을 위한 파라미터 생성 ($1, $2, $3, ...)
    const placeholders = nameList.map((_, i) => `$${i + 1}`).join(", ");

    const allDuplicates = await prisma.$queryRawUnsafe<{
      id: string;
      name: string;
      birthDate: string;
      school: string | null;
      grade: string | null;
      parentId: string;
      phone: string | null;
      createdAt: string;
    }[]>(
      `SELECT id, name, "birthDate"::text, school, grade, "parentId", phone, "createdAt"::text
       FROM "Student"
       WHERE name IN (${placeholders})
       ORDER BY name, "createdAt" DESC`,
      ...nameList
    );

    // 3단계: 이름별로 그룹핑하고 완전/불완전 분류
    const groups: {
      name: string;
      complete: typeof allDuplicates;
      incomplete: typeof allDuplicates;
      toDelete: typeof allDuplicates;
    }[] = [];

    // 이름별 그룹핑
    const byName = new Map<string, typeof allDuplicates>();
    for (const s of allDuplicates) {
      if (!byName.has(s.name)) byName.set(s.name, []);
      byName.get(s.name)!.push(s);
    }

    let totalToDelete = 0;

    for (const [name, students] of byName) {
      const complete = students.filter((s) => !isIncomplete(s));
      const incomplete = students.filter((s) => isIncomplete(s));

      // 삭제 대상: 완전한 데이터가 1개 이상 있을 때만 불완전한 것을 삭제
      // 모두 불완전하면 삭제하지 않음 (수동 확인 필요)
      const toDelete = complete.length > 0 ? incomplete : [];
      totalToDelete += toDelete.length;

      groups.push({
        name,
        complete: complete.map((s) => ({
          ...s,
          _isSuspiciousBirth: isSuspiciousBirthDate(s.birthDate),
        })) as any,
        incomplete: incomplete.map((s) => ({
          ...s,
          _isSuspiciousBirth: isSuspiciousBirthDate(s.birthDate),
        })) as any,
        toDelete,
      });
    }

    return NextResponse.json({
      message: `중복 이름 ${groups.length}건 발견, 삭제 대상 ${totalToDelete}명`,
      groups,
      totalToDelete,
    });
  } catch (e) {
    console.error("cleanup-duplicates GET error:", e);
    return NextResponse.json({ error: "중복 조회 실패" }, { status: 500 });
  }
}

/**
 * POST: 불완전한 중복 학생 실제 삭제
 * deleteStudent와 동일한 순서로 연결 테이블 정리 후 Student 삭제
 * 고아 User(다른 Student가 없는 학부모)도 함께 삭제
 */
export async function POST() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "인증 필요" }, { status: 401 });
  }

  try {
    // 1단계: 삭제 대상 학생 ID 목록 산출 (GET과 동일한 로직)
    const duplicateNames = await prisma.$queryRawUnsafe<{ name: string }[]>(
      `SELECT name
       FROM "Student"
       GROUP BY name
       HAVING COUNT(*) >= 2`
    );

    if (duplicateNames.length === 0) {
      return NextResponse.json({ message: "중복 학생 없음", deleted: 0 });
    }

    const nameList = duplicateNames.map((d) => d.name);
    const placeholders = nameList.map((_, i) => `$${i + 1}`).join(", ");

    const allDuplicates = await prisma.$queryRawUnsafe<{
      id: string;
      name: string;
      school: string | null;
      grade: string | null;
      parentId: string;
    }[]>(
      `SELECT id, name, school, grade, "parentId"
       FROM "Student"
       WHERE name IN (${placeholders})`,
      ...nameList
    );

    // 이름별 그룹핑
    const byName = new Map<string, typeof allDuplicates>();
    for (const s of allDuplicates) {
      if (!byName.has(s.name)) byName.set(s.name, []);
      byName.get(s.name)!.push(s);
    }

    // 삭제 대상 ID와 parentId 수집
    const toDeleteIds: string[] = [];
    const parentIdsToCheck = new Set<string>();

    for (const [, students] of byName) {
      const complete = students.filter((s) => !isIncomplete(s));
      const incomplete = students.filter((s) => isIncomplete(s));

      if (complete.length > 0) {
        for (const s of incomplete) {
          toDeleteIds.push(s.id);
          parentIdsToCheck.add(s.parentId);
        }
      }
    }

    if (toDeleteIds.length === 0) {
      return NextResponse.json({ message: "삭제 대상 없음", deleted: 0 });
    }

    // 2단계: 연결 테이블 삭제 (deleteStudent와 동일한 FK 순서)
    // 각 학생 ID에 대해 순서대로 삭제
    for (const studentId of toDeleteIds) {
      await prisma.$executeRawUnsafe(`DELETE FROM "Guardian" WHERE "studentId" = $1`, studentId);
      await prisma.$executeRawUnsafe(`DELETE FROM "StudentSessionNote" WHERE "studentId" = $1`, studentId);
      await prisma.$executeRawUnsafe(`DELETE FROM "Feedback" WHERE "studentId" = $1`, studentId);
      await prisma.$executeRawUnsafe(`DELETE FROM "SkillRecord" WHERE "studentId" = $1`, studentId);
      await prisma.$executeRawUnsafe(`DELETE FROM "Waitlist" WHERE "studentId" = $1`, studentId);
      await prisma.$executeRawUnsafe(`DELETE FROM "MakeupSession" WHERE "studentId" = $1`, studentId);
      await prisma.$executeRawUnsafe(`DELETE FROM "Attendance" WHERE "studentId" = $1`, studentId);
      await prisma.$executeRawUnsafe(`DELETE FROM "Payment" WHERE "studentId" = $1`, studentId);
      await prisma.$executeRawUnsafe(`DELETE FROM "Enrollment" WHERE "studentId" = $1`, studentId);
      await prisma.$executeRawUnsafe(`DELETE FROM "Student" WHERE id = $1`, studentId);
    }

    // 3단계: 고아 User 삭제 (다른 Student가 없는 학부모)
    let orphanUsersDeleted = 0;
    for (const parentId of parentIdsToCheck) {
      const remaining = await prisma.$queryRawUnsafe<{ cnt: number }[]>(
        `SELECT COUNT(*)::int as cnt FROM "Student" WHERE "parentId" = $1`,
        parentId
      );
      if (remaining[0]?.cnt === 0) {
        await prisma.$executeRawUnsafe(`DELETE FROM "User" WHERE id = $1`, parentId);
        orphanUsersDeleted++;
      }
    }

    return NextResponse.json({
      message: `학생 ${toDeleteIds.length}명 삭제 완료, 고아 학부모 ${orphanUsersDeleted}명 삭제`,
      deletedStudents: toDeleteIds.length,
      deletedOrphanUsers: orphanUsersDeleted,
      deletedStudentIds: toDeleteIds,
    });
  } catch (e) {
    console.error("cleanup-duplicates POST error:", e);
    return NextResponse.json({ error: "정리 실패" }, { status: 500 });
  }
}
