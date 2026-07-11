import { unstable_cache } from "next/cache";
import {
    getAcademySettings,
    getAllTestimonials,
    getBillingTemplates,
    getClasses,
    getClassSlotOverrides,
    getCoaches,
    getCustomClassSlots,
    getDashboardExtendedStats,
    getDashboardStats,
    getEnrollApplicationStats,
    getPendingRequestCount,
    getRecentPendingRequests,
    getPrograms,
    getSheetSlotCache,
    getSmsTemplates,
    getStudents,
    getTrialLeads,
    getTrialStats,
} from "@/lib/queries";
import { prisma } from "@/lib/prisma";

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
