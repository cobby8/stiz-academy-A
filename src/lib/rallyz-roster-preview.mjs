export const RALLYZ_NONPAYMENT_FIELDS = [
  "학생명",
  "관리용이름",
  "클래스명",
  "학생휴대폰번호",
  "보호자1휴대폰번호",
  "보호자2휴대폰번호",
  "보호자3휴대폰번호",
  "생년월일",
];
const ALLOWED_FIELDS = new Set(RALLYZ_NONPAYMENT_FIELDS);

const clean = (value) => String(value ?? "").trim().replace(/\s+/g, " ");
const headerKey = (value) => clean(value).replace(/[\s_()-]/g, "");
const digits = (value) => clean(value).replace(/\D/g, "");

function validBirthDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getUTCFullYear()}${String(value.getUTCMonth() + 1).padStart(2, "0")}${String(value.getUTCDate()).padStart(2, "0")}`;
  }
  const normalized = digits(value);
  if (normalized.length < 8) return "";
  const value8 = normalized.slice(0, 8);
  const year = Number(value8.slice(0, 4));
  const month = Number(value8.slice(4, 6));
  const day = Number(value8.slice(6, 8));
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? value8
    : "";
}

function cell(row, column) {
  return column === undefined ? "" : clean(row?.[column]);
}

export function extractRallyzNonPaymentGrid(headers, rowCount, readCell) {
  const allowed = new Set(RALLYZ_NONPAYMENT_FIELDS.map(headerKey));
  const allowedColumns = headers
    .map((header, index) => ({ header, index }))
    .filter(({ header }) => allowed.has(headerKey(header)))
    .map(({ index }) => index);
  const grid = [headers];
  for (let rowIndex = 1; rowIndex < rowCount; rowIndex += 1) {
    const row = new Array(headers.length).fill("");
    for (const column of allowedColumns) row[column] = readCell(rowIndex, column);
    grid.push(row);
  }
  return grid;
}

function identityFor(record) {
  const name = clean(record["학생명"]).replace(/\s/g, "");
  const birth = validBirthDate(record["생년월일"]);
  const studentPhone = digits(record["학생휴대폰번호"]);
  const guardianPhones = [1, 2, 3]
    .map((n) => digits(record[`보호자${n}휴대폰번호`]))
    .filter(Boolean)
    .sort();

  const phones = [...new Set([studentPhone, ...guardianPhones].filter(Boolean))];
  if (!name) return { key: null, contact: null, name: "", birth, phones };
  const contact = phones.slice().sort().join("|");
  if (birth) return { key: `name+birth:${name}|${birth}`, contact: contact || null, name, birth, phones };
  if (studentPhone) return { key: `name+student-phone:${name}|${studentPhone}`, contact: contact || null, name, birth, phones };
  if (guardianPhones.length) return { key: `name+guardian-phone:${name}|${guardianPhones[0]}`, contact: contact || null, name, birth, phones };
  return { key: null, contact: null, name, birth, phones };
}

function siteIdentityMatch(student, siteStudents) {
  const sourceName = clean(student.name).replace(/\s/g, "");
  const nameMatches = siteStudents.filter((candidate) => clean(candidate.name).replace(/\s/g, "") === sourceName);
  if (!nameMatches.length) return { status: "NOT_FOUND_REVIEW", confidence: null, existingEnrollments: [] };

  const branchMatches = nameMatches.filter((candidate) => clean(candidate.branch).includes("2호점"));
  if (!branchMatches.length) {
    const hasOtherBranch = nameMatches.some((candidate) => clean(candidate.branch) && !clean(candidate.branch).includes("2호점"));
    return {
      status: hasOtherBranch ? "OTHER_BRANCH_REVIEW" : "SITE_BRANCH_UNCONFIRMED",
      confidence: null,
      existingEnrollments: [],
    };
  }

  const sourcePhones = student.sourcePhones ?? new Set();
  const phoneMatches = branchMatches.filter((candidate) => {
    const candidatePhones = [candidate.phone, candidate.parentPhone, ...(candidate.guardianPhones ?? [])]
      .map(digits)
      .filter(Boolean);
    return candidatePhones.some((phone) => sourcePhones.has(phone));
  });
  let matched = null;
  let confidence = null;

  if (phoneMatches.length === 1) {
    matched = phoneMatches[0];
    confidence = "STRONG_PHONE";
  } else if (phoneMatches.length > 1) {
    return { status: "MULTIPLE_SITE_MATCHES", confidence: null, existingEnrollments: [] };
  } else if (student.sourceBirth) {
    const birthMatches = branchMatches.filter((candidate) => validBirthDate(candidate.birthDate) === student.sourceBirth);
    if (birthMatches.length === 1) {
      matched = birthMatches[0];
      confidence = "BIRTH_DATE_REVIEW";
      const candidatePhones = [matched.phone, matched.parentPhone, ...(matched.guardianPhones ?? [])]
        .map(digits)
        .filter(Boolean);
      if (sourcePhones.size && candidatePhones.length && !candidatePhones.some((phone) => sourcePhones.has(phone))) {
        return { status: "IDENTITY_CONTACT_CONFLICT", confidence: null, existingEnrollments: [] };
      }
    } else if (birthMatches.length > 1) {
      return { status: "MULTIPLE_SITE_MATCHES", confidence: null, existingEnrollments: [] };
    }
  }

  if (!matched) {
    return {
      status: branchMatches.length > 1 ? "MULTIPLE_SITE_MATCHES" : "IDENTITY_NOT_CONFIRMED",
      confidence: null,
      existingEnrollments: [],
    };
  }
  const birth = validBirthDate(matched.birthDate);
  if (student.sourceBirth && birth && student.sourceBirth !== birth) {
    return { status: "IDENTITY_BIRTH_CONFLICT", confidence: null, existingEnrollments: [] };
  }
  return {
    status: confidence === "BIRTH_DATE_REVIEW" ? "BIRTH_DATE_ONLY_REVIEW" : "MATCHED_REVIEW",
    confidence,
    siteStudentId: matched.id,
    studentStatus: (matched.enrollments ?? []).some((entry) => entry.status === "ACTIVE") ? "ACTIVE" : "NON_ACTIVE",
    existingEnrollments: (matched.enrollments ?? []).map((entry) => ({
      classId: entry.classId,
      className: entry.className,
      status: entry.status,
    })),
  };
}

/**
 * Read only allowlisted non-payment cells from a worksheet-shaped grid.
 * Unknown columns, including financial columns, are never accessed or copied.
 */
export function previewRallyzRoster(grid, knownClassNames = [], siteStudents = []) {
  if (!Array.isArray(grid) || grid.length < 1 || !Array.isArray(grid[0])) {
    return { rowCount: 0, studentCount: 0, enrollmentCount: 0, heldRowCount: 0, students: [] };
  }

  const columns = new Map();
  grid[0].forEach((header, index) => {
    const key = headerKey(header);
    if (ALLOWED_FIELDS.has(key)) columns.set(key, index);
  });
  const classNameCounts = new Map();
  for (const name of knownClassNames.map(clean).filter(Boolean)) {
    classNameCounts.set(name, (classNameCounts.get(name) ?? 0) + 1);
  }
  const grouped = new Map();
  let rowCount = 0;

  for (let rowIndex = 1; rowIndex < grid.length; rowIndex += 1) {
    const row = grid[rowIndex];
    if (!Array.isArray(row)) continue;
    let hasAllowedValue = false;
    for (const index of columns.values()) {
      if (clean(row[index]) !== "") {
        hasAllowedValue = true;
        break;
      }
    }
    if (!hasAllowedValue) continue;
    rowCount += 1;

    const record = {};
    for (const field of ALLOWED_FIELDS) {
      record[field] = cell(row, columns.get(field));
    }
    const { key, contact, name: normalizedName, birth, phones } = identityFor(record);
    const className = record["클래스명"];
    const classMatchCount = classNameCounts.get(className) ?? 0;
    const classMatched = Boolean(className && classMatchCount === 1);
    const reasons = [];
    if (!key) reasons.push("IDENTITY_INSUFFICIENT");
    if (!className) reasons.push("CLASS_MISSING");
    else if (classMatchCount === 0) reasons.push("CLASS_UNMATCHED");
    else if (classMatchCount > 1) reasons.push("CLASS_AMBIGUOUS");

    const rowNumber = rowIndex + 1;
    if (!key) {
      grouped.set(`held-row:${rowNumber}`, {
        name: record["학생명"],
        alias: record["관리용이름"],
        enrollments: className ? [{ className, classMatched, sourceRows: [rowNumber] }] : [],
        sourceRows: [rowNumber],
        heldReasons: reasons,
        normalizedName,
        sourceBirth: birth,
        sourcePhones: new Set(phones),
      });
      continue;
    }

    const existing = grouped.get(key) ?? {
      contactFingerprints: new Set(),
      name: record["학생명"],
      alias: record["관리용이름"],
      enrollments: [],
      sourceRows: [],
      heldReasons: [],
      normalizedName,
      sourceBirth: birth,
      sourcePhones: new Set(),
    };
    if (contact) existing.contactFingerprints.add(contact);
    if (birth && existing.sourceBirth && birth !== existing.sourceBirth) existing.heldReasons.push("IDENTITY_BIRTH_CONFLICT");
    if (birth && !existing.sourceBirth) existing.sourceBirth = birth;
    for (const phone of phones) existing.sourcePhones.add(phone);
    existing.sourceRows.push(rowNumber);
    existing.heldReasons.push(...reasons);
    if (className) {
      const enrollment = existing.enrollments.find((entry) => entry.className === className);
      if (enrollment) enrollment.sourceRows.push(rowNumber);
      else existing.enrollments.push({ className, classMatched, sourceRows: [rowNumber] });
    }
    grouped.set(key, existing);
  }

  const students = [...grouped.values()].map((student) => {
    const contactFingerprints = student.contactFingerprints;
    if (contactFingerprints?.size > 1) student.heldReasons.push("IDENTITY_CONTACT_CONFLICT");
    const heldReasons = [...new Set(student.heldReasons)];
    const siteMatch = siteIdentityMatch(student, siteStudents);
    if (siteMatch.status !== "MATCHED_REVIEW") heldReasons.push(siteMatch.status);
    const publicStudent = { ...student };
    delete publicStudent.contactFingerprints;
    delete publicStudent.identity;
    delete publicStudent.normalizedName;
    delete publicStudent.sourceBirth;
    delete publicStudent.sourcePhones;
    return {
      ...publicStudent,
      siteMatch,
      heldReasons,
      status: heldReasons.length ? "HELD" : "READY_FOR_SITE_REVIEW",
    };
  });

  const enrollmentCount = students.reduce((sum, student) => sum + student.enrollments.length, 0);
  const heldRowCount = students
    .filter((student) => student.status === "HELD")
    .reduce((sum, student) => sum + student.sourceRows.length, 0);
  return {
    rowCount,
    studentCount: students.length,
    enrollmentCount,
    heldRowCount,
    students,
  };
}
