"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { getCoachPhones, sendManualSms } from "@/app/actions/admin";
import SmsTemplateClient from "./templates/SmsTemplateClient";

interface CoachPhone {
    id: string;
    name: string;
    role: string;
    phone: string;
}

type CenterTab = "automation" | "templates" | "history" | "manual";
type Audience = "INTERNAL" | "EXTERNAL" | "SECURITY";
type Channel = "ALIMTALK" | "SMS" | "LMS" | "RCS";

interface AutomationRule {
    id: string;
    name: string;
    description: string;
    audience: Audience;
    isActive: boolean;
    locked: boolean;
    primaryChannel: Channel;
    fallbackChannel: "SMS" | "LMS" | "NONE";
    configured: boolean;
    estimatedUnitCost: number;
}

interface DeliveryHistory {
    id: string;
    sentAt: string;
    name: string;
    audience: Audience;
    channel: Channel;
    status: "SENT" | "FAILED" | "PENDING" | "SKIPPED";
    recipient: string;
}

const TABS: Array<{ id: CenterTab; label: string; icon: string }> = [
    { id: "automation", label: "자동 발송", icon: "automation" },
    { id: "templates", label: "템플릿", icon: "edit_note" },
    { id: "history", label: "발송 이력", icon: "history" },
    { id: "manual", label: "수동 발송", icon: "send" },
];

