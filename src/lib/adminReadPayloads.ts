import { unstable_cache } from "next/cache";
import { getInstagramRuntimeStatus } from "@/lib/instagram";
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
        const rows = await prisma.$queryRawUnsafe<any[]>(
            `SELECT c.id, c.name, c."startTime", c."endTime", c.capacity,
                    p.name AS program_name,
                    (SELECT COUNT(*)::int FROM "Enrollment" e WHERE e."classId" = c.id AND e.status = 'ACTIVE') AS enrolled
             FROM "Class" c
             LEFT JOIN "Program" p ON c."programId" = p.id
             WHERE c."dayOfWeek" = $1
             ORDER BY c."startTime" ASC`,
            today,
        );

        return rows.map((row: any) => ({
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

        const todayClasses = readJsonArray<any>((row as any).todayClasses ?? (row as any).todayclasses).map((item) => ({
            id: item.id,
            name: item.name,
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
        const rows = await prisma.$queryRawUnsafe<any[]>(
            `SELECT s.id, s.name, s."createdAt", u.name AS parent_name
             FROM "Student" s
             LEFT JOIN "User" u ON s."parentId" = u.id
             WHERE s."createdAt" >= NOW() - INTERVAL '7 days'
             ORDER BY s."createdAt" DESC
             LIMIT 5`,
        );

        return rows.map((row: any) => ({
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
            const [students, classes] = await Promise.all([
                getStudents(normalizedLimit),
                getClasses(),
            ]);

            return { students, classes, partial: Boolean(normalizedLimit) };
        },
        [`admin-students-v2-${normalizedLimit ?? "all"}`],
        { revalidate: 60, tags: ["admin-students", "admin-classes"] },
    )();
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
        const settingsData = settings as any;
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

            return { payments, summary };
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

export const getCachedAdminApplyPayload = unstable_cache(
    async () => {
        const [applications, stats, classes] = await Promise.all([
            getEnrollApplications(),
            getEnrollApplicationStats(),
            getClasses(),
        ]);

        return { applications, stats, classes };
    },
    ["admin-apply-v1"],
    { revalidate: 30, tags: ["admin-apply", "admin-classes"] },
);

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
        const settings = await (getAcademySettings() as Promise<any>);
        const sheetUrl = settings?.googleSheetsScheduleUrl as string | null | undefined;

        const [overrides, coaches, customSlots, programs, legacySlots, dbScheduleData] = await Promise.all([
            getClassSlotOverrides(),
            getCoaches(),
            getCustomClassSlots(),
            getPrograms(),
            sheetUrl ? getSheetSlotCache().then((cachedSlots) => cachedSlots ?? []) : Promise.resolve([]),
            getScheduleSlotAdminData(),
        ]);
        const scheduleData = dbScheduleData ?? {
            slots: legacySlots,
            overrides,
            customSlots,
            scheduleSource: "SHEET_CACHE" as const,
        };

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

export const getCachedAdminTrialPayload = unstable_cache(
    async () => {
        const [leads, stats] = await Promise.all([
            getTrialLeads(),
            getTrialStats(),
        ]);

        return { leads, stats };
    },
    ["admin-trial-v1"],
    { revalidate: 30, tags: ["admin-trial"] },
);
