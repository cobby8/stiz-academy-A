#!/usr/bin/env node

import { createHash, timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const ALIASES = {
  applicantType: ["applicantType", "회원구분", "신규기존", "신규/기존", "구분"],
  className: ["className", "반", "수업반", "신청반", "타임"],
  childName: ["childName", "학생명", "학생이름", "이름"],
  childBirthDate: ["childBirthDate", "생년월일", "학생생년월일"],
  parentPhone: ["parentPhone", "학부모연락처", "보호자연락처", "학부모전화번호"],
  weekdays: ["weekdays", "요일", "신청요일", "희망요일"],
  tuition: ["tuition", "수강료", "특강비", "금액"],
  shuttle: ["shuttle", "차량", "셔틀", "차량신청"],
  childGender: ["childGender", "성별", "학생성별"],
  childGrade: ["childGrade", "학년", "학생학년"],
  childSchool: ["childSchool", "학교", "학교명"],
  childPhone: ["childPhone", "학생연락처", "학생전화번호"],
  parentName: ["parentName", "학부모명", "보호자명", "학부모이름"],
  parentRelation: ["parentRelation", "관계", "학생과의관계"],
  address: ["address", "주소", "거주지"],
  shuttlePickup: ["shuttlePickup", "탑승장소", "승차장소", "픽업장소"],
  shuttleDropoff: ["shuttleDropoff", "하차장소"],
  sourceRowRef: ["sourceRowRef", "응답ID", "타임스탬프", "제출시간"],
  agreedTerms: ["agreedTerms", "약관동의", "이용약관동의"],
  agreedPrivacy: ["agreedPrivacy", "개인정보동의", "개인정보수집동의"],
  memo: ["memo", "특이사항", "메모"],
};

function clean(value) {
  return String(value ?? "").trim();
}

function normalizePhone(value) {
  return clean(value).replace(/\D/g, "");
}

export function normalizeBirthDate(value) {
  const text = clean(value);
  let year;
  let month;
  let day;
  const separated = text.match(/^(\d{4})\s*[.\-/]\s*(\d{1,2})\s*[.\-/]\s*(\d{1,2})\s*\.?$/);
  if (separated) {
    [, year, month, day] = separated;
  } else if (/^\d{8}$/.test(text)) {
    year = text.slice(0, 4);
    month = text.slice(4, 6);
    day = text.slice(6, 8);
  } else return "";

  const numericYear = Number(year);
  const numericMonth = Number(month);
  const numericDay = Number(day);
  const date = new Date(Date.UTC(numericYear, numericMonth - 1, numericDay));
  if (
    numericYear < 1900
    || numericYear > 2100
    || date.getUTCFullYear() !== numericYear
    || date.getUTCMonth() + 1 !== numericMonth
    || date.getUTCDate() !== numericDay
  ) return "";
  return `${year}${String(numericMonth).padStart(2, "0")}${String(numericDay).padStart(2, "0")}`;
}

function pick(row, names) {
  for (const name of names) {
    if (Object.hasOwn(row, name) && clean(row[name])) return row[name];
  }
  return "";
}

function normalizeApplicantType(value) {
  const text = clean(value).toLowerCase();
  if (/신규|new/.test(text)) return "NEW";
  if (/기존|재원|existing|returning/.test(text)) return "EXISTING";
  return "UNKNOWN";
}

function normalizeClass(value) {
  const text = clean(value).replace(/\s/g, "");
  if (/초등고|1부|고학년/.test(text)) return "ELEMENTARY_HIGH";
  if (/초등저|2부|저학년/.test(text)) return "ELEMENTARY_LOW";
  if (/중등|3부|중학생/.test(text)) return "MIDDLE";
  return text ? "OTHER" : "UNKNOWN";
}

function normalizeWeekdays(value) {
  const matches = clean(value).match(/[월화수목금토일]/g) ?? [];
  const canonical = { 월: "MON", 화: "TUE", 수: "WED", 목: "THU", 금: "FRI", 토: "SAT", 일: "SUN" };
  return [...new Set(matches)]
    .sort((a, b) => "월화수목금토일".indexOf(a) - "월화수목금토일".indexOf(b))
    .map((day) => canonical[day]);
}

function normalizeMoney(value) {
  const digits = clean(value).replace(/[^0-9-]/g, "");
  if (!digits) return null;
  const amount = Number(digits);
  return Number.isSafeInteger(amount) && amount >= 0 ? amount : null;
}

function normalizeBoolean(value) {
  if (value === true || value === 1) return true;
  if (value === false || value === 0) return false;
  const text = clean(value).toLowerCase();
  if (/^(예|동의|동의함|yes|y|true|1|확인)$/.test(text)) return true;
  if (/^(아니오|미동의|no|n|false|0)$/.test(text)) return false;
  return null;
}

function stableKey(seasonSlug, identity) {
  return `sheet-${createHash("sha256")
    .update([seasonSlug, identity.childName, identity.childBirthDate, identity.parentPhone].join("|"))
    .digest("hex")}`;
}

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  const source = String(text).replace(/^\uFEFF/, "");
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char === '"') {
      if (quoted && source[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && source[index + 1] === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
      cell = "";
    } else cell += char;
  }
  row.push(cell);
  if (row.some((value) => value !== "")) rows.push(row);
  if (quoted) throw new Error("CSV 따옴표가 닫히지 않았습니다.");
  const [headers = [], ...body] = rows;
  return body.map((values) => Object.fromEntries(headers.map((header, index) => [clean(header), values[index] ?? ""])));
}

