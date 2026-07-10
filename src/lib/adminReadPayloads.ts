import { unstable_cache } from "next/cache";
import {
    getClasses,
    getPrograms,
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