const AUDIENCE_META: Record<Audience, { label: string; icon: string; className: string }> = {
    INTERNAL: { label: "학원 내부", icon: "badge", className: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-200" },
    EXTERNAL: { label: "학원 외부", icon: "family_restroom", className: "bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-200" },
    SECURITY: { label: "인증·보안", icon: "shield_lock", className: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-200" },
};

const CHANNEL_LABELS: Record<Channel, string> = {
    ALIMTALK: "카카오 알림톡",
    SMS: "SMS",
    LMS: "LMS",
    RCS: "RCS",
};

const DEFAULT_RULES: AutomationRule[] = [
    {
        id: "staff-notification",
        name: "담당 선생님 업무 알림",
        description: "체험·수강 신청과 일정 변경 내용을 담당 선생님에게 알립니다.",
        audience: "INTERNAL",
        isActive: true,
        locked: false,
        primaryChannel: "SMS",
        fallbackChannel: "NONE",
        configured: true,
        estimatedUnitCost: 18,
    },
    {
        id: "parent-schedule",
        name: "학부모 일정·승인 안내",
        description: "체험 완료, 수강 승인, 결제와 일정 안내를 학부모에게 발송합니다.",
        audience: "EXTERNAL",
        isActive: true,
        locked: false,
        primaryChannel: "ALIMTALK",
        fallbackChannel: "LMS",
        configured: false,
        estimatedUnitCost: 13,
    },
    {
        id: "phone-verification",
        name: "휴대폰 본인인증",
        description: "회원가입과 직원 인증번호입니다. 계정 보호를 위해 끌 수 없습니다.",
        audience: "SECURITY",
        isActive: true,
        locked: true,
        primaryChannel: "SMS",
        fallbackChannel: "NONE",
        configured: true,
        estimatedUnitCost: 18,
    },
];

export default function SmsClient({ coaches: initialCoaches }: { coaches?: CoachPhone[] }) {
    const [activeTab, setActiveTab] = useState<CenterTab>("automation");

    return (
        <div className="mx-auto max-w-6xl space-y-6">
            <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                    <p className="mb-1 text-xs font-bold uppercase tracking-[0.16em] text-brand-orange-500 dark:text-brand-neon-lime">Message center</p>
                    <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">메시지 관리</h1>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        학원 내부와 외부 알림을 나누고, 자동 발송부터 결과 확인까지 한곳에서 관리합니다.
                    </p>
                </div>
                <ChannelReadiness />
            </header>

            <nav className="grid grid-cols-2 gap-2 rounded-2xl border border-gray-200 bg-white p-2 shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:grid-cols-4" aria-label="메시지 관리 메뉴">
                {TABS.map(tab => (
                    <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveTab(tab.id)}
                        aria-current={activeTab === tab.id ? "page" : undefined}
                        className={`flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-sm font-bold transition ${
                            activeTab === tab.id
                                ? "bg-brand-navy-900 text-white shadow-sm"
                                : "text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"
                        }`}
                    >
                        <span className="material-symbols-outlined text-[19px]">{tab.icon}</span>
                        {tab.label}
                    </button>
                ))}
            </nav>

            {activeTab === "automation" && <AutomationPanel />}
            {activeTab === "templates" && <SmsTemplateClient />}
            {activeTab === "history" && <HistoryPanel />}
            {activeTab === "manual" && <ManualSendPanel initialCoaches={initialCoaches} />}
        </div>
    );
}

function ChannelReadiness() {
    const [channels, setChannels] = useState({ SMS: false, ALIMTALK: false, RCS: false });
    useEffect(() => {
        let ignore = false;
        fetch("/api/admin/sms/channels", { cache: "no-store" })
            .then(response => {
                if (!response.ok) throw new Error("load-failed");
                return response.json() as Promise<{ channels: typeof channels }>;
            })
            .then(data => {
                if (!ignore) setChannels(data.channels);
            })
            .catch(() => undefined);
        return () => {
            ignore = true;
        };
    }, []);

    const badge = (label: string, ready: boolean) => (
        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 ${
            ready
                ? "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-200"
                : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
        }`}>
            <span className={`size-2 rounded-full ${ready ? "bg-green-500" : "bg-gray-400"}`} />
            {label} {ready ? "연결됨" : "준비 필요"}
        </span>
    );
    return (
        <div className="flex flex-wrap gap-2 text-xs font-bold">
            {badge("SMS", channels.SMS)}
            {badge("알림톡", channels.ALIMTALK)}
            {badge("RCS", channels.RCS)}
        </div>
    );
}

function AutomationPanel() {
    const [rules, setRules] = useState<AutomationRule[]>(DEFAULT_RULES);
    const [filter, setFilter] = useState<Audience>("INTERNAL");
    const [loading, setLoading] = useState(true);
    const [notice, setNotice] = useState<string | null>(null);

    useEffect(() => {
        let ignore = false;
        fetch("/api/admin/sms/automations", { cache: "no-store" })
            .then(response => {
                if (!response.ok) throw new Error("not-ready");
                return response.json() as Promise<{ rules: AutomationRule[] }>;
            })
            .then(data => {
                if (!ignore && data.rules?.length) setRules(data.rules);
            })
            .catch(() => {
                if (!ignore) setNotice("현재 저장된 문자 설정을 표시합니다. 카카오·RCS 연결 후 채널 설정을 저장할 수 있습니다.");
            })
            .finally(() => {
                if (!ignore) setLoading(false);
            });
        return () => {
            ignore = true;
        };
    }, []);

    const updateRule = useCallback(async (id: string, patch: Partial<AutomationRule>) => {
        const previous = rules;
        setRules(current => current.map(rule => (rule.id === id ? { ...rule, ...patch } : rule)));
        setNotice("설정을 저장하는 중입니다.");
        try {
            const response = await fetch(`/api/admin/sms/automations/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(patch),
            });
            if (!response.ok) throw new Error("save-failed");
            setNotice("자동 발송 설정을 저장했습니다.");
        } catch {
            setRules(previous);
            setNotice("아직 설정 저장 기능이 연결되지 않았습니다. 기존 발송 설정은 변경되지 않았습니다.");
        }
    }, [rules]);

    const filteredRules = rules.filter(rule => rule.audience === filter);
    return (
        <section className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">
                {(Object.keys(AUDIENCE_META) as Audience[]).map(audience => {
                    const meta = AUDIENCE_META[audience];
                    const count = rules.filter(rule => rule.audience === audience).length;
                    return (
                        <button
                            key={audience}
                            type="button"
                            onClick={() => setFilter(audience)}
                            className={`rounded-2xl border p-4 text-left transition ${
                                filter === audience
                                    ? "border-brand-orange-500 bg-white shadow-sm dark:border-brand-neon-lime dark:bg-gray-800"
                                    : "border-gray-200 bg-white hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800"
                            }`}
                        >
                            <span className={`material-symbols-outlined rounded-xl p-2 ${meta.className}`}>{meta.icon}</span>
                            <strong className="mt-3 block text-gray-900 dark:text-white">{meta.label}</strong>
                            <span className="text-xs text-gray-500 dark:text-gray-400">자동 발송 {count}개</span>
                        </button>
                    );
                })}
            </div>

            {notice && <p className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200">{notice}</p>}

            <div className="space-y-3">
                {filteredRules.map(rule => (
                    <AutomationCard key={rule.id} rule={rule} disabled={loading} onUpdate={patch => void updateRule(rule.id, patch)} />
                ))}
            </div>
        </section>
    );
}