export function analyzeSeasonalRows(rows, { seasonSlug }) {
  if (!Array.isArray(rows)) throw new Error("입력 데이터는 행 배열이어야 합니다.");
  if (!clean(seasonSlug)) throw new Error("--season-slug가 필요합니다.");

  const seenIdentity = new Map();
  const seenKeys = new Map();
  const records = rows.map((row, sourceIndex) => {
    const identity = {
      childName: clean(pick(row, ALIASES.childName)).replace(/\s/g, ""),
      childBirthDate: normalizeBirthDate(pick(row, ALIASES.childBirthDate)),
      parentPhone: normalizePhone(pick(row, ALIASES.parentPhone)),
    };
    const sourceRowRef = clean(pick(row, ALIASES.sourceRowRef)) || String(sourceIndex + 2);
    const weekdays = normalizeWeekdays(pick(row, ALIASES.weekdays));
    const tuition = normalizeMoney(pick(row, ALIASES.tuition));
    const applicantType = normalizeApplicantType(pick(row, ALIASES.applicantType));
    const className = normalizeClass(pick(row, ALIASES.className));
    const agreedTerms = normalizeBoolean(pick(row, ALIASES.agreedTerms));
    const agreedPrivacy = normalizeBoolean(pick(row, ALIASES.agreedPrivacy));
    const reviewReasons = [];
    if (!identity.childName) reviewReasons.push("MISSING_CHILD_NAME");
    if (identity.childBirthDate.length !== 8) reviewReasons.push("INVALID_BIRTH_DATE");
    if (identity.parentPhone.length < 10 || identity.parentPhone.length > 11) reviewReasons.push("INVALID_PARENT_PHONE");
    if (!clean(pick(row, ALIASES.parentName))) reviewReasons.push("MISSING_PARENT_NAME");
    if (weekdays.length === 0) reviewReasons.push("MISSING_WEEKDAYS");
    if (tuition === null) reviewReasons.push("MISSING_TUITION");
    if (applicantType === "UNKNOWN") reviewReasons.push("UNKNOWN_APPLICANT_TYPE");
    if (className === "UNKNOWN" || className === "OTHER") reviewReasons.push("UNKNOWN_CLASS");
    if (agreedTerms !== true || agreedPrivacy !== true) reviewReasons.push("CONSENT_EVIDENCE_MISSING");

    const identityFingerprint = createHash("sha256").update(Object.values(identity).join("|")).digest("hex");
    const idempotencyKey = stableKey(clean(seasonSlug).toLowerCase(), identity);
    const duplicateOf = seenIdentity.has(identityFingerprint) ? seenIdentity.get(identityFingerprint) : null;
    if (duplicateOf !== null) reviewReasons.push("DUPLICATE_APPLICATION");
    else seenIdentity.set(identityFingerprint, sourceIndex + 1);
    if (seenKeys.has(idempotencyKey) && duplicateOf === null) reviewReasons.push("IDEMPOTENCY_COLLISION");
    else seenKeys.set(idempotencyKey, sourceIndex + 1);

    return {
      sourceRow: sourceIndex + 2,
      sourceRowRef,
      idempotencyKey,
      applicantType,
      className,
      selectedWeekdays: weekdays,
      weekdays,
      fee: tuition,
      tuition,
      childName: identity.childName,
      childBirthDate: identity.childBirthDate,
      childGender: clean(pick(row, ALIASES.childGender)) || null,
      childGrade: clean(pick(row, ALIASES.childGrade)) || null,
      childSchool: clean(pick(row, ALIASES.childSchool)) || null,
      childPhone: normalizePhone(pick(row, ALIASES.childPhone)) || null,
      parentName: clean(pick(row, ALIASES.parentName)),
      parentPhone: identity.parentPhone,
      parentRelation: clean(pick(row, ALIASES.parentRelation)) || null,
      address: clean(pick(row, ALIASES.address)) || null,
      memo: clean(pick(row, ALIASES.memo)) || null,
      agreedTerms: agreedTerms === true,
      agreedPrivacy: agreedPrivacy === true,
      shuttle: {
        requested: /^(예|yes|y|신청|필요|true|1)$/i.test(clean(pick(row, ALIASES.shuttle))),
        pickupLocation: clean(pick(row, ALIASES.shuttlePickup)) || null,
        dropoffLocation: clean(pick(row, ALIASES.shuttleDropoff)) || null,
      },
      requiresReview: reviewReasons.length > 0,
      reviewReasons,
    };
  });

  const countBy = (field) => records.reduce((result, record) => {
    const key = record[field];
    result[key] = (result[key] ?? 0) + 1;
    return result;
  }, {});
  const reasonCounts = records.flatMap((record) => record.reviewReasons).reduce((result, reason) => {
    result[reason] = (result[reason] ?? 0) + 1;
    return result;
  }, {});
  const tuition = records.filter((record) => record.tuition !== null).reduce((sum, record) => sum + record.tuition, 0);

  return {
    summary: {
      total: records.length,
      ready: records.filter((record) => !record.requiresReview).length,
      requiresReview: records.filter((record) => record.requiresReview).length,
      duplicates: reasonCounts.DUPLICATE_APPLICATION ?? 0,
      applicantTypes: countBy("applicantType"),
      classes: countBy("className"),
      weekdaySelections: records.flatMap((record) => record.weekdays).reduce((result, day) => {
        result[day] = (result[day] ?? 0) + 1;
        return result;
      }, {}),
      tuition: { enteredCount: records.filter((record) => record.tuition !== null).length, missingCount: reasonCounts.MISSING_TUITION ?? 0, total: tuition },
      shuttleRequested: records.filter((record) => record.shuttle.requested).length,
      exceptions: reasonCounts,
    },
    records,
  };
}

