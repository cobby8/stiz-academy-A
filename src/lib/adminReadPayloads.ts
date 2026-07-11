import { unstable_cache } from "next/cache";
import { getInstagramRuntimeStatus } from "@/lib/instagram";
import {
    getAcademySettings,
    getAllCoaches,
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

export const getCachedAdminStudentsPayload = unstable_cache(
    async () => {
        const [students, classes] = await Promise.all([
            getStudents(),
            getClasses(),
        ]);

        return { students, classes };
    },
    ["admin-students-v1"],
    { revalidate: 60, tags: ["admin-students", "admin-classes"] },
);

export const getCachedAdminDashboardPrimaryPayload = unstable_cache(
    async () => {
        const [stats, pendingCount, enrollStats, todayClasses] = await Promise.all([
            getDashboardStats(),
            getPendingRequestCount(),
            getEnrollApplicationStats(),
            getTodayClasses(),
        ]);

        return {
            stats,
            pendingRequests: [],
            pendingCount,
            enrollStats,
            extendedStats: getEmptyExtendedStats(),
            todayClasses,
            recentStudents: [],
            todayLabel: getTodayLabel(),
        };
    },
    ["admin-dashboard-primary-v1"],
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

export const getCachedAdminSchedulePayload = unstable_cache(
    async () => {
        const settings = await (getAcademySettings() as Promise<any>);
        const sheetUrl = settings?.googleSheetsScheduleUrl as string | null | undefined;

        const [overrides, coaches, customSlots, programs, slots] = await Promise.all([
            getClassSlotOverrides(),
            getCoaches(),
            getCustomClassSlots(),
            getPrograms(),
            sheetUrl ? getSheetSlotCache().then((cachedSlots) => cachedSlots ?? []) : Promise.resolve([]),
        ]);

        return {
            slots,
            overrides,
            coaches,
            customSlots,
            hasSheetUrl: Boolean(sheetUrl),
            sheetUrl: sheetUrl ?? null,
            programs,
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
