import { unstable_cache } from "next/cache";
import { getInstagramRuntimeStatus } from "@/lib/instagram";
import { getPaymentProviderPublicStatus } from "@/lib/payment-ledger";
import { getScheduleSlotAdminData } from "@/lib/scheduleSlotPayload";
import {
    getAcademySettings,
    getAnnualEvents,
    getAllCoaches,
    getAllFaqs,
    getAllFeedbacks,
    getAllRequests,
    getAllTestimonials,
    getBillingTemplates,
    getClasses,
    getClassCapacityInfo,
    getClassSlotOverrides,
    getCoaches,
    getCoachWorkload,
    getCustomClassSlots,
    getDashboardExtendedStats,
    getDashboardStats,
    getEnrollApplications,
    getEnrollApplicationStats,
    getEnrollmentTrend,
    getPendingRequestCount,
    getRecentPendingRequests,
    getGalleryPosts,
    getMakeupSessions,
    getMonthlyAttendanceRate,
    getMonthlyRevenue,
    getPayments,
    getPaymentSummary,
    getPaymentCollectionRate,
    getNotices,
    getPrograms,
    getSheetSlotCache,
    getSessionsForReportList,
    getSkillCategories,
    getSmsTemplates,
    getStaffInvitations,
    getStaffUsers,
    getStudents,
    getTrialLeads,
    getTrialStats,
    getWaitlistAll,
} from "@/lib/queries";
import { prisma } from "@/lib/prisma";
import { readPendingSocialPostDrafts } from "@/lib/socialDrafts";

const DASHBOARD_MONTHS = 6;
const ADMIN_LIST_PAGE_SIZE = 50;
const ADMIN_LIST_MAX_PAGE_SIZE = 100;

type AdminListPayloadOptions = {
    limit?: number;
    offset?: number;
};

function normalizeAdminListPayloadOptions(options?: AdminListPayloadOptions) {
    const limit =
        typeof options?.limit === "number" && Number.isFinite(options.limit) && options.limit > 0
            ? Math.min(Math.floor(options.limit), ADMIN_LIST_MAX_PAGE_SIZE)
            : ADMIN_LIST_PAGE_SIZE;
    const offset =
        typeof options?.offset === "number" && Number.isFinite(options.offset) && options.offset > 0
            ? Math.floor(options.offset)
            : 0;

    return { limit, offset };
}

function buildListPagination({
    limit,
    offset,
    returned,
    hasMore,
    total,
}: {
    limit: number;
    offset: number;
    returned: number;
    hasMore: boolean;
    total: number;
}) {
    return {
        limit,
        offset,
        returned,
        total,
        hasMore,
        nextOffset: hasMore ? offset + returned : null,
        partial: hasMore || offset > 0 || returned < total,
    };
}

type AdminScheduleSettingsPayload = {
    googleSheetsScheduleUrl?: string | null;
    googlesheetsscheduleurl?: string | null;
} | null;

type AdminTodayClassRow = {
    id: string;
    name: string;
    startTime?: string | null;
    starttime?: string | null;
    endTime?: string | null;
    endtime?: string | null;
    capacity?: number | string | null;
    program_name?: string | null;
    enrolled?: number | string | null;
};

type DashboardTodayClassItem = {
    id?: string;
    name?: string;
    startTime?: string | null;
    endTime?: string | null;
    capacity?: number | string | null;
    programName?: string | null;
    enrolled?: number | string | null;
};

type RecentStudentRow = {
    id: string;
    name: string;
    createdAt?: Date | string | null;
    createdat?: Date | string | null;
    parent_name?: string | null;
};

type GallerySettingsPayload = {
    instagramUrl?: string | null;
    instagramBusinessAccountId?: string | null;
    instagramAutoPublishEnabled?: boolean | null;
};

function getMonthLabels(date = new Date()) {
    return Array.from({ length: DASHBOARD_MONTHS }, (_, index) => {
        const month = new Date(date.getFullYear(), date.getMonth() - (DASHBOARD_MONTHS - 1 - index), 1);
        return `${month.getMonth() + 1}월`;
    });
}