async function loadRows(inputPath) {
  const raw = await readFile(inputPath, "utf8");
  if (extname(inputPath).toLowerCase() === ".csv") return parseCsv(raw);
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : parsed.rows;
}

async function loadOfferingMap(mapPath) {
  if (!mapPath) throw new Error("적용 차단: --offering-map 파일이 필요합니다.");
  const parsed = JSON.parse(await readFile(resolve(mapPath), "utf8"));
  return parsed.mappings ?? parsed;
}

function offeringCodeFor(record, mapping) {
  const key = `${record.className}:${record.selectedWeekdays.length}`;
  const entry = mapping[key] ?? mapping[record.className]?.[String(record.selectedWeekdays.length)];
  return typeof entry === "string" ? entry : entry?.code ?? null;
}

export async function applySeasonalImport({ adapter, seasonSlug, source, records, offeringMap, allowReview = false }) {
  if (!adapter?.transaction) throw new Error("적용 차단: DB 어댑터가 필요합니다.");
  if (!clean(source)) throw new Error("적용 차단: --source가 필요합니다.");
  const blocked = records.filter((record) => record.requiresReview);
  if (blocked.length && !allowReview) throw new Error("적용 차단: 확인이 필요한 신청이 남아 있습니다. --allow-review를 검토하세요.");

  return adapter.transaction(async (tx) => {
    const season = await tx.findSeasonBySlug(seasonSlug);
    if (!season) throw new Error("적용 차단: 시즌을 찾을 수 없습니다.");
    const offeringCodes = [...new Set(records.map((record) => offeringCodeFor(record, offeringMap)).filter(Boolean))];
    const offerings = await tx.findOfferings(season.id, offeringCodes);
    const offeringByCode = new Map(offerings.map((offering) => [offering.code, offering]));
    const result = { created: 0, updated: 0, itemCreated: 0, reviewOnly: 0 };

    for (const record of records) {
      const code = offeringCodeFor(record, offeringMap);
      const offering = code ? offeringByCode.get(code) : null;
      const safeForItem = Boolean(offering) && record.fee !== null;
      const extraReasons = [];
      if (!code || !offering) extraReasons.push("OFFERING_MAPPING_MISSING");
      if (record.fee === null) extraReasons.push("MISSING_TUITION");
      const reviewReasons = [...new Set([...record.reviewReasons, ...extraReasons])];
      const requiresReview = reviewReasons.length > 0;
      if (requiresReview && !allowReview) throw new Error("적용 차단: 반 매핑 또는 금액 검토가 필요합니다.");

      const applicationData = {
        seasonId: season.id,
        idempotencyKey: record.idempotencyKey,
        importSource: source,
        sourceRowRef: record.sourceRowRef,
        applicantType: record.applicantType === "UNKNOWN" ? null : record.applicantType,
        selectedWeekdays: record.selectedWeekdays,
        requiresReview,
        reviewReasons,
        childName: record.childName,
        childBirthDate: new Date(`${record.childBirthDate.slice(0, 4)}-${record.childBirthDate.slice(4, 6)}-${record.childBirthDate.slice(6, 8)}T00:00:00+09:00`),
        childGender: record.childGender,
        childGrade: record.childGrade,
        childSchool: record.childSchool,
        childPhone: record.childPhone,
        parentName: record.parentName,
        parentPhone: record.parentPhone,
        parentRelation: record.parentRelation,
        address: record.address,
        memo: record.memo,
        agreedTerms: record.agreedTerms,
        agreedPrivacy: record.agreedPrivacy,
        status: "PENDING",
        totalPriceSnapshot: safeForItem ? record.fee : 0,
      };
      const saved = await tx.upsertApplication(applicationData);
      result[saved.created ? "created" : "updated"] += 1;

      if (safeForItem) {
        const item = await tx.upsertItem({
          applicationId: saved.application.id,
          offeringId: offering.id,
          priceSnapshot: record.fee,
          titleSnapshot: offering.title,
          status: "PENDING",
        });
        result.itemCreated += item.created ? 1 : 0;
        if (record.shuttle.requested) {
          await tx.upsertShuttle({
            applicationId: saved.application.id,
            applicationItemId: item.item.id,
            pickupLocation: record.shuttle.pickupLocation,
            dropoffLocation: record.shuttle.dropoffLocation,
            status: "REQUESTED",
          });
        }
      } else result.reviewOnly += 1;

      await tx.createAudit({
        seasonId: season.id,
        offeringId: safeForItem ? offering.id : null,
        applicationId: saved.application.id,
        actorType: "SYSTEM",
        action: saved.created ? "APPLICATION_IMPORTED" : "APPLICATION_IMPORT_REPLAYED",
        afterJSON: { source, sourceRowRef: record.sourceRowRef, requiresReview, reviewReasons, itemCreated: safeForItem },
      });
    }
    return result;
  });
}