function AutomationCard({ rule, disabled, onUpdate }: { rule: AutomationRule; disabled: boolean; onUpdate: (patch: Partial<AutomationRule>) => void }) {
    const meta = AUDIENCE_META[rule.audience];
    return (
        <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${meta.className}`}>{meta.label}</span>
                        {rule.locked && <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-600 dark:bg-gray-700 dark:text-gray-200"><span className="material-symbols-outlined text-[14px]">lock</span>필수 발송</span>}
                        {!rule.configured && <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700 dark:bg-amber-950/30 dark:text-amber-200">채널 연결 필요</span>}
                    </div>
                    <h2 className="mt-2 font-extrabold text-gray-900 dark:text-white">{rule.name}</h2>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{rule.description}</p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3 xl:w-[520px]">
                    <label className="text-xs font-bold text-gray-500 dark:text-gray-400">
                        우선 채널
                        <select
                            value={rule.primaryChannel}
                            disabled={disabled || rule.locked}
                            onChange={event => onUpdate({ primaryChannel: event.target.value as Channel })}
                            className="mt-1 block min-h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-800 disabled:opacity-60 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                        >
                            <option value="ALIMTALK">카카오 알림톡 · 13원</option>
                            <option value="SMS">SMS · 18원</option>
                            <option value="LMS">LMS · 45원</option>
                            <option value="RCS">RCS · 13원~</option>
                        </select>
                    </label>
                    <label className="text-xs font-bold text-gray-500 dark:text-gray-400">
                        실패 시 대체
                        <select
                            value={rule.fallbackChannel}
                            disabled={disabled || rule.locked}
                            onChange={event => onUpdate({ fallbackChannel: event.target.value as AutomationRule["fallbackChannel"] })}
                            className="mt-1 block min-h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-800 disabled:opacity-60 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                        >
                            <option value="NONE">대체 안 함</option>
                            <option value="SMS">SMS</option>
                            <option value="LMS">LMS</option>
                        </select>
                    </label>
                    <div className="flex items-end justify-between gap-3">
                        <div className="pb-1">
                            <span className="block text-xs font-bold text-gray-500 dark:text-gray-400">예상 단가</span>
                            <strong className="text-base text-gray-900 dark:text-white">{rule.estimatedUnitCost}원~/건</strong>
                        </div>
                        <button
                            type="button"
                            role="switch"
                            aria-checked={rule.isActive}
                            aria-label={`${rule.name} 자동 발송`}
                            title={rule.locked ? "인증·보안 알림은 끌 수 없습니다." : undefined}
                            disabled={disabled || rule.locked}
                            onClick={() => onUpdate({ isActive: !rule.isActive })}
                            className={`relative mb-1 h-7 w-12 rounded-full transition disabled:cursor-not-allowed disabled:opacity-70 ${rule.isActive ? "bg-brand-orange-500 dark:bg-brand-neon-lime" : "bg-gray-300 dark:bg-gray-600"}`}
                        >
                            <span className={`absolute top-1 size-5 rounded-full bg-white shadow transition ${rule.isActive ? "left-6" : "left-1"}`} />
                        </button>
                    </div>
                </div>
            </div>
        </article>
    );
}

function HistoryPanel() {
    const [items, setItems] = useState<DeliveryHistory[]>([]);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        fetch("/api/admin/sms/history?limit=50", { cache: "no-store" })
            .then(response => {
                if (!response.ok) throw new Error("load-failed");
                return response.json() as Promise<{ deliveries: DeliveryHistory[] }>;
            })
            .then(data => setItems(data.deliveries ?? []))
            .catch(() => setItems([]))
            .finally(() => setLoading(false));
    }, []);

    return (
        <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="border-b border-gray-200 p-5 dark:border-gray-700">
                <h2 className="font-extrabold text-gray-900 dark:text-white">최근 발송 이력</h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">전화번호는 개인정보 보호를 위해 일부만 표시합니다.</p>
            </div>
            {loading ? (
                <p className="p-10 text-center text-sm text-gray-500">발송 이력을 불러오는 중입니다.</p>
            ) : items.length === 0 ? (
                <div className="p-12 text-center">
                    <span className="material-symbols-outlined text-4xl text-gray-300">history</span>
                    <p className="mt-2 font-bold text-gray-700 dark:text-gray-200">표시할 발송 이력이 없습니다.</p>
                    <p className="mt-1 text-sm text-gray-500">발송 이력 API가 연결되면 성공·실패 결과가 여기에 표시됩니다.</p>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] text-left text-sm">
                        <thead className="bg-gray-50 text-xs text-gray-500 dark:bg-gray-900 dark:text-gray-400">
                            <tr><th className="px-5 py-3">발송 시각</th><th className="px-5 py-3">알림</th><th className="px-5 py-3">구분</th><th className="px-5 py-3">채널</th><th className="px-5 py-3">수신자</th><th className="px-5 py-3">결과</th></tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {items.map(item => (
                                <tr key={item.id}>
                                    <td className="px-5 py-4 text-gray-500">{item.sentAt}</td>
                                    <td className="px-5 py-4 font-bold text-gray-900 dark:text-white">{item.name}</td>
                                    <td className="px-5 py-4">{AUDIENCE_META[item.audience]?.label ?? item.audience}</td>
                                    <td className="px-5 py-4">{CHANNEL_LABELS[item.channel] ?? item.channel}</td>
                                    <td className="px-5 py-4">{item.recipient}</td>
                                    <td className="px-5 py-4"><DeliveryBadge status={item.status} /></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
}

function DeliveryBadge({ status }: { status: DeliveryHistory["status"] }) {
    const labels = { SENT: "접수 완료", FAILED: "실패", PENDING: "처리 중", SKIPPED: "미발송" };
    const colors = {
        SENT: "bg-green-50 text-green-700",
        FAILED: "bg-red-50 text-red-700",
        PENDING: "bg-blue-50 text-blue-700",
        SKIPPED: "bg-gray-100 text-gray-600",
    };
    return <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${colors[status]}`}>{labels[status]}</span>;
}