function getTodayLabel(date = new Date()) {
    const days = ["일", "월", "화", "수", "목", "금", "토"];
    return `${days[date.getDay()]}요일`;
}

function getEmptyExtendedStats(date = new Date()) {
    const monthlyRevenue = getMonthLabels(date).map((month) => ({ month, amount: 0 }));
    const monthlyAttendance = getMonthLabels(date).map((month) => ({ month, rate: 0 }));

    return {
        thisMonthRevenue: 0,
        lastMonthRevenue: 0,
        attendanceRate: 0,
        unpaidCount: 0,
        unpaidAmount: 0,
        monthlyRevenue,
        monthlyAttendance,
        programStudents: [],
    };
}

async function getTodayClasses() {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const today = days[new Date().getDay()];

    try {
        const rows = await prisma.$queryRawUnsafe<AdminTodayClassRow[]>(
            `SELECT c.id, c.name, c."startTime", c."endTime", c.capacity,
                    p.name AS program_name,
                    (SELECT COUNT(*)::int FROM "Enrollment" e WHERE e."classId" = c.id AND e.status = 'ACTIVE') AS enrolled
             FROM "Class" c
             LEFT JOIN "Program" p ON c."programId" = p.id
             WHERE c."dayOfWeek" = $1
             ORDER BY c."startTime" ASC`,
            today,
        );

        return rows.map((row) => ({
            id: row.id,
            name: row.name,
            startTime: row.startTime ?? row.starttime,
            endTime: row.endTime ?? row.endtime,
            capacity: Number(row.capacity ?? 0),
            programName: row.program_name,
            enrolled: Number(row.enrolled ?? 0),
        }));
    } catch {
        return [];
    }
}

type DashboardPrimaryRow = {
    studentCount: number | null;
    programCount: number | null;
    coachCount: number | null;
    classCount: number | null;
    pendingCount: number | null;
    enrollPending: number | null;
    enrollApproved: number | null;
    enrollRejected: number | null;
    enrollCancelled: number | null;
    enrollTotal: number | null;
    todayClasses: unknown;
    todayclasses?: unknown;
};