async function createPrismaAdapter() {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  return {
    disconnect: () => prisma.$disconnect(),
    transaction: (work) => prisma.$transaction((client) => work({
      findSeasonBySlug: (slug) => client.specialProgramSeason.findUnique({ where: { slug }, select: { id: true } }),
      findOfferings: (seasonId, codes) => client.specialProgramOffering.findMany({ where: { seasonId, code: { in: codes } }, select: { id: true, code: true, title: true } }),
      upsertApplication: async (data) => {
        const bySource = await client.specialProgramApplication.findUnique({
          where: { seasonId_importSource_sourceRowRef: { seasonId: data.seasonId, importSource: data.importSource, sourceRowRef: data.sourceRowRef } },
          select: { id: true },
        });
        const byKey = await client.specialProgramApplication.findUnique({
          where: { seasonId_idempotencyKey: { seasonId: data.seasonId, idempotencyKey: data.idempotencyKey } },
          select: { id: true },
        });
        if (bySource && byKey && bySource.id !== byKey.id) throw new Error("적용 차단: 원본 행과 중복 방지 키가 서로 다른 신청을 가리킵니다.");
        const existing = bySource ?? byKey;
        const application = existing
          ? await client.specialProgramApplication.update({ where: { id: existing.id }, data, select: { id: true } })
          : await client.specialProgramApplication.create({ data, select: { id: true } });
        return { application, created: !existing };
      },
      upsertItem: async (data) => {
        const existing = await client.specialProgramApplicationItem.findUnique({ where: { applicationId_offeringId: { applicationId: data.applicationId, offeringId: data.offeringId } }, select: { id: true } });
        const item = await client.specialProgramApplicationItem.upsert({
          where: { applicationId_offeringId: { applicationId: data.applicationId, offeringId: data.offeringId } },
          create: data,
          update: data,
          select: { id: true },
        });
        return { item, created: !existing };
      },
      upsertShuttle: (data) => client.specialProgramShuttleRequest.upsert({ where: { applicationItemId: data.applicationItemId }, create: data, update: data }),
      createAudit: (data) => client.specialProgramAuditLog.create({ data }),
    })),
  };
}

