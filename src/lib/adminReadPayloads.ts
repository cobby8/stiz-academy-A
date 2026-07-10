import { unstable_cache } from "next/cache";
import {
    getAcademySettings,
    getClasses,
    getClassSlotOverrides,
    getCoaches,
    getCustomClassSlots,
    getPrograms,
    getSheetSlotCache,
    getStudents,
    getTrialLeads,
    getTrialStats,
} from "@/lib/queries";

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
