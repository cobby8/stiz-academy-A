type Queryable = {
  $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
};

export type StudentIdentityInput = {
  studentName: string | null | undefined;
  parentPhone?: string | null;
  studentPhone?: string | null;
  parentName?: string | null;
  birthDate?: Date | string | null;
  grade?: string | null;
  school?: string | null;
};

export type StudentIdentityMatch = {
  studentId: string;
  confidence: "strong" | "medium" | "weak";
  matchedBy:
    | "parent_phone"
    | "student_phone"
    | "birth_date"
    | "parent_name_school_grade"
    | "unique_name"
    | "manual";
};

type StudentIdRow = { id: string };

export function normalizeSheetHeader(value: string) {
  return value.replace(/\s+/g, "").trim();
}

export function normalizePhoneDigits(raw: string | null | undefined) {
  return (raw || "").replace(/[^0-9]/g, "");
}

export function cleanSheetString(raw: string | null | undefined) {
  const value = (raw || "").trim();
  return value ? value : null;
}

export function findSheetValue(record: Record<string, string>, ...labels: string[]) {
  for (const label of labels) {
    if (record[label] != null) return record[label];
  }

  const normalizedEntries = Object.entries(record).map(([key, value]) => ({
    key,
    normalizedKey: normalizeSheetHeader(key),
    value,
  }));

  for (const label of labels) {
    const normalizedLabel = normalizeSheetHeader(label);
    const exact = normalizedEntries.find((entry) => entry.normalizedKey === normalizedLabel);
    if (exact) return exact.value;
  }

  for (const label of labels) {
    const normalizedLabel = normalizeSheetHeader(label);
    if (normalizedLabel.length < 2) continue;

    const partial = normalizedEntries.find((entry) =>
      entry.normalizedKey.includes(normalizedLabel)
    );
    if (partial) return partial.value;
  }

  return "";
}

function normalizeName(raw: string | null | undefined) {
  return (raw || "").trim();
}

function normalizeDate(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function firstIfSingle(rows: StudentIdRow[]) {
  return rows.length === 1 ? rows[0].id : null;
}

export async function findStudentIdentityMatch(
  db: Queryable,
  input: StudentIdentityInput
): Promise<StudentIdentityMatch | null> {
  const studentName = normalizeName(input.studentName);
  if (!studentName || studentName === "(이름 없음)") return null;

  const parentPhone = normalizePhoneDigits(input.parentPhone);
  if (parentPhone) {
    const rows = await db.$queryRawUnsafe<StudentIdRow[]>(
      `SELECT s.id
       FROM "Student" s
       INNER JOIN "User" u ON u.id = s."parentId"
       WHERE s.name = $1
         AND regexp_replace(COALESCE(u.phone, ''), '[^0-9]', '', 'g') = $2
       LIMIT 2`,
      studentName,
      parentPhone
    );
    const studentId = firstIfSingle(rows);
    if (studentId) {
      return { studentId, confidence: "strong", matchedBy: "parent_phone" };
    }
  }

  const studentPhone = normalizePhoneDigits(input.studentPhone);
  if (studentPhone) {
    const rows = await db.$queryRawUnsafe<StudentIdRow[]>(
      `SELECT s.id
       FROM "Student" s
       WHERE s.name = $1
         AND regexp_replace(COALESCE(s.phone, ''), '[^0-9]', '', 'g') = $2
       LIMIT 2`,
      studentName,
      studentPhone
    );
    const studentId = firstIfSingle(rows);
    if (studentId) {
      return { studentId, confidence: "strong", matchedBy: "student_phone" };
    }
  }

  const birthDate = normalizeDate(input.birthDate);
  if (birthDate) {
    const rows = await db.$queryRawUnsafe<StudentIdRow[]>(
      `SELECT s.id
       FROM "Student" s
       WHERE s.name = $1
         AND DATE(s."birthDate") = DATE($2::timestamp)
       LIMIT 2`,
      studentName,
      birthDate
    );
    const studentId = firstIfSingle(rows);
    if (studentId) {
      return { studentId, confidence: "medium", matchedBy: "birth_date" };
    }
  }

  const parentName = cleanSheetString(input.parentName);
  const school = cleanSheetString(input.school);
  const grade = cleanSheetString(input.grade);
  if (parentName || school || grade) {
    const rows = await db.$queryRawUnsafe<StudentIdRow[]>(
      `SELECT s.id
       FROM "Student" s
       INNER JOIN "User" u ON u.id = s."parentId"
       WHERE s.name = $1
         AND ($2::text IS NULL OR u.name = $2)
         AND ($3::text IS NULL OR s.school = $3)
         AND ($4::text IS NULL OR s.grade = $4)
       LIMIT 2`,
      studentName,
      parentName,
      school,
      grade
    );
    const studentId = firstIfSingle(rows);
    if (studentId) {
      return { studentId, confidence: "medium", matchedBy: "parent_name_school_grade" };
    }
  }

  const rows = await db.$queryRawUnsafe<StudentIdRow[]>(
    `SELECT s.id
     FROM "Student" s
     WHERE s.name = $1
     LIMIT 2`,
    studentName
  );
  const studentId = firstIfSingle(rows);
  if (studentId) {
    return { studentId, confidence: "weak", matchedBy: "unique_name" };
  }

  return null;
}