export async function createDirectPgAdapter({ connectionString, clientFactory } = {}) {
  if (!clean(connectionString)) throw new Error("적용 차단: DIRECT_URL 또는 DATABASE_URL이 필요합니다.");
  let factory = clientFactory;
  if (!factory) {
    const { Client } = await import("pg");
    factory = (config) => new Client(config);
  }
  const client = factory({ connectionString, ssl: { rejectUnauthorized: true }, application_name: "stiz-seasonal-direct-import" });
  await client.connect();

  const one = async (text, values) => (await client.query(text, values)).rows[0] ?? null;
  const many = async (text, values) => (await client.query(text, values)).rows;
  const tx = {
    findSeasonBySlug: (slug) => one('SELECT id FROM "SpecialProgramSeason" WHERE slug = $1 LIMIT 1', [slug]),
    findOfferings: (seasonId, codes) => codes.length === 0
      ? Promise.resolve([])
      : many('SELECT id, code, title FROM "SpecialProgramOffering" WHERE "seasonId" = $1 AND code = ANY($2::text[])', [seasonId, codes]),
    findExisting: async ({ seasonId, importSource, sourceRowRef, idempotencyKey }) => {
      const rows = await many(
        'SELECT id, "importSource", "sourceRowRef", "idempotencyKey" FROM "SpecialProgramApplication" WHERE "seasonId" = $1 AND (("importSource" = $2 AND "sourceRowRef" = $3) OR "idempotencyKey" = $4)',
        [seasonId, importSource, sourceRowRef, idempotencyKey],
      );
      const bySource = rows.find((row) => row.importSource === importSource && row.sourceRowRef === sourceRowRef);
      const byKey = rows.find((row) => row.idempotencyKey === idempotencyKey);
      if (bySource && byKey && bySource.id !== byKey.id) throw new Error("적용 차단: 원본 행과 중복 방지 키가 서로 다른 신청을 가리킵니다.");
      return bySource ?? byKey ?? null;
    },
    upsertApplication: async (data) => {
      const existing = await tx.findExisting(data);
      const columns = [
        "seasonId", "idempotencyKey", "importSource", "sourceRowRef", "applicantType", "selectedWeekdays",
        "requiresReview", "reviewReasons", "childName", "childBirthDate", "childGender", "childGrade",
        "childSchool", "childPhone", "parentName", "parentPhone", "parentRelation", "address", "memo", "agreedTerms",
        "agreedPrivacy", "status", "totalPriceSnapshot",
      ];
      const values = columns.map((column) => data[column]);
      let application;
      if (existing) {
        const assignments = columns.map((column, index) => `"${column}" = $${index + 1}`).join(", ");
        application = await one(`UPDATE "SpecialProgramApplication" SET ${assignments}, "updatedAt" = NOW() WHERE id = $${values.length + 1} RETURNING id`, [...values, existing.id]);
      } else {
        const names = columns.map((column) => `"${column}"`).join(", ");
        const placeholders = columns.map((_, index) => `$${index + 1}`).join(", ");
        application = await one(`INSERT INTO "SpecialProgramApplication" (${names}) VALUES (${placeholders}) RETURNING id`, values);
      }
      return { application, created: !existing };
    },
    upsertItem: async (data) => {
      const existing = await one('SELECT id FROM "SpecialProgramApplicationItem" WHERE "applicationId" = $1 AND "offeringId" = $2 LIMIT 1', [data.applicationId, data.offeringId]);
      const values = [data.applicationId, data.offeringId, data.priceSnapshot, data.titleSnapshot, data.status];
      const item = existing
        ? await one('UPDATE "SpecialProgramApplicationItem" SET "priceSnapshot" = $3, "titleSnapshot" = $4, status = $5, "updatedAt" = NOW() WHERE "applicationId" = $1 AND "offeringId" = $2 RETURNING id', values)
        : await one('INSERT INTO "SpecialProgramApplicationItem" ("applicationId", "offeringId", "priceSnapshot", "titleSnapshot", status) VALUES ($1, $2, $3, $4, $5) RETURNING id', values);
      return { item, created: !existing };
    },
    upsertShuttle: async (data) => one(
      'INSERT INTO "SpecialProgramShuttleRequest" ("applicationId", "applicationItemId", "pickupLocation", "dropoffLocation", status) VALUES ($1, $2, $3, $4, $5) ON CONFLICT ("applicationItemId") DO UPDATE SET "applicationId" = EXCLUDED."applicationId", "pickupLocation" = EXCLUDED."pickupLocation", "dropoffLocation" = EXCLUDED."dropoffLocation", status = EXCLUDED.status, "updatedAt" = NOW() RETURNING id',
      [data.applicationId, data.applicationItemId, data.pickupLocation, data.dropoffLocation, data.status],
    ),
    createAudit: (data) => one(
      'INSERT INTO "SpecialProgramAuditLog" ("seasonId", "offeringId", "applicationId", "actorType", action, "afterJSON") VALUES ($1, $2, $3, $4, $5, $6::jsonb) RETURNING id',
      [data.seasonId, data.offeringId, data.applicationId, data.actorType, data.action, JSON.stringify(data.afterJSON)],
    ),
  };

  return {
    disconnect: () => client.end(),
    transaction: async (work) => {
      await client.query("BEGIN");
      try {
        const result = await work(tx);
        await client.query("COMMIT");
        return result;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    },
  };
}

function argValue(args, name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

export async function runCli(args = process.argv.slice(2), env = process.env) {
  const input = argValue(args, "--input");
  const seasonSlug = argValue(args, "--season-slug");
  if (!input || !seasonSlug) throw new Error("사용법: --input <json|csv> --season-slug <slug> [--apply --confirm <token>]");
  const result = analyzeSeasonalRows(await loadRows(resolve(input)), { seasonSlug });
  console.log(JSON.stringify(result.summary, null, 2));

  if (!args.includes("--apply")) {
    console.log("DRY-RUN 완료: DB에는 아무것도 저장하지 않았습니다.");
    return result;
  }
  assertApplyAllowed(args, env, result.summary);
  const offeringMap = await loadOfferingMap(argValue(args, "--offering-map"));
  const adapter = args.includes("--direct-pg")
    ? await createDirectPgAdapter({ connectionString: env.DIRECT_URL || env.DATABASE_URL })
    : await createPrismaAdapter();
  try {
    const applied = await applySeasonalImport({
      adapter,
      seasonSlug,
      source: argValue(args, "--source"),
      records: result.records,
      offeringMap,
      allowReview: args.includes("--allow-review"),
    });
    console.log(JSON.stringify({ applied }, null, 2));
  } finally {
    await adapter.disconnect();
  }
}

export function assertApplyAllowed(args, env, summary) {
  const expected = clean(env.SEASONAL_IMPORT_CONFIRM_TOKEN);
  const provided = clean(argValue(args, "--confirm"));
  const matches = expected && provided && expected.length === provided.length && timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
  if (!matches) throw new Error("적용 차단: SEASONAL_IMPORT_CONFIRM_TOKEN과 일치하는 --confirm 토큰이 필요합니다.");
  if (summary.requiresReview > 0 && !args.includes("--allow-review")) throw new Error("적용 차단: 확인이 필요한 신청이 남아 있습니다.");
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  runCli().catch((error) => {
    const message = clean(error?.message);
    const safeMessage = /^(적용 차단|사용법|CSV |입력 데이터|--season-slug)/.test(message)
      ? message
      : "처리 중 오류가 발생해 트랜잭션을 롤백했습니다. 상세 오류는 개인정보 보호를 위해 출력하지 않습니다.";
    console.error(`방학특강 가져오기 실패: ${safeMessage}`);
    process.exitCode = 1;
  });
}