function ManualSendPanel({ initialCoaches }: { initialCoaches?: CoachPhone[] }) {
    const hasInitialCoaches = initialCoaches !== undefined;
    const [pending, startTransition] = useTransition();
    const [coaches, setCoaches] = useState(initialCoaches ?? []);
    const [mode, setMode] = useState<"all" | "select" | "manual">("all");
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [manualNumbers, setManualNumbers] = useState("");
    const [message, setMessage] = useState("");
    const [result, setResult] = useState<{ total: number; success: number; failed: number } | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (hasInitialCoaches) return;
        getCoachPhones().then(setCoaches).catch(() => setError("직원 연락처를 불러오지 못했습니다."));
    }, [hasInitialCoaches]);

    const recipients = useMemo(() => {
        if (mode === "all") return coaches.map(coach => coach.phone);
        if (mode === "select") return coaches.filter(coach => selectedIds.has(coach.id)).map(coach => coach.phone);
        return manualNumbers.split(/[,;\n]+/).map(value => value.trim().replace(/\D/g, "")).filter(value => value.length >= 10);
    }, [coaches, manualNumbers, mode, selectedIds]);
    const bytes = new TextEncoder().encode(`[STIZ] ${message}`).length;

    function send() {
        if (!recipients.length || !message.trim()) {
            setError("수신자와 메시지를 모두 입력해주세요.");
            return;
        }
        if (!confirm(`${recipients.length}명에게 문자를 발송할까요?`)) return;
        setError(null);
        setResult(null);
        startTransition(async () => {
            try {
                const response = await sendManualSms(recipients, message.trim());
                setResult(response);
                if (response.success > 0) setMessage("");
            } catch (caught) {
                setError(caught instanceof Error ? caught.message : "문자를 발송하지 못했습니다.");
            }
        });
    }

    return (
        <section className="grid gap-5 lg:grid-cols-[1fr_1.15fr]">
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                <h2 className="font-extrabold text-gray-900 dark:text-white">수신자 선택</h2>
                <div className="mt-4 grid grid-cols-3 gap-2">
                    {[
                        { id: "all" as const, label: "전체 직원" },
                        { id: "select" as const, label: "직원 선택" },
                        { id: "manual" as const, label: "직접 입력" },
                    ].map(option => (
                        <button key={option.id} type="button" onClick={() => setMode(option.id)} className={`min-h-11 rounded-xl px-2 text-sm font-bold ${mode === option.id ? "bg-brand-navy-900 text-white" : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-200"}`}>{option.label}</button>
                    ))}
                </div>
                {mode === "all" && <p className="mt-4 rounded-xl bg-blue-50 p-4 text-sm text-blue-700 dark:bg-blue-950/30 dark:text-blue-200">연락처가 등록된 직원 <strong>{coaches.length}명</strong>에게 발송합니다.</p>}
                {mode === "select" && (
                    <div className="mt-4 max-h-72 space-y-1 overflow-auto">
                        {coaches.map(coach => (
                            <label key={coach.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-3 hover:bg-gray-50 dark:hover:bg-gray-700">
                                <input
                                    type="checkbox"
                                    checked={selectedIds.has(coach.id)}
                                    onChange={() => setSelectedIds(current => {
                                        const next = new Set(current);
                                        if (next.has(coach.id)) next.delete(coach.id); else next.add(coach.id);
                                        return next;
                                    })}
                                    className="size-4"
                                />
                                <span className="font-bold text-gray-800 dark:text-gray-100">{coach.name}</span>
                                <span className="ml-auto text-xs text-gray-500">{coach.role}</span>
                            </label>
                        ))}
                    </div>
                )}
                {mode === "manual" && <textarea value={manualNumbers} onChange={event => setManualNumbers(event.target.value)} rows={7} placeholder={"010-1234-5678\n010-9876-5432"} className="mt-4 w-full resize-none rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white" />}
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                <h2 className="font-extrabold text-gray-900 dark:text-white">메시지 작성</h2>
                <textarea value={message} onChange={event => setMessage(event.target.value)} rows={9} maxLength={1000} placeholder="보낼 메시지를 입력하세요." className="mt-4 w-full resize-none rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white" />
                <div className="mt-2 flex justify-between text-xs text-gray-500">
                    <span>발송할 때 [STIZ]가 자동으로 붙습니다.</span>
                    <strong>{bytes}바이트 · {bytes > 90 ? "LMS" : "SMS"}</strong>
                </div>
                {result && <p className="mt-4 rounded-xl bg-green-50 p-3 text-sm font-bold text-green-700">전체 {result.total}건 · 성공 {result.success}건 · 실패 {result.failed}건</p>}
                {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}
                <button type="button" onClick={send} disabled={pending || !recipients.length || !message.trim()} className="mt-5 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand-navy-900 font-bold text-white disabled:opacity-40">
                    <span className="material-symbols-outlined text-[19px]">send</span>
                    {pending ? "발송 중..." : `${recipients.length}명에게 발송`}
                </button>
            </div>
        </section>
    );
}
