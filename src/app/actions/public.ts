"use server";

/**
 * 怨듦컻 Server Actions ??濡쒓렇???놁씠 ?묎렐 媛?? * admin.ts? 遺꾨━: requireAdmin() ?놁쓬
 * 泥댄뿕?섏뾽 ?좎껌 ????鍮꾪쉶?먯씠 ?ъ슜?섎뒗 湲곕뒫
 */

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { ensureTrialLeadTable } from "@/app/actions/admin";
import { notifyAdmins } from "@/lib/notification";
import {
    issueEnrollmentAccountHandoff,
} from "@/lib/enrollment-account-handoff";
import { SHUTTLE_LOCATION_CONSENT_VERSION } from "@/lib/seasonal/contracts";

async function issueEnrollmentAccountHandoffSafely(enrollmentApplicationId: string) {
    try {
        return await issueEnrollmentAccountHandoff(enrollmentApplicationId);
    } catch (error) {
        console.error("[enrollment handoff] issue failed:", error);
        return null;
    }
}

// ?? EnrollmentApplication DDL ensure (idempotent) ???????????????????????????
let _enrollTableEnsured = false;
export async function ensureEnrollmentApplicationTable() {
    if (_enrollTableEnsured) return;
    try {
        await prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "EnrollmentApplication" (
                id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
                "trialLeadId" TEXT,
                "childName" TEXT NOT NULL,
                "childBirthDate" TIMESTAMPTZ NOT NULL,
                "childGender" TEXT,
                "childGrade" TEXT,
                "childSchool" TEXT,
                "childPhone" TEXT,
                "parentName" TEXT NOT NULL,
                "parentPhone" TEXT NOT NULL,
                "parentRelation" TEXT,
                address TEXT,
                "enrollmentMonths" TEXT,
                "preferredSlotKeys" TEXT,
                "assignedClassId" TEXT,
                "basketballExp" TEXT,
                "uniformSize" TEXT,
                "shuttleNeeded" BOOLEAN DEFAULT false,
                "shuttlePickup" TEXT,
                "shuttleTime" TEXT,
                "shuttleDropoff" TEXT,
                "paymentMethod" TEXT,
                "referralSource" TEXT,
                memo TEXT,
                "agreedTerms" BOOLEAN DEFAULT false,
                "agreedPrivacy" BOOLEAN DEFAULT false,
                "applicationNoticeConfirmed" BOOLEAN DEFAULT false,
                "shuttleNoticeConfirmed" BOOLEAN DEFAULT false,
                status TEXT DEFAULT 'PENDING',
                "processedAt" TIMESTAMPTZ,
                "processedNote" TEXT,
                "convertedStudentId" TEXT,
                "createdAt" TIMESTAMPTZ DEFAULT NOW(),
                "updatedAt" TIMESTAMPTZ DEFAULT NOW()
            )
        `);
        // ?몃뜳???앹꽦 (?곹깭蹂?trialLeadId/?앹꽦???꾪꽣 理쒖쟻??
        await prisma.$executeRawUnsafe(
            `CREATE INDEX IF NOT EXISTS "EnrollmentApplication_status_idx" ON "EnrollmentApplication" (status)`
        );
        await prisma.$executeRawUnsafe(
            `CREATE INDEX IF NOT EXISTS "EnrollmentApplication_trialLeadId_idx" ON "EnrollmentApplication" ("trialLeadId")`
        );
        await prisma.$executeRawUnsafe(
            `CREATE INDEX IF NOT EXISTS "EnrollmentApplication_createdAt_idx" ON "EnrollmentApplication" ("createdAt")`
        );
        const extendedColumns: [string, string][] = [
            ['"enrollmentMonths"', "TEXT"],
            ['"applicationNoticeConfirmed"', "BOOLEAN DEFAULT false"],
            ['"shuttleNoticeConfirmed"', "BOOLEAN DEFAULT false"],
            ['"shuttlePickupAddress"', "TEXT"],
            ['"shuttlePickupRoadAddress"', "TEXT"],
            ['"shuttlePickupLatitude"', "DOUBLE PRECISION"],
            ['"shuttlePickupLongitude"', "DOUBLE PRECISION"],
            ['"shuttlePickupPlaceId"', "TEXT"],
            ['"shuttlePickupSource"', "TEXT"],
            ['"shuttlePickupAccuracyMeters"', "DOUBLE PRECISION"],
            ['"shuttlePickupConfirmedAt"', "TIMESTAMPTZ"],
            ['"shuttleDropoffAddress"', "TEXT"],
            ['"shuttleDropoffRoadAddress"', "TEXT"],
            ['"shuttleDropoffLatitude"', "DOUBLE PRECISION"],
            ['"shuttleDropoffLongitude"', "DOUBLE PRECISION"],
            ['"shuttleDropoffPlaceId"', "TEXT"],
            ['"shuttleDropoffSource"', "TEXT"],
            ['"shuttleDropoffAccuracyMeters"', "DOUBLE PRECISION"],
            ['"shuttleDropoffConfirmedAt"', "TIMESTAMPTZ"],
            ['"shuttleLocationConsentVersion"', "TEXT"],
            ['"shuttleLocationConsentAt"', "TIMESTAMPTZ"],
        ];
        for (const [col, type] of extendedColumns) {
            await prisma.$executeRawUnsafe(
                `ALTER TABLE "EnrollmentApplication" ADD COLUMN IF NOT EXISTS ${col} ${type}`
            );
        }
    } catch (e) {
        console.warn("[DDL] EnrollmentApplication ensure failed:", (e as Error).message);
    }
    _enrollTableEnsured = true;
}

// ?? 泥댄뿕?섏뾽 ?좎껌 ?낅젰 ?????????????????????????????????????????????????????
interface TrialApplicationInput {
    existingId?: string;
    trialDate?: string;
    trialDay?: string;
    trialPeriod?: string;
    childName: string;
    childBirthDate?: string;     // ?댁쟾 ?먯껜 ???명솚
    childGrade: string;
    childGender?: string;
    childSchool?: string;
    basketballExp?: string;
    parentName?: string;
    parentPhone: string;
    preferredSlotKey?: string;    // ?щ쭩 ?щ’ "Mon-4"
    hopeNote?: string;
    source: string;               // 媛??寃쎈줈
    trialFeeConfirmed?: boolean;
    agreedTerms?: boolean;
    agreedPrivacy?: boolean;
    honeypot?: string;            // ?ㅽ뙵 諛⑹?????鍮덇컪?댁뼱???뺤긽
}

// ?? ?꾪솕踰덊샇 ?뺢퇋????????????????????????????????????????????????????????????
// 010-1234-5678, 01012345678, 010 1234 5678 ???ㅼ뼇???뺥깭瑜?010-1234-5678濡??듭씪
function normalizePhone(raw: string): string {
    const digits = raw.replace(/\D/g, "");
    if (digits.length === 11 && digits.startsWith("010")) {
        return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
    }
    return raw.trim();
}

const TRIAL_DAY_KEY_BY_LABEL: Record<string, string> = {
    월: "Mon",
    화: "Tue",
    수: "Wed",
    목: "Thu",
    금: "Fri",
    토: "Sat",
    일: "Sun",
};

function resolveTrialSlotKey(data: TrialApplicationInput): string | null {
    const directSlotKey = data.preferredSlotKey?.trim();
    if (directSlotKey) return directSlotKey;

    const dayKey = TRIAL_DAY_KEY_BY_LABEL[data.trialDay?.trim() || ""];
    const period = data.trialPeriod?.trim();
    if (!dayKey || !period) return null;

    return `${dayKey}-${period}`;
}

function dateInputValue(value: unknown): string | null {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(String(value));
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString().slice(0, 10);
}

function csvToList(value: unknown): string[] {
    if (!value) return [];
    return String(value).split(",").map((item) => item.trim()).filter(Boolean);
}

function rowValue<T = string>(row: any, camelKey: string, lowerKey: string): T | null {
    return (row?.[camelKey] ?? row?.[lowerKey] ?? null) as T | null;
}

function activeTrialDuplicateWhereClause() {
    return `status IN ('NEW', 'CONTACTED', 'SCHEDULED')`;
}

export interface ExistingTrialApplicationForEdit {
    id: string;
    trialDate: string | null;
    trialDay: string | null;
    trialPeriod: string | null;
    childName: string;
    childGrade: string | null;
    childGender: string | null;
    childSchool: string | null;
    parentName: string | null;
    parentPhone: string;
    source: string | null;
    trialFeeConfirmed: boolean;
}

export async function findExistingTrialApplicationForEdit(input: {
    childName?: string;
    parentPhone?: string;
}): Promise<ExistingTrialApplicationForEdit | null> {
    const childName = input.childName?.trim();
    const phoneDigits = input.parentPhone?.replace(/\D/g, "") || "";
    if (!childName || phoneDigits.length < 10 || phoneDigits.length > 11) return null;

    await ensureTrialLeadTable();
    const rows = await prisma.$queryRawUnsafe<any[]>(
        `SELECT id, "trialDate", "scheduledDate", "preferredDay", "preferredPeriod",
                "childName", "childGrade", "childGender", "childSchool",
                "parentName", "parentPhone", source, "trialFeeConfirmed"
           FROM "TrialLead"
          WHERE LOWER(TRIM("childName")) = LOWER($1)
            AND regexp_replace(COALESCE("parentPhone", ''), '[^0-9]', '', 'g') = $2
            AND ${activeTrialDuplicateWhereClause()}
          ORDER BY "updatedAt" DESC, "createdAt" DESC
          LIMIT 1`,
        childName,
        phoneDigits,
    );

    const row = rows[0];
    if (!row) return null;

    return {
        id: row.id,
        trialDate: dateInputValue(rowValue(row, "trialDate", "trialdate") ?? rowValue(row, "scheduledDate", "scheduleddate")),
        trialDay: rowValue(row, "preferredDay", "preferredday"),
        trialPeriod: rowValue(row, "preferredPeriod", "preferredperiod"),
        childName: rowValue(row, "childName", "childname") || childName,
        childGrade: rowValue(row, "childGrade", "childgrade"),
        childGender: rowValue(row, "childGender", "childgender"),
        childSchool: rowValue(row, "childSchool", "childschool"),
        parentName: rowValue(row, "parentName", "parentname"),
        parentPhone: rowValue(row, "parentPhone", "parentphone") || normalizePhone(input.parentPhone || ""),
        source: row.source ?? null,
        trialFeeConfirmed: Boolean(rowValue(row, "trialFeeConfirmed", "trialfeeconfirmed")),
    };
}

/**
 * submitTrialApplication ??泥댄뿕?섏뾽 ?좎껌 (怨듦컻, 鍮꾨줈洹몄씤)
 *
 * 寃利??ы빆:
 * 1. honeypot ?꾨뱶媛 鍮꾩뼱?덉뼱????(?ㅽ뙵遊?李⑤떒)
 * 2. ?대쫫, ?꾪솕踰덊샇 ?꾩닔
 * 3. ?쎄? ?숈쓽 ?꾩닔
 */
export async function submitTrialApplication(data: TrialApplicationInput) {
    // ?ㅽ뙵遊?李⑤떒: honeypot ?꾨뱶??媛믪씠 ?덉쑝硫?遊뉗쑝濡??먮떒
    if (data.honeypot) {
        // 遊뉗뿉寃뚮뒗 ?깃났??寃껋쿂??蹂댁뿬以?(遊뉗씠 ?ㅼ떆 ?쒕룄?섏? ?딅룄濡?
        return { success: true, id: "ok" };
    }

    const childName = data.childName?.trim();
    const parentName = data.parentName?.trim() || "미입력";
    const parentPhone = data.parentPhone?.trim();

    if (!data.trialDate) throw new Error("체험수업 희망일을 선택해주세요.");
    if (!data.trialDay) throw new Error("요일을 선택해주세요.");
    if (!data.trialPeriod) throw new Error("교시를 선택해주세요.");
    if (!childName) throw new Error("아이 이름을 입력해주세요.");
    if (!data.childGender) throw new Error("성별을 선택해주세요.");
    if (!data.childSchool?.trim()) throw new Error("학교를 입력해주세요.");
    if (!data.childGrade) throw new Error("학년을 선택해주세요.");
    if (!parentPhone) throw new Error("학부모 연락처를 입력해주세요.");
    if (!data.source) throw new Error("신청경로를 선택해주세요.");
    if (!data.trialFeeConfirmed) throw new Error("체험수업 비용 확인을 체크해주세요.");

    // ?꾪솕踰덊샇 ?뺤떇 寃利?(?レ옄留?異붿텧 ??11?먮━ ?뺤씤)
    const phoneDigits = parentPhone.replace(/\D/g, "");
    if (phoneDigits.length < 10 || phoneDigits.length > 11) {
        throw new Error("올바른 전화번호를 입력해주세요.");
    }

    // DDL ensure ???뚯씠釉?而щ읆???놁쑝硫??먮룞 ?앹꽦
    await ensureTrialLeadTable();

    try {
        const normalizedParentPhone = normalizePhone(parentPhone);
        const preferredSlotKey = resolveTrialSlotKey(data);
        const normalizedPhoneDigits = normalizedParentPhone.replace(/\D/g, "");

        const existingRows = data.existingId
            ? await prisma.$queryRawUnsafe<{ id: string }[]>(
                `SELECT id
                   FROM "TrialLead"
                  WHERE id = $1
                    AND LOWER(TRIM("childName")) = LOWER($2)
                    AND regexp_replace(COALESCE("parentPhone", ''), '[^0-9]', '', 'g') = $3
                    AND ${activeTrialDuplicateWhereClause()}
                  LIMIT 1`,
                data.existingId,
                childName,
                normalizedPhoneDigits,
            )
            : await prisma.$queryRawUnsafe<{ id: string }[]>(
                `SELECT id
                   FROM "TrialLead"
                  WHERE LOWER(TRIM("childName")) = LOWER($1)
                    AND regexp_replace(COALESCE("parentPhone", ''), '[^0-9]', '', 'g') = $2
                    AND ${activeTrialDuplicateWhereClause()}
                  ORDER BY "updatedAt" DESC, "createdAt" DESC
                  LIMIT 1`,
                childName,
                normalizedPhoneDigits,
            );

        const existingId = existingRows[0]?.id;
        if (existingId) {
            await prisma.$executeRawUnsafe(
                `UPDATE "TrialLead" SET
                    "childAge" = $1,
                    "childBirthDate" = $2::timestamptz,
                    "childGrade" = $3,
                    "childGender" = $4,
                    "childSchool" = $5,
                    "basketballExp" = $6,
                    "parentName" = $7,
                    "parentPhone" = $8,
                    "scheduledDate" = $9::timestamptz,
                    "preferredDays" = $10,
                    "preferredSlotKey" = $11,
                    "preferredDay" = $12,
                    "preferredPeriod" = $13,
                    "trialDate" = $14::timestamptz,
                    "hopeNote" = $15,
                    source = $16,
                    "trialFeeConfirmed" = $17,
                    "agreedTerms" = $18,
                    "agreedPrivacy" = $19,
                    "updatedAt" = NOW()
                  WHERE id = $20`,
                data.childGrade || null,
                data.childBirthDate || null,
                data.childGrade || null,
                data.childGender || null,
                data.childSchool?.trim() || null,
                data.basketballExp || null,
                parentName,
                normalizedParentPhone,
                data.trialDate || null,
                data.trialDay || null,
                preferredSlotKey,
                data.trialDay || null,
                data.trialPeriod || null,
                data.trialDate || null,
                data.hopeNote?.trim() || null,
                data.source || "WEBSITE",
                data.trialFeeConfirmed ?? false,
                data.agreedTerms ?? false,
                data.agreedPrivacy ?? false,
                existingId,
            );

            revalidatePath("/admin");
            revalidatePath("/admin/apply");
            revalidatePath("/admin/trial");
            return { success: true, id: existingId, mode: "updated" as const, duplicate: true };
        }

        const recentSubmissions = await prisma.$queryRawUnsafe<{ count: number }[]>(
            `SELECT COUNT(*)::int AS count
               FROM "TrialLead"
              WHERE regexp_replace(COALESCE("parentPhone", ''), '[^0-9]', '', 'g') = $1
                AND "createdAt" > NOW() - INTERVAL '10 minutes'`,
            normalizedPhoneDigits,
        );
        if (Number(recentSubmissions[0]?.count ?? 0) >= 5) {
            throw new Error("신청이 너무 많이 접수되었습니다. 잠시 후 다시 시도해주세요.");
        }

        // TrialLead INSERT ??status='NEW'濡??앹꽦
        const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(
            `INSERT INTO "TrialLead" (
                id, "childName", "childAge", "childBirthDate", "childGrade", "childGender", "childSchool",
                "basketballExp", "parentName", "parentPhone",
                "scheduledDate", "preferredDays", "preferredSlotKey", "preferredDay", "preferredPeriod", "trialDate",
                "hopeNote", source, "trialFeeConfirmed",
                "agreedTerms", "agreedPrivacy",
                status, "createdAt", "updatedAt"
            ) VALUES (
                gen_random_uuid()::text, $1, $2, $3::timestamptz, $4, $5, $6,
                $7, $8, $9,
                $10::timestamptz, $11, $12, $13, $14, $15::timestamptz,
                $16, $17, $18,
                $19, $20,
                'NEW', NOW(), NOW()
            ) RETURNING id`,
            childName,
            data.childGrade || null,                              // childAge???숇뀈 ???(湲곗〈 ?명솚)
            data.childBirthDate || null,                          // childBirthDate
            data.childGrade || null,                              // childGrade
            data.childGender || null,                             // childGender
            data.childSchool?.trim() || null,                     // childSchool
            data.basketballExp || null,                           // basketballExp
            parentName,
            normalizedParentPhone,
            data.trialDate || null,                               // scheduledDate
            data.trialDay || null,                                // preferredDays
            preferredSlotKey,                                      // preferredSlotKey
            data.trialDay || null,                                // preferredDay
            data.trialPeriod || null,                             // preferredPeriod
            data.trialDate || null,                               // trialDate
            data.hopeNote?.trim() || null,                        // hopeNote
            data.source || "WEBSITE",                             // source
            data.trialFeeConfirmed ?? false,                      // trialFeeConfirmed
            data.agreedTerms ?? false,                            // agreedTerms
            data.agreedPrivacy ?? false,                          // agreedPrivacy
        );

        // 愿由ъ옄 ?섏씠吏 罹먯떆 臾댄슚??(???좎껌??諛붾줈 蹂댁씠?꾨줉)
        revalidatePath("/admin/trial");
        revalidatePath("/admin");
        revalidatePath("/admin/apply");
        revalidatePath("/admin/trial");

        // SMS ?쒗뵆由?蹂????愿由ъ옄/肄붿튂/?숇?紐?怨듯넻?쇰줈 ?ъ슜
        const smsVars = {
            childName,
            childGrade: data.childGrade || "학년 미입력",
            parentName,
            parentPhone: normalizedParentPhone,
        };
        const trialLeadId = rows[0]?.id || "ok";

        // 愿由ъ옄/?숇?紐?臾몄옄 諛쒖넚? ?좎껌 ?????蹂묐젹 泥섎━?쒕떎.
        // ?ㅽ뙣?대룄 ?좎껌 ?먯껜???좎??섎ŉ, 諛쒖넚 寃곌낵??NotificationDelivery???④릿??
        // ?쒗뵆由?湲곕컲 SMS: TRIAL_NEW_ADMIN(愿由ъ옄), TRIAL_NEW_COACH(肄붿튂)
        // slotKeys: ?щ쭩 ?щ’???덉쑝硫??대떦 ?щ’ ?대떦 肄붿튂?먭쾶留?SMS 諛쒖넚
        await Promise.allSettled([
            notifyAdmins(
                "TRIAL_APPLICATION",
                "체험수업 신청",
                `${childName} (${data.childGrade || "학년 미입력"}) - ${parentName}`,
                "/admin/trial",
                {
                    adminTrigger: "TRIAL_NEW_ADMIN",
                    coachTrigger: "TRIAL_NEW_COACH",
                    notifyCoaches: false,
                    variables: smsVars,
                    slotKeys: preferredSlotKey ? [preferredSlotKey] : undefined,
                    eventId: trialLeadId,
                },
            ),

            // ?숇?紐⑥뿉寃??묒닔 ?뺤씤 SMS 諛쒖넚. academyPhone? DB?먯꽌 議고쉶?섏뿬 ?ы븿?쒕떎.
            sendParentSmsWithAcademyPhone(
                normalizedParentPhone,
                "TRIAL_CONFIRM_PARENT",
                { childName, parentName },
                { eventType: "TRIAL_APPLICATION", eventId: trialLeadId },
            ),
        ]);

        return { success: true, id: trialLeadId, mode: "created" as const };
    } catch (e) {
        console.error("[submitTrialApplication] failed:", e);
        throw new Error("신청 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    }
}

// ?? 鍮덉옄由??щ’ 議고쉶 ???????????????????????????????????????????????????????
export interface AvailableSlot {
    slotKey: string;
    dayOfWeek: string;      // "Mon", "Tue", ...
    dayLabel: string;       // "??, "??, ...
    className: string;      // ?섏뾽 ?대쫫
    startTime: string;
    endTime: string;
    capacity: number;
    enrolled: number;
    available: number;      // capacity - enrolled
}

// ?붿씪 肄붾뱶 ???쒓? ?쇰꺼 留ㅽ븨
const DAY_LABELS: Record<string, string> = {
    Mon: "월",
    Tue: "화",
    Wed: "수",
    Thu: "목",
    Fri: "금",
    Sat: "토",
    Sun: "일",
};

/**
 * getAvailableTrialSlots ??鍮덉옄由??덈뒗 ?섏뾽 ?щ’ 紐⑸줉 (怨듦컻??
 *
 * Class ?뚯씠釉붿뿉??Enrollment(ACTIVE) ?섎? ?멸퀬,
 * capacity - enrolled > 0 ???щ’留?諛섑솚
 */
export async function getAvailableTrialSlots(): Promise<AvailableSlot[]> {
    try {
        const rows = await prisma.$queryRawUnsafe<any[]>(`
            SELECT
                c."slotKey",
                c."dayOfWeek",
                c.name AS class_name,
                c."startTime",
                c."endTime",
                c.capacity,
                COUNT(CASE WHEN e.status = 'ACTIVE' THEN 1 END)::int AS enrolled
            FROM "Class" c
            LEFT JOIN "Enrollment" e ON c.id = e."classId"
            WHERE c."slotKey" IS NOT NULL
            GROUP BY c.id
            ORDER BY
                CASE c."dayOfWeek"
                    WHEN 'Mon' THEN 1
                    WHEN 'Tue' THEN 2
                    WHEN 'Wed' THEN 3
                    WHEN 'Thu' THEN 4
                    WHEN 'Fri' THEN 5
                    WHEN 'Sat' THEN 6
                    WHEN 'Sun' THEN 7
                END,
                c."startTime"
        `);

        return rows.map((r) => ({
            slotKey: r.slotKey ?? r.slotkey,
            dayOfWeek: r.dayOfWeek ?? r.dayofweek,
            dayLabel: DAY_LABELS[(r.dayOfWeek ?? r.dayofweek)] || (r.dayOfWeek ?? r.dayofweek),
            className: r.class_name,
            startTime: r.startTime ?? r.starttime,
            endTime: r.endTime ?? r.endtime,
            capacity: r.capacity,
            enrolled: r.enrolled,
            available: r.capacity - r.enrolled,
        }));
    } catch (e) {
        console.error("[getAvailableTrialSlots] failed:", e);
        return [];
    }
}

// ?? ?섍컯 ?좎껌 ?낅젰 ?????????????????????????????????????????????????????????
export interface EnrollmentShuttleLocationData {
    address: string;
    roadAddress?: string;
    latitude: number;
    longitude: number;
    placeId?: string;
    source: "MAP_PIN" | "SEARCH" | "CURRENT_LOCATION";
    accuracyMeters?: number;
    confirmedAt?: string;
}

interface EnrollApplicationInput {
    existingId?: string;
    accessCode?: string;         // 만료·활성 검증을 거치는 체험 연동 코드
    childName: string;
    childBirthDate: string;      // ISO 臾몄옄??"2018-05-15"
    childGender?: string;
    childGrade?: string;
    childSchool?: string;
    childPhone?: string;
    parentName: string;
    parentPhone: string;
    parentRelation?: string;
    address?: string;
    enrollmentMonths?: string;   // 肄ㅻ쭏 援щ텇 "2026??7??2026??8??
    preferredSlotKeys?: string;  // 肄ㅻ쭏 援щ텇 "Mon-4,Wed-6"
    basketballExp?: string;      // ?띻뎄 寃쏀뿕 (?놁쓬/1??誘몃쭔/1~3??3???댁긽)
    uniformSize?: string;
    shuttleNeeded?: boolean;
    shuttlePickup?: string;
    shuttleTime?: string;        // ?뷀? ?щ쭩 ?쒓컙
    shuttleDropoff?: string;     // ?뷀? ?섏감 ?μ냼
    shuttlePickupLocationData?: EnrollmentShuttleLocationData;
    shuttleDropoffLocationData?: EnrollmentShuttleLocationData;
    shuttleLocationConsent?: boolean;
    shuttleLocationConsentVersion?: string;
    paymentMethod?: string;
    referralSource?: string;
    memo?: string;
    agreedTerms: boolean;
    agreedPrivacy: boolean;
    applicationNoticeConfirmed?: boolean;
    shuttleNoticeConfirmed?: boolean;
    honeypot?: string;           // ?ㅽ뙵 諛⑹?????鍮덇컪?댁뼱???뺤긽
}

export interface ExistingEnrollApplicationForEdit {
    id: string;
    editable: boolean;
    childName: string;
    childBirthDate: string | null;
    childGender: string | null;
    childGrade: string | null;
    childSchool: string | null;
    childPhone: string | null;
    parentName: string;
    parentPhone: string;
    parentRelation: string | null;
    address: string | null;
    enrollmentMonths: string[];
    preferredSlotKeys: string[];
    basketballExp: string | null;
    shuttleNeeded: boolean;
    shuttlePickup: string | null;
    shuttleTime: string | null;
    shuttleDropoff: string | null;
    shuttlePickupLocationData: EnrollmentShuttleLocationData | null;
    shuttleDropoffLocationData: EnrollmentShuttleLocationData | null;
    shuttleLocationConsent: boolean;
    shuttleLocationConsentVersion: string | null;
    referralSource: string | null;
    memo: string | null;
    status: string;
}

function normalizeEnrollmentShuttleLocation(
    value: EnrollmentShuttleLocationData | undefined,
    label: string,
): EnrollmentShuttleLocationData {
    const address = value?.address?.trim();
    const latitude = Number(value?.latitude);
    const longitude = Number(value?.longitude);
    const accuracyMeters = value?.accuracyMeters == null ? undefined : Number(value.accuracyMeters);
    const source = value?.source;
    if (
        !address
        || !Number.isFinite(latitude)
        || !Number.isFinite(longitude)
        || latitude < -90
        || latitude > 90
        || longitude < -180
        || longitude > 180
        || !["MAP_PIN", "SEARCH", "CURRENT_LOCATION"].includes(source || "")
        || (accuracyMeters != null && (!Number.isFinite(accuracyMeters) || accuracyMeters < 0 || accuracyMeters > 1_000_000))
    ) {
        throw new Error(`${label} 위치를 지도에서 다시 선택해주세요.`);
    }
    return {
        address,
        roadAddress: value?.roadAddress?.trim() || undefined,
        latitude,
        longitude,
        placeId: value?.placeId?.trim() || undefined,
        source: source as EnrollmentShuttleLocationData["source"],
        accuracyMeters,
        confirmedAt: new Date().toISOString(),
    };
}

function enrollmentLocationFromRow(row: any, prefix: "Pickup" | "Dropoff"): EnrollmentShuttleLocationData | null {
    const address = rowValue(row, `shuttle${prefix}Address`, `shuttle${prefix.toLowerCase()}address`);
    const lat = rowValue(row, `shuttle${prefix}Latitude`, `shuttle${prefix.toLowerCase()}latitude`);
    const lng = rowValue(row, `shuttle${prefix}Longitude`, `shuttle${prefix.toLowerCase()}longitude`);
    const confirmedAt = rowValue(row, `shuttle${prefix}ConfirmedAt`, `shuttle${prefix.toLowerCase()}confirmedat`);
    const source = rowValue(row, `shuttle${prefix}Source`, `shuttle${prefix.toLowerCase()}source`);
    if (
        !address
        || lat == null
        || lng == null
        || !confirmedAt
        || !["MAP_PIN", "SEARCH", "CURRENT_LOCATION"].includes(source || "")
    ) return null;
    return {
        address,
        roadAddress: rowValue(row, `shuttle${prefix}RoadAddress`, `shuttle${prefix.toLowerCase()}roadaddress`) || undefined,
        latitude: Number(lat),
        longitude: Number(lng),
        placeId: rowValue(row, `shuttle${prefix}PlaceId`, `shuttle${prefix.toLowerCase()}placeid`) || undefined,
        source: source as EnrollmentShuttleLocationData["source"],
        accuracyMeters: rowValue(row, `shuttle${prefix}AccuracyMeters`, `shuttle${prefix.toLowerCase()}accuracymeters`) ?? undefined,
        confirmedAt: new Date(confirmedAt).toISOString(),
    };
}

async function resolveTrialLeadIdFromEnrollmentAccess(accessCode?: string | null) {
    if (!accessCode || !/^[A-Za-z0-9_-]{16}$/.test(accessCode)) return null;

    const rows = await prisma.$queryRawUnsafe<Array<{ trialLeadId: string }>>(
        `SELECT "trialLeadId"
           FROM "EnrollmentShortLink"
          WHERE code = $1
            AND "isActive" = true
            AND "expiresAt" > NOW()
          LIMIT 1`,
        accessCode,
    );
    return rows[0]?.trialLeadId ?? null;
}

export async function findExistingEnrollApplicationForEdit(input: {
    accessCode?: string | null;
    childName?: string;
    childBirthDate?: string;
    parentPhone?: string;
}): Promise<ExistingEnrollApplicationForEdit | null> {
    const childName = input.childName?.trim();
    const phoneDigits = input.parentPhone?.replace(/\D/g, "") || "";
    if (!input.accessCode && (!childName || phoneDigits.length < 10 || phoneDigits.length > 11)) return null;

    await ensureEnrollmentApplicationTable();
    const trialLeadId = await resolveTrialLeadIdFromEnrollmentAccess(input.accessCode);

    const rows = trialLeadId
        ? await prisma.$queryRawUnsafe<any[]>(
            `SELECT *
               FROM "EnrollmentApplication"
              WHERE "trialLeadId" = $1
                AND status IN ('PENDING', 'APPROVED')
              ORDER BY "updatedAt" DESC, "createdAt" DESC
              LIMIT 1`,
            trialLeadId,
        )
        : await prisma.$queryRawUnsafe<any[]>(
            `SELECT *
               FROM "EnrollmentApplication"
              WHERE LOWER(TRIM("childName")) = LOWER($1)
                AND regexp_replace(COALESCE("parentPhone", ''), '[^0-9]', '', 'g') = $2
                AND ($3::date IS NULL OR "childBirthDate"::date = $3::date)
                AND status IN ('PENDING', 'APPROVED')
              ORDER BY
                CASE status WHEN 'PENDING' THEN 1 ELSE 2 END,
                "updatedAt" DESC,
                "createdAt" DESC
              LIMIT 1`,
            childName,
            phoneDigits,
            input.childBirthDate || null,
        );

    const row = rows[0];
    if (!row) return null;
    const status = row.status || "PENDING";

    return {
        id: row.id,
        editable: status === "PENDING",
        childName: rowValue(row, "childName", "childname") || childName || "",
        childBirthDate: dateInputValue(rowValue(row, "childBirthDate", "childbirthdate")),
        childGender: rowValue(row, "childGender", "childgender"),
        childGrade: rowValue(row, "childGrade", "childgrade"),
        childSchool: rowValue(row, "childSchool", "childschool"),
        childPhone: rowValue(row, "childPhone", "childphone"),
        parentName: rowValue(row, "parentName", "parentname") || "",
        parentPhone: rowValue(row, "parentPhone", "parentphone") || normalizePhone(input.parentPhone || ""),
        parentRelation: rowValue(row, "parentRelation", "parentrelation"),
        address: row.address ?? null,
        enrollmentMonths: csvToList(rowValue(row, "enrollmentMonths", "enrollmentmonths")),
        preferredSlotKeys: csvToList(rowValue(row, "preferredSlotKeys", "preferredslotkeys")),
        basketballExp: rowValue(row, "basketballExp", "basketballexp"),
        shuttleNeeded: Boolean(rowValue(row, "shuttleNeeded", "shuttleneeded")),
        shuttlePickup: rowValue(row, "shuttlePickup", "shuttlepickup"),
        shuttleTime: rowValue(row, "shuttleTime", "shuttletime"),
        shuttleDropoff: rowValue(row, "shuttleDropoff", "shuttledropoff"),
        shuttlePickupLocationData: enrollmentLocationFromRow(row, "Pickup"),
        shuttleDropoffLocationData: enrollmentLocationFromRow(row, "Dropoff"),
        shuttleLocationConsent: Boolean(rowValue(row, "shuttleLocationConsentAt", "shuttlelocationconsentat")),
        shuttleLocationConsentVersion: rowValue(row, "shuttleLocationConsentVersion", "shuttlelocationconsentversion"),
        referralSource: rowValue(row, "referralSource", "referralsource"),
        memo: row.memo ?? null,
        status,
    };
}

/**
 * submitEnrollApplication ???섍컯 ?좎껌 (怨듦컻, 鍮꾨줈洹몄씤)
 *
 * 寃利??ы빆:
 * 1. honeypot ?꾨뱶媛 鍮꾩뼱?덉뼱????(?ㅽ뙵遊?李⑤떒)
 * 2. ?대쫫, ?앸뀈?붿씪, 蹂댄샇?먯씠由? ?꾪솕踰덊샇 ?꾩닔
 * 3. ?쎄? ?숈쓽 ?꾩닔
 * 4. trialLeadId媛 ?덉쑝硫??대떦 TrialLead 議댁옱 ?щ? ?뺤씤
 */
export async function submitEnrollApplication(data: EnrollApplicationInput) {
    // ?ㅽ뙵遊?李⑤떒: honeypot ?꾨뱶??媛믪씠 ?덉쑝硫?遊뉗쑝濡??먮떒
    if (data.honeypot) {
        return { success: true, id: "ok" };
    }

    const childName = data.childName?.trim();
    const parentName = data.parentName?.trim();
    const parentPhone = data.parentPhone?.trim();
    const shuttlePickupLocation = data.shuttleNeeded
        ? normalizeEnrollmentShuttleLocation(data.shuttlePickupLocationData, "탑승")
        : null;
    const shuttleDropoffLocation = data.shuttleNeeded
        ? normalizeEnrollmentShuttleLocation(data.shuttleDropoffLocationData, "하차")
        : null;
    if (
        data.shuttleNeeded
        && (
            data.shuttleLocationConsent !== true
            || data.shuttleLocationConsentVersion !== SHUTTLE_LOCATION_CONSENT_VERSION
        )
    ) {
        throw new Error("셔틀 위치정보 이용 동의가 필요합니다.");
    }
    const shuttleLocationConsentVersion = data.shuttleNeeded ? SHUTTLE_LOCATION_CONSENT_VERSION : null;
    const shuttleLocationConsentAt = data.shuttleNeeded ? new Date() : null;

    if (!childName) throw new Error("아이 이름을 입력해주세요.");
    if (!data.childBirthDate) throw new Error("아이 생년월일을 입력해주세요.");
    if (!data.childPhone?.trim()) throw new Error("학생 전화번호를 입력해주세요.");
    if (!parentName) throw new Error("보호자 이름을 입력해주세요.");
    if (!parentPhone) throw new Error("보호자 연락처를 입력해주세요.");
    if (!data.childSchool?.trim()) throw new Error("학교명을 입력해주세요.");
    if (!data.enrollmentMonths?.trim()) throw new Error("수강신청 월을 선택해주세요.");
    if (!data.referralSource) throw new Error("가입경로를 선택해주세요.");
    if (data.shuttleNeeded && (!data.shuttlePickup?.trim() || !data.shuttleTime || !data.shuttleDropoff?.trim())) {
        throw new Error("셔틀 탑승을 선택한 경우 탑승 장소, 희망 시간, 하차 장소를 모두 입력해주세요.");
    }
    if (data.shuttleNeeded && !data.shuttleNoticeConfirmed) {
        throw new Error("셔틀 주의사항을 확인해주세요.");
    }
    if (!data.agreedTerms || !data.agreedPrivacy) {
        throw new Error("이용약관과 개인정보 수집/이용에 모두 동의해주세요.");
    }
    if (!data.applicationNoticeConfirmed) {
        throw new Error("수강신청 확정 안내를 확인해주세요.");
    }

    const phoneDigits = parentPhone.replace(/\D/g, "");
    if (phoneDigits.length < 10 || phoneDigits.length > 11) {
        throw new Error("올바른 전화번호를 입력해주세요.");
    }

    // DDL ensure ???뚯씠釉붿씠 ?놁쑝硫??먮룞 ?앹꽦
    await ensureEnrollmentApplicationTable();

    let matchedTrialLeadId = await resolveTrialLeadIdFromEnrollmentAccess(data.accessCode);

    if (!matchedTrialLeadId) {
        try {
            await ensureTrialLeadTable();
            const phoneDigits = normalizePhone(parentPhone).replace(/\D/g, "");
            const matches = await prisma.$queryRawUnsafe<{ id: string }[]>(
                `SELECT id
                 FROM "TrialLead"
                 WHERE TRIM("childName") = $1
                   AND regexp_replace(COALESCE("parentPhone", ''), '[^0-9]', '', 'g') = $2
                   AND status IN ('ATTENDED', 'SCHEDULED', 'CONTACTED', 'NEW')
                 ORDER BY
                   CASE status
                     WHEN 'ATTENDED' THEN 1
                     WHEN 'SCHEDULED' THEN 2
                     WHEN 'CONTACTED' THEN 3
                     ELSE 4
                   END,
                   COALESCE("attendedDate", "trialDate", "scheduledDate", "createdAt") DESC
                 LIMIT 1`,
                childName,
                phoneDigits,
            );
            matchedTrialLeadId = matches[0]?.id ?? null;
        } catch (matchError) {
            console.warn("[submitEnrollApplication] trial lead auto match failed:", matchError);
        }
    }

    try {
        const normalizedParentPhone = normalizePhone(parentPhone);
        const normalizedPhoneDigits = normalizedParentPhone.replace(/\D/g, "");
        const existingRows = data.existingId
            ? await prisma.$queryRawUnsafe<Array<{ id: string; status: string }>>(
                `SELECT id, status
                   FROM "EnrollmentApplication"
                  WHERE id = $1
                    AND LOWER(TRIM("childName")) = LOWER($2)
                    AND regexp_replace(COALESCE("parentPhone", ''), '[^0-9]', '', 'g') = $3
                    AND status IN ('PENDING', 'APPROVED')
                  LIMIT 1`,
                data.existingId,
                childName,
                normalizedPhoneDigits,
            )
            : matchedTrialLeadId
            ? await prisma.$queryRawUnsafe<Array<{ id: string; status: string }>>(
                `SELECT id, status
                   FROM "EnrollmentApplication"
                  WHERE "trialLeadId" = $1
                    AND status IN ('PENDING', 'APPROVED')
                  ORDER BY
                    CASE status WHEN 'PENDING' THEN 1 ELSE 2 END,
                    "updatedAt" DESC,
                    "createdAt" DESC
                  LIMIT 1`,
                matchedTrialLeadId,
            )
            : await prisma.$queryRawUnsafe<Array<{ id: string; status: string }>>(
                `SELECT id, status
                   FROM "EnrollmentApplication"
                  WHERE LOWER(TRIM("childName")) = LOWER($1)
                    AND regexp_replace(COALESCE("parentPhone", ''), '[^0-9]', '', 'g') = $2
                    AND "childBirthDate"::date = $3::date
                    AND status IN ('PENDING', 'APPROVED')
                  ORDER BY
                    CASE status WHEN 'PENDING' THEN 1 ELSE 2 END,
                    "updatedAt" DESC,
                    "createdAt" DESC
                  LIMIT 1`,
                childName,
                normalizedPhoneDigits,
                data.childBirthDate,
            );

        const existingApplication = existingRows[0];
        if (existingApplication?.status === "APPROVED") {
            const handoff = await issueEnrollmentAccountHandoffSafely(existingApplication.id);
            return {
                success: true,
                id: existingApplication.id,
                mode: "existing" as const,
                duplicate: true,
                accountHandoff: handoff ? {
                    token: handoff,
                    next: "/signup/parent",
                    parentName,
                    parentPhone: normalizedParentPhone,
                } : undefined,
            };
        }

        if (existingApplication?.id) {
            await prisma.$executeRawUnsafe(
                `UPDATE "EnrollmentApplication" SET
                    "trialLeadId" = $1,
                    "childName" = $2,
                    "childBirthDate" = $3::timestamptz,
                    "childGender" = $4,
                    "childGrade" = $5,
                    "childSchool" = $6,
                    "childPhone" = $7,
                    "parentName" = $8,
                    "parentPhone" = $9,
                    "parentRelation" = $10,
                    address = $11,
                    "enrollmentMonths" = $12,
                    "preferredSlotKeys" = $13,
                    "basketballExp" = $14,
                    "uniformSize" = $15,
                    "shuttleNeeded" = $16,
                    "shuttlePickup" = $17,
                    "shuttleTime" = $18,
                    "shuttleDropoff" = $19,
                    "paymentMethod" = $20,
                    "referralSource" = $21,
                    memo = $22,
                    "agreedTerms" = $23,
                    "agreedPrivacy" = $24,
                    "applicationNoticeConfirmed" = $25,
                    "shuttleNoticeConfirmed" = $26,
                    "shuttlePickupAddress" = $27,
                    "shuttlePickupRoadAddress" = $28,
                    "shuttlePickupLatitude" = $29,
                    "shuttlePickupLongitude" = $30,
                    "shuttlePickupPlaceId" = $31,
                    "shuttlePickupSource" = $32,
                    "shuttlePickupAccuracyMeters" = $33,
                    "shuttlePickupConfirmedAt" = $34::timestamptz,
                    "shuttleDropoffAddress" = $35,
                    "shuttleDropoffRoadAddress" = $36,
                    "shuttleDropoffLatitude" = $37,
                    "shuttleDropoffLongitude" = $38,
                    "shuttleDropoffPlaceId" = $39,
                    "shuttleDropoffSource" = $40,
                    "shuttleDropoffAccuracyMeters" = $41,
                    "shuttleDropoffConfirmedAt" = $42::timestamptz,
                    "shuttleLocationConsentVersion" = $43,
                    "shuttleLocationConsentAt" = $44::timestamptz,
                    "updatedAt" = NOW()
                  WHERE id = $45`,
                matchedTrialLeadId || null,
                childName,
                data.childBirthDate,
                data.childGender || null,
                data.childGrade || null,
                data.childSchool || null,
                data.childPhone || null,
                parentName,
                normalizedParentPhone,
                data.parentRelation || null,
                data.address?.trim() || null,
                data.enrollmentMonths || null,
                data.preferredSlotKeys || null,
                data.basketballExp || null,
                data.uniformSize || null,
                data.shuttleNeeded ?? false,
                data.shuttlePickup?.trim() || null,
                data.shuttleTime || null,
                data.shuttleDropoff?.trim() || null,
                data.paymentMethod || null,
                data.referralSource || null,
                data.memo?.trim() || null,
                data.agreedTerms,
                data.agreedPrivacy,
                data.applicationNoticeConfirmed ?? false,
                data.shuttleNoticeConfirmed ?? false,
                shuttlePickupLocation?.address ?? null,
                shuttlePickupLocation?.roadAddress ?? null,
                shuttlePickupLocation?.latitude ?? null,
                shuttlePickupLocation?.longitude ?? null,
                shuttlePickupLocation?.placeId ?? null,
                shuttlePickupLocation?.source ?? null,
                shuttlePickupLocation?.accuracyMeters ?? null,
                shuttlePickupLocation?.confirmedAt ?? null,
                shuttleDropoffLocation?.address ?? null,
                shuttleDropoffLocation?.roadAddress ?? null,
                shuttleDropoffLocation?.latitude ?? null,
                shuttleDropoffLocation?.longitude ?? null,
                shuttleDropoffLocation?.placeId ?? null,
                shuttleDropoffLocation?.source ?? null,
                shuttleDropoffLocation?.accuracyMeters ?? null,
                shuttleDropoffLocation?.confirmedAt ?? null,
                shuttleLocationConsentVersion,
                shuttleLocationConsentAt,
                existingApplication.id,
            );

            if (matchedTrialLeadId) {
                await prisma.$executeRawUnsafe(
                    `UPDATE "TrialLead"
                     SET "enrollApplicationReceivedAt" = COALESCE("enrollApplicationReceivedAt", NOW()),
                         "enrollApplicationId" = $1,
                         "updatedAt" = NOW()
                     WHERE id = $2`,
                    existingApplication.id,
                    matchedTrialLeadId,
                );
            }

            revalidatePath("/admin");
            revalidatePath("/admin/apply");
            revalidatePath("/admin/trial");
            const handoff = await issueEnrollmentAccountHandoffSafely(existingApplication.id);
            return {
                success: true,
                id: existingApplication.id,
                mode: "updated" as const,
                duplicate: true,
                accountHandoff: handoff ? {
                    token: handoff,
                    next: "/signup/parent",
                    parentName,
                    parentPhone: normalizedParentPhone,
                } : undefined,
            };
        }

        const recentSubmissions = await prisma.$queryRawUnsafe<{ count: number }[]>(
            `SELECT COUNT(*)::int AS count
               FROM "EnrollmentApplication"
              WHERE regexp_replace(COALESCE("parentPhone", ''), '[^0-9]', '', 'g') = $1
                AND "createdAt" > NOW() - INTERVAL '10 minutes'`,
            normalizedPhoneDigits,
        );
        if (Number(recentSubmissions[0]?.count ?? 0) >= 5) {
            throw new Error("신청이 너무 많이 접수되었습니다. 잠시 후 다시 시도해주세요.");
        }

        const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(
            `INSERT INTO "EnrollmentApplication" (
                id, "trialLeadId",
                "childName", "childBirthDate", "childGender", "childGrade", "childSchool", "childPhone",
                "parentName", "parentPhone", "parentRelation", address,
                "enrollmentMonths", "preferredSlotKeys", "basketballExp", "uniformSize",
                "shuttleNeeded", "shuttlePickup", "shuttleTime", "shuttleDropoff",
                "paymentMethod", "referralSource", memo,
                "agreedTerms", "agreedPrivacy", "applicationNoticeConfirmed", "shuttleNoticeConfirmed",
                "shuttlePickupAddress", "shuttlePickupRoadAddress",
                "shuttlePickupLatitude", "shuttlePickupLongitude", "shuttlePickupPlaceId",
                "shuttlePickupSource", "shuttlePickupAccuracyMeters", "shuttlePickupConfirmedAt",
                "shuttleDropoffAddress", "shuttleDropoffRoadAddress",
                "shuttleDropoffLatitude", "shuttleDropoffLongitude", "shuttleDropoffPlaceId",
                "shuttleDropoffSource", "shuttleDropoffAccuracyMeters", "shuttleDropoffConfirmedAt",
                "shuttleLocationConsentVersion", "shuttleLocationConsentAt",
                status, "createdAt", "updatedAt"
            ) VALUES (
                gen_random_uuid()::text, $1,
                $2, $3::timestamptz, $4, $5, $6, $7,
                $8, $9, $10, $11,
                $12, $13, $14, $15,
                $16, $17, $18, $19,
                $20, $21, $22,
                $23, $24, $25, $26,
                $27, $28, $29, $30, $31, $32, $33, $34::timestamptz,
                $35, $36, $37, $38, $39, $40, $41, $42::timestamptz,
                $43, $44::timestamptz,
                'PENDING', NOW(), NOW()
            ) RETURNING id`,
            matchedTrialLeadId || null,         // $1
            childName,                          // $2
            data.childBirthDate,                // $3
            data.childGender || null,           // $4
            data.childGrade || null,            // $5
            data.childSchool || null,           // $6
            data.childPhone || null,            // $7
            parentName,                         // $8
            normalizePhone(parentPhone),        // $9
            data.parentRelation || null,        // $10
            data.address?.trim() || null,       // $11
            data.enrollmentMonths || null,      // $12
            data.preferredSlotKeys || null,     // $13
            data.basketballExp || null,         // $14
            data.uniformSize || null,           // $15
            data.shuttleNeeded ?? false,        // $16
            data.shuttlePickup?.trim() || null, // $17
            data.shuttleTime || null,           // $18
            data.shuttleDropoff?.trim() || null,// $19
            data.paymentMethod || null,         // $20
            data.referralSource || null,        // $21
            data.memo?.trim() || null,          // $22
            data.agreedTerms,                   // $23
            data.agreedPrivacy,                 // $24
            data.applicationNoticeConfirmed ?? false, // $25
            data.shuttleNoticeConfirmed ?? false,     // $26
            shuttlePickupLocation?.address ?? null, // $27
            shuttlePickupLocation?.roadAddress ?? null, // $28
            shuttlePickupLocation?.latitude ?? null, // $29
            shuttlePickupLocation?.longitude ?? null, // $30
            shuttlePickupLocation?.placeId ?? null, // $31
            shuttlePickupLocation?.source ?? null, // $32
            shuttlePickupLocation?.accuracyMeters ?? null, // $33
            shuttlePickupLocation?.confirmedAt ?? null, // $34
            shuttleDropoffLocation?.address ?? null, // $35
            shuttleDropoffLocation?.roadAddress ?? null, // $36
            shuttleDropoffLocation?.latitude ?? null, // $37
            shuttleDropoffLocation?.longitude ?? null, // $38
            shuttleDropoffLocation?.placeId ?? null, // $39
            shuttleDropoffLocation?.source ?? null, // $40
            shuttleDropoffLocation?.accuracyMeters ?? null, // $41
            shuttleDropoffLocation?.confirmedAt ?? null, // $42
            shuttleLocationConsentVersion, // $43
            shuttleLocationConsentAt, // $44
        );

        if (matchedTrialLeadId && rows[0]?.id) {
            await prisma.$executeRawUnsafe(
                `UPDATE "TrialLead"
                 SET "enrollApplicationReceivedAt" = COALESCE("enrollApplicationReceivedAt", NOW()),
                     "enrollApplicationId" = $1,
                     "updatedAt" = NOW()
                 WHERE id = $2`,
                rows[0].id,
                matchedTrialLeadId,
            );
        }

        revalidatePath("/admin");

        const smsVars = {
            childName,
            childGrade: data.childGrade || "학년 미입력",
            parentName,
            parentPhone: normalizePhone(parentPhone),
        };

        // 愿由ъ옄?먭쾶 ?뚮┝ 諛쒖넚 (fire-and-forget: ?ㅽ뙣?대룄 ?좎껌? ?뺤긽 ?꾨즺)
        // ?쒗뵆由?湲곕컲 SMS: ENROLL_NEW_ADMIN(愿由ъ옄), ENROLL_NEW_COACH(肄붿튂)
        // slotKeys: ?щ쭩 ?щ’???덉쑝硫??대떦 ?щ’ ?대떦 肄붿튂?먭쾶留?SMS 諛쒖넚
        revalidatePath("/admin");
        revalidatePath("/admin/apply");
        revalidatePath("/admin/trial");

        const enrollSlotKeys = data.preferredSlotKeys
            ? data.preferredSlotKeys.split(",").map(k => k.trim()).filter(Boolean)
            : undefined;
        const enrollmentApplicationId = rows[0]?.id || "ok";
        await notifyAdmins(
            "ENROLL_APPLICATION",
            "수강 신청",
            `${childName} (${data.childGrade || "학년 미입력"}) - ${parentName}`,
            "/admin/apply",
            {
                adminTrigger: "ENROLL_NEW_ADMIN",
                coachTrigger: "ENROLL_NEW_COACH",
                notifyCoaches: false,
                variables: smsVars,
                slotKeys: enrollSlotKeys,
                eventId: enrollmentApplicationId,
            },
        ).catch(() => {});

        // ?숇?紐⑥뿉寃??묒닔 ?뺤씤 SMS 諛쒖넚 (fire-and-forget)
        await sendParentSmsWithAcademyPhone(
            normalizePhone(parentPhone),
            "ENROLL_CONFIRM_PARENT",
            { childName, parentName },
            { eventType: "ENROLL_APPLICATION", eventId: enrollmentApplicationId },
        ).catch(() => {});

        const handoff = await issueEnrollmentAccountHandoffSafely(enrollmentApplicationId);
        return {
            success: true,
            id: enrollmentApplicationId,
            mode: "created" as const,
            accountHandoff: handoff ? {
                token: handoff,
                next: "/signup/parent",
                parentName,
                parentPhone: normalizePhone(parentPhone),
            } : undefined,
        };
    } catch (e) {
        console.error("[submitEnrollApplication] failed:", e);
        throw new Error("수강 신청 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    }
}

// ?? 泥댄뿕 ?곗씠???먮룞 梨꾩???????????????????????????????????????????????????
export interface TrialLeadForEnroll {
    childName: string;
    childBirthDate: string | null;
    childGrade: string | null;
    childGender: string | null;
    childSchool: string | null;
    childPhone: string | null;
    basketballExp: string | null;
    preferredSlotKey: string | null;
    parentName: string;
    parentPhone: string;
    source: string;
}

let _trialLeadChildPhoneColumnEnsured = false;
async function ensureTrialLeadChildPhoneColumn() {
    if (_trialLeadChildPhoneColumnEnsured) return;
    await prisma.$executeRawUnsafe(`ALTER TABLE "TrialLead" ADD COLUMN IF NOT EXISTS "childPhone" TEXT`);
    _trialLeadChildPhoneColumnEnsured = true;
}

/**
 * 유효한 수강신청 접근 코드로 체험 정보를 안전하게 자동 입력합니다.
 *
 * 怨듦컻?⑹씠誘濡?愿由ъ옄 硫붾え ??誘쇨컧 ?뺣낫???쒖쇅?섍퀬
 * ?대쫫, ?앸뀈?붿씪, ?숇뀈, ?깅퀎, ?숆탳, ?곕씫泥? ?띻뎄 寃쏀뿕, ?щ쭩 ?섏뾽, 蹂댄샇???뺣낫留?諛섑솚
 */
export async function getTrialLeadForEnrollByAccessCode(accessCode: string): Promise<TrialLeadForEnroll | null> {
    if (!/^[A-Za-z0-9_-]{16}$/.test(accessCode)) return null;

    try {
        // TrialLead ?뚯씠釉붿씠 議댁옱?섎뒗吏 癒쇱? ?뺤씤
        await ensureTrialLeadTable();
        await ensureTrialLeadChildPhoneColumn();

        const rows = await prisma.$queryRawUnsafe<any[]>(
            `SELECT t."childName", t."childBirthDate", t."childGrade", t."childGender",
                    t."childSchool", t."childPhone", t."basketballExp",
                    COALESCE(c."slotKey", t."preferredSlotKey") AS "preferredSlotKey",
                    t."parentName", t."parentPhone", t.source
             FROM "EnrollmentShortLink" l
             JOIN "TrialLead" t ON t.id = l."trialLeadId"
             LEFT JOIN "Class" c ON c.id = t."scheduledClassId"
             WHERE l.code = $1
               AND l."isActive" = true
               AND l."expiresAt" > NOW()
             LIMIT 1`,
            accessCode
        );

        if (rows.length === 0) return null;

        const r = rows[0];
        const parentName = (r.parentName ?? r.parentname ?? "").trim();
        return {
            childName: r.childName ?? r.childname ?? "",
            childBirthDate: r.childBirthDate ?? r.childbirthdate
                ? new Date(r.childBirthDate ?? r.childbirthdate).toISOString().split("T")[0]
                : null,
            childGrade: r.childGrade ?? r.childgrade ?? null,
            childGender: r.childGender ?? r.childgender ?? null,
            childSchool: r.childSchool ?? r.childschool ?? null,
            childPhone: r.childPhone ?? r.childphone ?? null,
            basketballExp: r.basketballExp ?? r.basketballexp ?? null,
            preferredSlotKey: r.preferredSlotKey ?? r.preferredslotkey ?? null,
            parentName: parentName === "미입력" ? "" : parentName,
            parentPhone: r.parentPhone ?? r.parentphone ?? "",
            source: r.source ?? "WEBSITE",
        };
    } catch (e) {
        console.error("[getTrialLeadForEnrollByAccessCode] failed:", e);
        return null;
    }
}

// ?? ?숇?紐?SMS 諛쒖넚 (academyPhone ?먮룞 議고쉶 ?ы븿) ?????????????????????????????
// ?숇?紐?PARENT ?쒗뵆由우뿉??{{academyPhone}} 蹂?섍? ?ы븿??寃쎌슦媛 留롫떎.
// AcademySettings.contactPhone??DB?먯꽌 議고쉶?섏뿬 variables???먮룞 異붽??쒕떎.
// fire-and-forget ?⑦꽩: ?ㅽ뙣?대룄 硫붿씤 濡쒖쭅???곹뼢 ?놁쓬
async function sendParentSmsWithAcademyPhone(
    parentPhone: string,
    trigger: string,
    baseVars: Record<string, string>,
    options?: { eventType?: string; eventId?: string },
) {
    try {
        // ?숈썝 ?꾪솕踰덊샇 議고쉶
        const settings = await prisma.$queryRawUnsafe<any[]>(
            `SELECT "contactPhone" FROM "AcademySettings" WHERE id = 'singleton' LIMIT 1`
        );
        const academyPhone = settings[0]?.contactPhone ?? settings[0]?.contactphone ?? "";

        // 蹂?섏뿉 academyPhone 異붽?
        const vars = { ...baseVars, academyPhone };

        // sendParentSms ?몄텧 (notification.ts)
        const { sendParentSms: sps } = await import("@/lib/notification");
        await sps(parentPhone, trigger, vars, options);
    } catch (e) {
        console.error(`[sendParentSmsWithAcademyPhone] trigger=${trigger} failed:`, e);
    }
}
