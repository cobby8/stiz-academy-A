import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";

type TimingRecord = {
    name: string;
    durationMs: number;
};

export type AdminTiming = ReturnType<typeof createAdminTiming>;

function nowMs() {
    return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function metricName(name: string) {
    return name.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80) || "step";
}

function formatDuration(durationMs: number) {
    return Math.max(0, durationMs).toFixed(1);
}

export function createAdminTiming(routeName: string) {
    const startedAt = nowMs();
    const records: TimingRecord[] = [];

    return {
        async measure<T>(name: string, task: () => Promise<T>): Promise<T> {
            const stepStartedAt = nowMs();

            try {
                return await task();
            } finally {
                records.push({
                    name,
                    durationMs: nowMs() - stepStartedAt,
                });
            }
        },
        responseInit(init: ResponseInit = {}): ResponseInit {
            const headers = new Headers(init.headers);
            const totalDuration = nowMs() - startedAt;
            const serverTiming = [
                ...records.map(
                    (record) => `${metricName(record.name)};dur=${formatDuration(record.durationMs)}`,
                ),
                `${metricName(`${routeName}_total`)};dur=${formatDuration(totalDuration)}`,
            ].join(", ");

            headers.set("Server-Timing", serverTiming);

            return {
                ...init,
                headers,
            };
        },
    };
}

export async function requireTimedAdmin(timing: AdminTiming) {
    return timing.measure("auth", () => requireAdmin());
}

export function timedJson<T>(timing: AdminTiming, body: T, init?: ResponseInit) {
    return NextResponse.json(body, timing.responseInit(init));
}