function readJsonArray<T>(value: unknown): T[] {
    if (Array.isArray(value)) return value as T[];
    if (typeof value !== "string") return [];

    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

async function loadDashboardPrimaryPayload() {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const today = days[new Date().getDay()];

    try {
        const rows = await prisma.$queryRawUnsafe<DashboardPrimaryRow[]>(
            `SELECT
                (SELECT COUNT(*)::int FROM "Student") AS "studentCount",
                (SELECT COUNT(*)::int FROM "Program") AS "programCount",
                (SELECT COUNT(*)::int FROM "Coach") AS "coachCount",
                (SELECT COUNT(*)::int FROM "Class") AS "classCount",
                (SELECT COUNT(*)::int FROM "ParentRequest" WHERE status = 'PENDING') AS "pendingCount",
                (SELECT COUNT(*)::int FROM "EnrollmentApplication" WHERE status = 'PENDING') AS "enrollPending",
                (SELECT COUNT(*)::int FROM "EnrollmentApplication" WHERE status = 'APPROVED') AS "enrollApproved",
                (SELECT COUNT(*)::int FROM "EnrollmentApplication" WHERE status = 'REJECTED') AS "enrollRejected",
                (SELECT COUNT(*)::int FROM "EnrollmentApplication" WHERE status = 'CANCELLED') AS "enrollCancelled",
                (SELECT COUNT(*)::int FROM "EnrollmentApplication") AS "enrollTotal",
                (
                    SELECT COALESCE(
                        json_agg(
                            json_build_object(
                                'id', tc.id,
                                'name', tc.name,
                                'startTime', tc."startTime",
                                'endTime', tc."endTime",
                                'capacity', tc.capacity,
                                'programName', tc."programName",
                                'enrolled', tc.enrolled
                            )
                            ORDER BY tc."startTime" ASC
                        ),
                        '[]'::json
                    )
                    FROM (
                        SELECT c.id, c.name, c."startTime", c."endTime", c.capacity,
                               p.name AS "programName",
                               (
                                   SELECT COUNT(*)::int
                                   FROM "Enrollment" e
                                   WHERE e."classId" = c.id AND e.status = 'ACTIVE'
                               ) AS enrolled
                        FROM "Class" c
                        LEFT JOIN "Program" p ON c."programId" = p.id
                        WHERE c."dayOfWeek" = $1
                        ORDER BY c."startTime" ASC
                    ) tc
                ) AS "todayClasses"`,
            today,
        );

        const row = rows[0];
        if (!row) throw new Error("No dashboard primary row returned");

        const todayClasses = readJsonArray<DashboardTodayClassItem>(row.todayClasses ?? row.todayclasses).map((item) => ({
            id: String(item.id ?? ""),
            name: String(item.name ?? ""),
            startTime: item.startTime ?? null,
            endTime: item.endTime ?? null,
            capacity: Number(item.capacity ?? 0),
            programName: item.programName ?? null,
            enrolled: Number(item.enrolled ?? 0),
        }));

        return {
            stats: {
                studentCount: Number(row.studentCount ?? 0),
                programCount: Number(row.programCount ?? 0),
                coachCount: Number(row.coachCount ?? 0),
                classCount: Number(row.classCount ?? 0),
            },
            pendingRequests: [],
            pendingCount: Number(row.pendingCount ?? 0),
            enrollStats: {
                PENDING: Number(row.enrollPending ?? 0),
                APPROVED: Number(row.enrollApproved ?? 0),
                REJECTED: Number(row.enrollRejected ?? 0),
                CANCELLED: Number(row.enrollCancelled ?? 0),
                total: Number(row.enrollTotal ?? 0),
            },
            extendedStats: getEmptyExtendedStats(),
            todayClasses,
            recentStudents: [],
            todayLabel: getTodayLabel(),
        };
    } catch (error) {
        console.error("[loadDashboardPrimaryPayload] failed:", error);
        return {
            stats: { studentCount: 0, programCount: 0, coachCount: 0, classCount: 0 },
            pendingRequests: [],
            pendingCount: 0,
            enrollStats: { PENDING: 0, APPROVED: 0, REJECTED: 0, CANCELLED: 0, total: 0 },
            extendedStats: getEmptyExtendedStats(),
            todayClasses: [],
            recentStudents: [],
            todayLabel: getTodayLabel(),
        };
    }
}

async function getRecentStudents() {
    try {
        const rows = await prisma.$queryRawUnsafe<RecentStudentRow[]>(
            `SELECT s.id, s.name, s."createdAt", u.name AS parent_name
             FROM "Student" s
             LEFT JOIN "User" u ON s."parentId" = u.id
             WHERE s."createdAt" >= NOW() - INTERVAL '7 days'
             ORDER BY s."createdAt" DESC
             LIMIT 5`,
        );

        return rows.map((row) => ({
            id: row.id,
            name: row.name,
            createdAt: row.createdAt ?? row.createdat,
            parentName: row.parent_name,
        }));
    } catch {
        return [];
    }
}

async function getSmsCoachPhones() {
    return prisma.$queryRawUnsafe<{ id: string; name: string; role: string; phone: string }[]>(
        `SELECT id, name, role, phone FROM "Coach" WHERE phone IS NOT NULL AND phone != '' ORDER BY "order" ASC`,
    );
}

async function loadDashboardPayload() {
    const [
        stats,
        pendingRequests,
        pendingCount,
        enrollStats,
        extendedStats,
        todayClasses,
        recentStudents,
    ] = await Promise.all([
        getDashboardStats(),
        getRecentPendingRequests(),
        getPendingRequestCount(),
        getEnrollApplicationStats(),
        getDashboardExtendedStats(),
        getTodayClasses(),
        getRecentStudents(),
    ]);

    return {
        stats,
        pendingRequests,
        pendingCount,
        enrollStats,
        extendedStats,
        todayClasses,
        recentStudents,
        todayLabel: getTodayLabel(),
    };
}

export function getCachedAdminStudentsPayload(limit?: number) {
    const normalizedLimit =
        typeof limit === "number" && Number.isFinite(limit) && limit > 0
            ? Math.min(Math.floor(limit), 500)
            : undefined;

    return unstable_cache(
        async () => {
            const [students, classes, sheetImportSummary] = await Promise.all([
                getStudents(normalizedLimit),
                getClasses(),
                getStudentSheetImportSummary(),
            ]);

            return { students, classes, sheetImportSummary, partial: Boolean(normalizedLimit) };
        },
        [`admin-students-v2-${normalizedLimit ?? "all"}`],
        { revalidate: 60, tags: ["admin-students", "admin-classes", "admin-student-imports"] },
    )();
}

async function getStudentSheetImportSummary() {
    try {
        const [rows, scheduleMismatchRows, studentStatusRows] = await Promise.all([
            prisma.$queryRawUnsafe<{
            id: string;
            status: string;
            totalRows: number;
            registrationRows: number;
            vehicleRows: number;
            changeRows: number;
            teamRows: number;
            errorRows: number;
            message: string | null;
            createdAt: Date;
            completedAt: Date | null;
            uniqueStudents: number;
            linkedRegistrations: number;
        }[]>(
                `SELECT b.id, b.status, b."totalRows", b."registrationRows",
                        b."vehicleRows", b."changeRows", b."teamRows", b."errorRows",
                        b.message, b."createdAt", b."completedAt",
                        COALESCE(COUNT(DISTINCT r."studentKey") FILTER (WHERE r."studentKey" IS NOT NULL), 0)::int AS "uniqueStudents",
                        COALESCE(COUNT(*) FILTER (WHERE r."studentId" IS NOT NULL), 0)::int AS "linkedRegistrations"
                 FROM "StudentSheetImportBatch" b
                 LEFT JOIN "StudentRegistrationLedger" r ON r."batchId" = b.id
                 GROUP BY b.id
                 ORDER BY b."createdAt" DESC
                 LIMIT 1`
            ),
            prisma.$queryRawUnsafe<{
                slotKey: string;
                sheetCount: number;
                dbCount: number;
                diff: number;
                totalMismatchCount: number;
            }[]>(
                `WITH latest AS (
                    SELECT id
                    FROM "StudentSheetImportBatch"
                    WHERE status = 'COMPLETED'
                    ORDER BY "createdAt" DESC
                    LIMIT 1
                ),
                ledger AS (
                    SELECT
                        r.*,
                        (
                            string_to_array(
                                trim(both ',' from regexp_replace(COALESCE(r."registrationMonth", ''), '[^0-9]+', ',', 'g')),
                                ','
                            )
                        )[2]::int AS "monthNumber"
                    FROM "StudentRegistrationLedger" r
                    JOIN latest ON latest.id = r."batchId"
                ),
                selected_month AS (
                    SELECT l."monthNumber"
                    FROM ledger l
                    WHERE l."monthNumber" IS NOT NULL
                    GROUP BY l."monthNumber"
                    ORDER BY l."monthNumber" DESC
                    LIMIT 1
                ),
                target AS (
                    SELECT l.*
                    FROM ledger l
                    JOIN selected_month sm ON sm."monthNumber" = l."monthNumber"
                    WHERE l.status = 'ACTIVE'
                ),
                sheet_slots AS (
                    SELECT
                        slot_key AS "slotKey",
                        COUNT(DISTINCT COALESCE(r."studentId", r."studentKey", r."studentName" || ':' || COALESCE(r."parentPhone", r."rowNumber"::text)))::int AS "sheetCount"
                    FROM target r
                    CROSS JOIN LATERAL jsonb_array_elements_text(
                        COALESCE(NULLIF(r."selectedSlotKeysJSON", ''), '[]')::jsonb
                    ) AS slot_key
                    GROUP BY slot_key
                ),
                db_slots AS (
                    SELECT
                        c."slotKey" AS "slotKey",
                        COUNT(DISTINCT e."studentId")::int AS "dbCount"
                    FROM "Enrollment" e
                    JOIN "Class" c ON c.id = e."classId"
                    WHERE e.status = 'ACTIVE'
                      AND c."slotKey" IS NOT NULL
                    GROUP BY c."slotKey"
                ),
                mismatches AS (
                    SELECT
                        COALESCE(sheet_slots."slotKey", db_slots."slotKey") AS "slotKey",
                        COALESCE(sheet_slots."sheetCount", 0)::int AS "sheetCount",
                        COALESCE(db_slots."dbCount", 0)::int AS "dbCount",
                        (COALESCE(db_slots."dbCount", 0) - COALESCE(sheet_slots."sheetCount", 0))::int AS diff
                    FROM sheet_slots
                    FULL OUTER JOIN db_slots ON db_slots."slotKey" = sheet_slots."slotKey"
                    WHERE COALESCE(sheet_slots."sheetCount", 0) <> COALESCE(db_slots."dbCount", 0)
                )
                SELECT
                    "slotKey",
                    "sheetCount",
                    "dbCount",
                    diff,
                    COUNT(*) OVER ()::int AS "totalMismatchCount"
                FROM mismatches
                ORDER BY ABS(diff) DESC, "slotKey" ASC
                LIMIT 8`
            ),
            prisma.$queryRawUnsafe<{
                total: number;
                active: number;
                paused: number;
                withdrawn: number;
                noEnrollment: number;
            }[]>(
                `WITH latest AS (
                    SELECT id
                    FROM "StudentSheetImportBatch"
                    WHERE status = 'COMPLETED'
                    ORDER BY "createdAt" DESC
                    LIMIT 1
                ),
                ledger AS (
                    SELECT
                        r.*,
                        (
                            string_to_array(
                                trim(both ',' from regexp_replace(COALESCE(r."registrationMonth", ''), '[^0-9]+', ',', 'g')),
                                ','
                            )
                        )[2]::int AS "monthNumber"
                    FROM "StudentRegistrationLedger" r
                    JOIN latest ON latest.id = r."batchId"
                    WHERE r."studentId" IS NOT NULL
                ),
                selected_month AS (
                    SELECT l."monthNumber"
                    FROM ledger l
                    WHERE l."monthNumber" IS NOT NULL
                    GROUP BY l."monthNumber"
                    ORDER BY l."monthNumber" DESC
                    LIMIT 1
                ),
                student_month_status AS (
                    SELECT
                        l."studentId",
                        l."monthNumber",
                        CASE
                            WHEN BOOL_OR(l.status = 'WITHDRAWN') THEN 'WITHDRAWN'
                            WHEN BOOL_OR(l.status = 'ACTIVE') THEN 'ACTIVE'
                            WHEN BOOL_OR(l.status = 'PAUSED') THEN 'PAUSED'
                            ELSE 'WITHDRAWN'
                        END AS status
                    FROM ledger l
                    JOIN selected_month sm ON l."monthNumber" <= sm."monthNumber"
                    GROUP BY l."studentId", l."monthNumber"
                ),
                current_student_status AS (
                    SELECT DISTINCT ON (sms."studentId")
                        sms."studentId",
                        sms.status
                    FROM student_month_status sms
                    ORDER BY sms."studentId", sms."monthNumber" DESC
                ),
                student_status AS (
                    SELECT
                        s.id,
                        css.status
                    FROM "Student" s
                    LEFT JOIN current_student_status css ON css."studentId" = s.id
                )
                SELECT
                    COUNT(*)::int AS total,
                    COUNT(*) FILTER (WHERE status = 'ACTIVE')::int AS active,
                    COUNT(*) FILTER (WHERE status = 'PAUSED')::int AS paused,
                    COUNT(*) FILTER (WHERE status = 'WITHDRAWN')::int AS withdrawn,
                    COUNT(*) FILTER (WHERE status IS NULL OR status NOT IN ('ACTIVE', 'PAUSED', 'WITHDRAWN'))::int AS "noEnrollment"
                FROM student_status`
            ),
        ]);

        const latest = rows[0];
        if (!latest) return null;

        return {
            ...latest,
            createdAt: latest.createdAt.toISOString(),
            completedAt: latest.completedAt?.toISOString() ?? null,
            studentStatusCounts: studentStatusRows[0] ?? {
                total: 0,
                active: 0,
                paused: 0,
                withdrawn: 0,
                noEnrollment: 0,
            },
            scheduleMismatchCount: scheduleMismatchRows[0]?.totalMismatchCount ?? 0,
            topScheduleMismatches: scheduleMismatchRows.map((row) => ({
                slotKey: row.slotKey,
                sheetCount: row.sheetCount,
                dbCount: row.dbCount,
                diff: row.diff,
            })),
        };
    } catch (error) {
        console.error("[admin-students] import summary failed:", error);
        return null;
    }
}

export const getCachedAdminDashboardPrimaryPayload = unstable_cache(
    loadDashboardPrimaryPayload,
    ["admin-dashboard-primary-v2"],
    { revalidate: 60, tags: ["admin-dashboard"] },
);

export const getCachedAdminDashboardPayload = unstable_cache(
    loadDashboardPayload,
    ["admin-dashboard-data-v2"],
    { revalidate: 300, tags: ["admin-dashboard"] },
);

export const getCachedAdminClassesPayload = unstable_cache(
    async () => {
        const [programs, classes] = await Promise.all([
            getPrograms(),
            getClasses(),
        ]);

        return { programs, classes };
    },
    ["admin-classes-v1"],
    { revalidate: 60, tags: ["admin-classes", "admin-programs"] },
);

export const getCachedAdminProgramsPayload = unstable_cache(
    async () => {
        const programs = await getPrograms();

        return { programs };
    },
    ["admin-programs-page-v1"],
    { revalidate: 60, tags: ["admin-programs"] },
);

export const getCachedAdminCoachesPayload = unstable_cache(
    async () => {
        const coaches = await getCoaches();

        return { coaches };
    },
    ["admin-coaches-page-v1"],
    { revalidate: 60, tags: ["admin-coaches"] },
);

export const getCachedAdminTestimonialsPayload = unstable_cache(
    async () => {
        const [testimonials, settings] = await Promise.all([
            getAllTestimonials(),
            getAcademySettings(),
        ]);

        return {
            testimonials,
            naverPlaceUrl: settings?.naverPlaceUrl || "",
        };
    },
    ["admin-testimonials-page-v1"],
    { revalidate: 60, tags: ["admin-testimonials", "academy-settings"] },
);

export const getCachedAdminBillingPayload = unstable_cache(
    async () => {
        const [templates, programs] = await Promise.all([
            getBillingTemplates(),
            getPrograms(),
        ]);

        return { templates, programs };
    },
    ["admin-finance-billing-page-v1"],
    { revalidate: 60, tags: ["admin-finance-billing", "admin-programs"] },
);

export const getCachedAdminSmsTemplatesPayload = unstable_cache(
    async () => {
        const templates = await getSmsTemplates();

        return { templates };
    },
    ["admin-sms-templates-page-v1"],
    { revalidate: 60, tags: ["admin-sms-templates"] },
);

export const getCachedAdminGalleryPayload = unstable_cache(
    async () => {
        const [posts, classes, settings, socialDrafts] = await Promise.all([
            getGalleryPosts({ limit: 100 }),
            getClasses(),
            getAcademySettings(),
            readPendingSocialPostDrafts(30),
        ]);
        const settingsData = settings as GallerySettingsPayload | null;
        const instagramStatus = {
            profileUrl: settingsData?.instagramUrl ?? "",
            businessAccountId: settingsData?.instagramBusinessAccountId ?? "",
            autoPublishEnabled: settingsData?.instagramAutoPublishEnabled === true,
            ...getInstagramRuntimeStatus(settingsData?.instagramBusinessAccountId),
        };

        return { posts, classes, instagramStatus, socialDrafts };
    },
    ["admin-gallery-page-v1"],
    { revalidate: 60, tags: ["admin-gallery", "admin-classes", "academy-settings"] },
);

export function getCachedAdminFinancePayload(year: number, month: number) {
    return unstable_cache(
        async () => {
            const [payments, summary] = await Promise.all([
                getPayments(year, month),
                getPaymentSummary(year, month),
            ]);

            return { payments, summary, paymentProvider: getPaymentProviderPublicStatus() };
        },
        ["admin-finance", String(year), String(month)],
        { revalidate: 30, tags: ["admin-finance", "admin-stats"] },
    )();
}

export const getCachedAdminNoticesPayload = unstable_cache(
    async () => {
        const [notices, classes] = await Promise.all([
            getNotices({ limit: 100 }),
            getClasses(),
        ]);

        return { notices, classes };
    },
    ["admin-notices-page-v1"],
    { revalidate: 60, tags: ["admin-notices", "admin-classes"] },
);

export const getCachedAdminAttendancePayload = unstable_cache(
    async () => {
        const classes = await getClasses();

        return { classes };
    },
    ["admin-attendance-page-v1"],
    { revalidate: 60, tags: ["admin-classes"] },
);

export const getCachedAdminApplySummaryPayload = unstable_cache(
    async () => {
        const stats = await getEnrollApplicationStats();

        return { stats };
    },
    ["admin-apply-summary-v1"],
    { revalidate: 30, tags: ["admin-apply"] },
);

export function getCachedAdminApplyPayload(options?: AdminListPayloadOptions) {
    const page = normalizeAdminListPayloadOptions(options);

    return unstable_cache(
        async () => {
            const [applicationRows, stats, classes] = await Promise.all([
                getEnrollApplications({ limit: page.limit + 1, offset: page.offset }),
                getEnrollApplicationStats(),
                getClasses(),
            ]);
            const hasMore = applicationRows.length > page.limit;
            const applications = hasMore ? applicationRows.slice(0, page.limit) : applicationRows;

            return {
                applications,
                stats,
                classes,
                pagination: buildListPagination({
                    limit: page.limit,
                    offset: page.offset,
                    returned: applications.length,
                    hasMore,
                    total: stats.total,
                }),
            };
        },
        ["admin-apply-v2", String(page.limit), String(page.offset)],
        { revalidate: 30, tags: ["admin-apply", "admin-classes"] },
    )();
}

export const getCachedAdminWaitlistPayload = unstable_cache(
    async () => {
        const [waitlist, capacityInfo, classes] = await Promise.all([
            getWaitlistAll(),
            getClassCapacityInfo(),
            getClasses(),
        ]);

        return { waitlist, capacityInfo, classes };
    },
    ["admin-waitlist-v1"],
    { revalidate: 30, tags: ["admin-waitlist", "admin-classes", "admin-students"] },
);

export const getCachedAdminMakeupPayload = unstable_cache(
    async () => {
        const [sessions, classes] = await Promise.all([
            getMakeupSessions(),
            getClasses(),
        ]);

        return { sessions, classes };
    },
    ["admin-makeup-v1"],
    { revalidate: 30, tags: ["admin-makeup", "admin-classes"] },
);

export const getCachedAdminStatsPayload = unstable_cache(
    async () => {
        const [
            monthlyRevenue,
            monthlyAttendance,
            enrollmentTrend,
            classCapacity,
            trialStats,
            coachWorkload,
            collectionRate,
        ] = await Promise.all([
            getMonthlyRevenue(12),
            getMonthlyAttendanceRate(12),
            getEnrollmentTrend(12),
            getClassCapacityInfo(),
            getTrialStats(),
            getCoachWorkload(),
            getPaymentCollectionRate(),
        ]);

        return {
            monthlyRevenue,
            monthlyAttendance,
            enrollmentTrend,
            classCapacity,
            trialStats,
            coachWorkload,
            collectionRate,
        };
    },
    ["admin-stats-v1"],
    { revalidate: 60, tags: ["admin-stats"] },
);

export const getCachedAdminStaffPayload = unstable_cache(
    async () => {
        const [staffUsers, coaches, invitations] = await Promise.all([
            getStaffUsers(),
            getAllCoaches(),
            getStaffInvitations(),
        ]);

        return { staffUsers, coaches, invitations };
    },
    ["admin-staff-v1"],
    { revalidate: 60, tags: ["admin-staff", "admin-coaches"] },
);

export const getCachedAdminRequestsPayload = unstable_cache(
    async () => {
        const requests = await getAllRequests();

        return { requests };
    },
    ["admin-requests-page-v1"],
    { revalidate: 30, tags: ["admin-requests"] },
);

export const getCachedAdminSettingsPayload = unstable_cache(
    async () => {
        try {
            const settings = await getAcademySettings();

            return { settings, fetchError: false };
        } catch {
            return { settings: null, fetchError: true };
        }
    },
    ["admin-settings-page-v1"],
    { revalidate: 60, tags: ["academy-settings"] },
);

export const getCachedAdminAnnualPayload = unstable_cache(
    async () => {
        const [events, settings] = await Promise.all([
            getAnnualEvents(),
            getAcademySettings(),
        ]);

        return {
            events,
            initialIcsUrl: settings?.googleCalendarIcsUrl || "",
        };
    },
    ["admin-annual-v1"],
    { revalidate: 60, tags: ["admin-annual", "academy-settings"] },
);

export const getCachedAdminFaqPayload = unstable_cache(
    async () => {
        const faqs = await getAllFaqs();

        return { faqs };
    },
    ["admin-faq-v1"],
    { revalidate: 60, tags: ["admin-faq"] },
);

export const getCachedAdminFeedbackPayload = unstable_cache(
    async () => {
        const feedbacks = await getAllFeedbacks();

        return { feedbacks };
    },
    ["admin-feedback-page-v1"],
    { revalidate: 60, tags: ["admin-feedback"] },
);

export const getCachedAdminSkillsPayload = unstable_cache(
    async () => {
        const categories = await getSkillCategories();

        return { categories };
    },
    ["admin-skills-page-v1"],
    { revalidate: 60, tags: ["admin-skills"] },
);

export function getCachedAdminReportListPayload(limit: number) {
    return unstable_cache(
        async () => {
            const sessions = await getSessionsForReportList(limit);

            return { sessions };
        },
        ["admin-attendance-report-list", String(limit)],
        { revalidate: 30, tags: ["admin-attendance-report", "admin-classes"] },
    )();
}

export const getCachedAdminSmsPayload = unstable_cache(
    async () => {
        const coaches = await getSmsCoachPhones();

        return { coaches };
    },
    ["admin-sms-page-v1"],
    { revalidate: 60, tags: ["admin-coaches"] },
);

export const getCachedAdminSchedulePayload = unstable_cache(
    async () => {
        const [settings, dbScheduleData, coaches, programs] = await Promise.all([
            getAcademySettings() as Promise<AdminScheduleSettingsPayload>,
            getScheduleSlotAdminData(),
            getCoaches(),
            getPrograms(),
        ]);
        const sheetUrl = settings?.googleSheetsScheduleUrl ?? settings?.googlesheetsscheduleurl ?? null;

        let scheduleData = dbScheduleData;
        if (!scheduleData) {
            const [overrides, customSlots, legacySlots] = await Promise.all([
                getClassSlotOverrides(),
                getCustomClassSlots(),
                sheetUrl ? getSheetSlotCache().then((cachedSlots) => cachedSlots ?? []) : Promise.resolve([]),
            ]);
            scheduleData = {
                slots: legacySlots,
                overrides,
                customSlots,
                scheduleSource: "SHEET_CACHE" as const,
            };
        }

        return {
            slots: scheduleData.slots,
            overrides: scheduleData.overrides,
            coaches,
            customSlots: scheduleData.customSlots,
            hasSheetUrl: Boolean(sheetUrl) || Boolean(dbScheduleData),
            sheetUrl: sheetUrl ?? null,
            programs,
            scheduleSource: scheduleData.scheduleSource,
        };
    },
    ["admin-schedule-page-v1"],
    { revalidate: 60, tags: ["admin-schedule", "admin-programs"] },
);

export function getCachedAdminTrialPayload(options?: AdminListPayloadOptions) {
    const page = normalizeAdminListPayloadOptions(options);

    return unstable_cache(
        async () => {
            const [leadRows, stats] = await Promise.all([
                getTrialLeads({ limit: page.limit + 1, offset: page.offset }),
                getTrialStats(),
            ]);
            const hasMore = leadRows.length > page.limit;
            const leads = hasMore ? leadRows.slice(0, page.limit) : leadRows;

            return {
                leads,
                stats,
                pagination: buildListPagination({
                    limit: page.limit,
                    offset: page.offset,
                    returned: leads.length,
                    hasMore,
                    total: stats.total,
                }),
            };
        },
        ["admin-trial-v2", String(page.limit), String(page.offset)],
        { revalidate: 30, tags: ["admin-trial"] },
    )();
}
