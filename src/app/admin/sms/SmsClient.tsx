"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
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
    requestedChannel?: Channel;
    provider?: string | null;
    source?: "AUTO" | "MANUAL" | "SECURITY";
    fallbackUsed?: boolean;
    unitCost?: number | null;
    currency?: string;
    errorCode?: string | null;
    status: "SENT" | "FAILED" | "PENDING" | "SENDING" | "UNCERTAIN" | "SKIPPED";
    recipient: string;
}

interface ManualSendResult {
    batchId: string;
    total: number;
    success: number;
    failed: number;
    uncertain: number;
    duplicateCount: number;
    invalidCount: number;
    results: Array<{
        recipient: string;
        last4: string;
        ok: boolean;
        status: "SENT" | "FAILED" | "UNCERTAIN" | "ALREADY_PROCESSED";
        uncertain?: boolean;
        reason?: string;
    }>;
    retryRecipients: string[];
}

const TABS: Array<{ id: CenterTab; label: string; icon: string }> = [
    { id: "automation", label: "자동 발송", icon: "automation" },
    { id: "templates", label: "템플릿", icon: "edit_note" },
    { id: "history", label: "발송 이력", icon: "history" },
    { id: "manual", label: "수동 발송", icon: "send" },
];

const AUDIENCE_META: Record<Audience, { label: string; icon: string; className: string }> = {
    INTERNAL: { label: "학원 내부", icon: "badge", className: "bg-[var(--doc-grid-head)] text-[var(--doc-ink-2)]  " },
    EXTERNAL: { label: "학원 외부", icon: "family_restroom", className: "bg-[var(--doc-grid-head)] text-[var(--doc-warn)]  " },
    SECURITY: { label: "인증·보안", icon: "shield_lock", className: "bg-[var(--doc-crit-soft)] text-[var(--doc-crit)]  " },
};

const CHANNEL_LABELS: Record<Channel, string> = {
    ALIMTALK: "카카오 알림톡",
    SMS: "SMS",
    LMS: "LMS",
    RCS: "RCS",
};

const SMS_ERROR_LABEL: Record<string, string> = {
    FAILED_DELIVERY_UNCERTAIN: "수신 여부 불확실 — 솔라피 이력 확인 필요",
    TEMPLATE_DISABLED_OR_MISSING: "템플릿 비활성화 — 솔라피 설정 확인 필요",
    INVALID_RECIPIENT: "수신 번호 오류",
    INSUFFICIENT_BALANCE: "솔라피 잔액 부족",
    BLOCKED_NUMBER: "수신 거부 번호",
};

export default function SmsClient({ coaches: initialCoaches }: { coaches?: CoachPhone[] }) {
    const [activeTab, setActiveTab] = useState<CenterTab>("automation");

    return (
        <div className="mx-auto max-w-6xl space-y-6">
            <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                    {/* 영문 장식문구·설명문구 제거: 아래 4개 탭이 그대로 설명 역할 */}
                    <h1 className="text-2xl font-bold text-[var(--doc-ink)]">메시지 관리</h1>
                </div>
                <ChannelReadiness />
            </header>

            <nav className="grid grid-cols-2 gap-2 rounded-[6px] border border-[var(--doc-rule)] bg-[var(--doc-surface)] p-2 sm:grid-cols-4" aria-label="메시지 관리 메뉴">
                {TABS.map(tab => (
                    <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveTab(tab.id)}
                        aria-current={activeTab === tab.id ? "page" : undefined}
                        className={`flex min-h-11 items-center justify-center gap-2 rounded-[3px] px-3 text-sm font-bold transition ${
 activeTab === tab.id
 ? "bg-[var(--doc-ink)] text-white "
 : "text-[var(--doc-ink-2)] hover:bg-[var(--doc-grid-head)] "
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
        <span className={`inline-flex items-center gap-1.5 rounded-[3px] px-3 py-1.5 ${
 ready
 ? "bg-[var(--doc-accent-soft)] text-[var(--doc-accent)] "
 : "bg-[var(--doc-grid-head)] text-[var(--doc-ink-2)] "
 }`}>
            <span className={`size-2 rounded-[3px] ${ready ? "bg-[var(--doc-accent)]" : "bg-[var(--doc-grid-head)]"}`} />
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
    const [rules, setRules] = useState<AutomationRule[]>([]);
    const [filter, setFilter] = useState<Audience>("INTERNAL");
    const [loading, setLoading] = useState(true);
    const [notice, setNotice] = useState<string | null>(null);
    const [loadFailed, setLoadFailed] = useState(false);

    const loadRules = useCallback(() => {
        let ignore = false;
        setLoading(true);
        setLoadFailed(false);
        setNotice(null);
        fetch("/api/admin/sms/automations", { cache: "no-store" })
            .then(response => {
                if (!response.ok) throw new Error("not-ready");
                return response.json() as Promise<{ rules: AutomationRule[] }>;
            })
            .then(data => {
                if (ignore) return;
                setRules(data.rules ?? []);
                if (!data.rules?.length) {
                    setLoadFailed(true);
                    setNotice("저장된 자동 발송 설정이 없습니다. 설정이 준비되기 전에는 자동 발송이 실행되지 않습니다.");
                }
            })
            .catch(() => {
                if (!ignore) {
                    setRules([]);
                    setLoadFailed(true);
                    setNotice("자동 발송 설정을 불러오지 못했습니다. 안전을 위해 설정을 임의로 표시하거나 발송하지 않습니다.");
                }
            })
            .finally(() => {
                if (!ignore) setLoading(false);
            });
        return () => {
            ignore = true;
        };
    }, []);

    useEffect(() => {
        return loadRules();
    }, [loadRules]);

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
                            className={`rounded-[6px] border p-4 text-left transition ${
 filter === audience
 ? "border-[var(--doc-accent)] bg-[var(--doc-surface)] "
 : "border-[var(--doc-rule)] bg-[var(--doc-surface)] hover:border-[var(--doc-rule)] "
 }`}
                        >
                            <span className={`material-symbols-outlined rounded-[3px] p-2 ${meta.className}`}>{meta.icon}</span>
                            <strong className="mt-3 block text-[var(--doc-ink)]">{meta.label}</strong>
                            <span className="text-xs text-[var(--doc-ink-2)]">자동 발송 {count}개</span>
                        </button>
                    );
                })}
            </div>

            {notice && <p className="rounded-[3px] border border-[var(--doc-rule)] bg-[var(--doc-grid-head)] p-3 text-sm text-[var(--doc-ink-2)]">{notice}</p>}

            <div className="space-y-3">
                {loading && <p className="rounded-[6px] border border-[var(--doc-rule)] bg-[var(--doc-surface)] p-8 text-center text-sm text-[var(--doc-ink-2)]">자동 발송 설정을 불러오는 중입니다.</p>}
                {!loading && loadFailed && (
                    <div className="rounded-[6px] border border-[var(--doc-crit)] bg-[var(--doc-crit-soft)] p-5 text-center">
                        <span className="material-symbols-outlined text-3xl text-[var(--doc-crit)]">error</span>
                        <p className="mt-2 text-sm font-bold text-[var(--doc-crit)]">실제 설정을 확인할 수 없습니다.</p>
                        <button type="button" onClick={loadRules} className="mt-3 min-h-11 rounded-[3px] bg-[var(--doc-ink)] px-5 text-sm font-bold text-white">
                            다시 불러오기
                        </button>
                    </div>
                )}
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
        <article className="rounded-[6px] border border-[var(--doc-rule)] bg-[var(--doc-surface)] p-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-[3px] px-2.5 py-1 text-xs font-bold ${meta.className}`}>{meta.label}</span>
                        {rule.locked && <span className="inline-flex items-center gap-1 rounded-[3px] bg-[var(--doc-grid-head)] px-2.5 py-1 text-xs font-bold text-[var(--doc-ink-2)]"><span className="material-symbols-outlined text-[14px]">lock</span>필수 발송</span>}
                        {!rule.configured && <span className="rounded-[3px] bg-[var(--doc-grid-head)] px-2.5 py-1 text-xs font-bold text-[var(--doc-warn)]">채널 연결 필요</span>}
                    </div>
                    <h2 className="mt-2 font-bold text-[var(--doc-ink)]">{rule.name}</h2>
                    <p className="mt-1 text-sm text-[var(--doc-ink-2)]">{rule.description}</p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3 xl:w-[520px]">
                    <label className="text-xs font-bold text-[var(--doc-ink-2)]">
                        우선 채널
                        <select
                            value={rule.primaryChannel}
                            disabled={disabled || rule.locked}
                            onChange={event => onUpdate({ primaryChannel: event.target.value as Channel })}
                            className="mt-1 block min-h-11 w-full rounded-[3px] border border-[var(--doc-rule)] bg-[var(--doc-surface)] px-3 text-sm font-semibold text-[var(--doc-ink)] disabled:opacity-60"
                        >
                            <option value="ALIMTALK">카카오 알림톡 · 13원</option>
                            <option value="SMS">SMS · 18원</option>
                            <option value="LMS">LMS · 45원</option>
                            <option value="RCS">RCS · 13원~</option>
                        </select>
                    </label>
                    <label className="text-xs font-bold text-[var(--doc-ink-2)]">
                        실패 시 대체
                        <select
                            value={rule.fallbackChannel}
                            disabled={disabled || rule.locked}
                            onChange={event => onUpdate({ fallbackChannel: event.target.value as AutomationRule["fallbackChannel"] })}
                            className="mt-1 block min-h-11 w-full rounded-[3px] border border-[var(--doc-rule)] bg-[var(--doc-surface)] px-3 text-sm font-semibold text-[var(--doc-ink)] disabled:opacity-60"
                        >
                            <option value="NONE">대체 안 함</option>
                            <option value="SMS">SMS</option>
                            <option value="LMS">LMS</option>
                        </select>
                    </label>
                    <div className="flex items-end justify-between gap-3">
                        <div className="pb-1">
                            <span className="block text-xs font-bold text-[var(--doc-ink-2)]">예상 단가</span>
                            <strong className="text-base text-[var(--doc-ink)]">{rule.estimatedUnitCost}원~/건</strong>
                        </div>
                        <button
                            type="button"
                            role="switch"
                            aria-checked={rule.isActive}
                            aria-label={`${rule.name} 자동 발송`}
                            title={rule.locked ? "인증·보안 알림은 끌 수 없습니다." : undefined}
                            disabled={disabled || rule.locked}
                            onClick={() => onUpdate({ isActive: !rule.isActive })}
                            className={`relative mb-1 h-7 w-12 rounded-[3px] transition disabled:cursor-not-allowed disabled:opacity-70 ${rule.isActive ? "bg-[var(--doc-accent)] " : "bg-[var(--doc-grid-head)] "}`}
                        >
                            <span className={`absolute top-1 size-5 rounded-[3px] bg-[var(--doc-surface)] transition ${rule.isActive ? "left-6" : "left-1"}`} />
                        </button>
                    </div>
                </div>
            </div>
        </article>
    );
}

function HistoryPanel() {
    const [items, setItems] = useState<DeliveryHistory[]>([]);
    const [loading, setLoading] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const loadHistory = useCallback(() => {
        setLoading(true);
        fetch("/api/admin/sms/history?limit=50", { cache: "no-store" })
            .then(response => {
                if (!response.ok) throw new Error("load-failed");
                return response.json() as Promise<{ deliveries: DeliveryHistory[] }>;
            })
            .then(data => {
                setItems(data.deliveries ?? []);
                setLoaded(true);
            })
            .catch(() => setItems([]))
            .finally(() => setLoading(false));
    }, []);

    return (
        <section className="overflow-hidden rounded-[6px] border border-[var(--doc-rule)] bg-[var(--doc-surface)]">
            <div className="border-b border-[var(--doc-rule)] p-5">
                <h2 className="font-bold text-[var(--doc-ink)]">최근 발송 이력</h2>
                <p className="mt-1 text-sm text-[var(--doc-ink-2)]">전화번호는 개인정보 보호를 위해 일부만 표시합니다.</p>
            </div>
            {!loaded && !loading ? (
                <div className="p-12 text-center">
                    <span className="material-symbols-outlined text-4xl text-[var(--doc-ink-3)]">history</span>
                    <p className="mt-2 font-bold text-[var(--doc-ink-2)]">발송 이력은 필요할 때만 불러옵니다.</p>
                    <button type="button" onClick={loadHistory} className="mt-4 min-h-11 rounded-[3px] bg-[var(--doc-ink)] px-5 text-sm font-bold text-white">
                        최근 50건 불러오기
                    </button>
                </div>
            ) : loading ? (
                <p className="p-10 text-center text-sm text-[var(--doc-ink-2)]">발송 이력을 불러오는 중입니다.</p>
            ) : items.length === 0 ? (
                <div className="p-12 text-center">
                    <span className="material-symbols-outlined text-4xl text-[var(--doc-ink-3)]">history</span>
                    <p className="mt-2 font-bold text-[var(--doc-ink-2)]">표시할 발송 이력이 없습니다.</p>
                    {/* 실제로는 조회가 정상 동작하고 단순히 0건인 상태이므로 사실에 맞게 표기 */}
                    <p className="mt-1 text-sm text-[var(--doc-ink-2)]">문자를 발송하면 성공·실패 결과가 여기에 표시됩니다.</p>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[980px] text-left text-sm">
                        <thead className="bg-[var(--doc-grid-head)] text-xs text-[var(--doc-ink-2)]">
                            <tr><th className="px-5 py-3">발송 시각</th><th className="px-5 py-3">알림</th><th className="px-5 py-3">출처</th><th className="px-5 py-3">구분</th><th className="px-5 py-3">실제 채널</th><th className="px-5 py-3">수신자</th><th className="px-5 py-3">결과·사유</th></tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--doc-rule)]">
                            {items.map(item => (
                                <tr key={item.id}>
                                    <td className="px-5 py-4 text-[var(--doc-ink-2)]">{item.sentAt}</td>
                                    <td className="px-5 py-4 font-bold text-[var(--doc-ink)]">{item.name}</td>
                                    <td className="px-5 py-4">{item.source === "MANUAL" ? "수동" : item.source === "SECURITY" ? "보안" : "자동"}</td>
                                    <td className="px-5 py-4">{AUDIENCE_META[item.audience]?.label ?? item.audience}</td>
                                    <td className="px-5 py-4">
                                        <span>{CHANNEL_LABELS[item.channel] ?? item.channel}</span>
                                        {item.requestedChannel && item.requestedChannel !== item.channel && (
                                            <span className="mt-1 block text-xs text-[var(--doc-ink-3)]">
                                                요청 {CHANNEL_LABELS[item.requestedChannel] ?? item.requestedChannel}
                                            </span>
                                        )}
                                        {item.fallbackUsed && <span className="ml-1 rounded bg-[var(--doc-grid-head)] px-1.5 py-0.5 text-[11px] font-bold text-[var(--doc-warn)]">대체 발송</span>}
                                        {item.provider && <span className="mt-1 block text-xs text-[var(--doc-ink-3)]">{item.provider}</span>}
                                        {item.unitCost !== null && item.unitCost !== undefined && (
                                            <span className="mt-1 block text-xs text-[var(--doc-ink-3)]">
                                                {item.unitCost.toLocaleString("ko-KR")} {item.currency === "KRW" ? "원" : item.currency}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-5 py-4">{item.recipient}</td>
                                    <td className="px-5 py-4">
                                        <DeliveryBadge status={item.status} />
                                        {item.errorCode && <span className="mt-1 block text-xs text-[var(--doc-crit)]">{SMS_ERROR_LABEL[item.errorCode] ?? "발송 오류 — 솔라피 이력 확인 필요"}</span>}
                                    </td>
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
    const labels = { SENT: "접수 완료", FAILED: "실패", PENDING: "대기", SENDING: "확인 중", UNCERTAIN: "확인 필요", SKIPPED: "미발송" };
    const colors = {
        SENT: "bg-[var(--doc-accent-soft)] text-[var(--doc-accent)]",
        FAILED: "bg-[var(--doc-crit-soft)] text-[var(--doc-crit)]",
        PENDING: "bg-[var(--doc-grid-head)] text-[var(--doc-ink-2)]",
        SENDING: "bg-[var(--doc-grid-head)] text-[var(--doc-warn)]",
        UNCERTAIN: "bg-[var(--doc-grid-head)] text-[var(--doc-warn)]",
        SKIPPED: "bg-[var(--doc-grid-head)] text-[var(--doc-ink-2)]",
    };
    return <span className={`rounded-[3px] px-2.5 py-1 text-xs font-bold ${colors[status]}`}>{labels[status]}</span>;
}

function ManualSendPanel({ initialCoaches }: { initialCoaches?: CoachPhone[] }) {
    const hasInitialCoaches = initialCoaches !== undefined;
    const [pending, startTransition] = useTransition();
    const [coaches, setCoaches] = useState(initialCoaches ?? []);
    const [mode, setMode] = useState<"all" | "select" | "manual">("all");
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [manualNumbers, setManualNumbers] = useState("");
    const [message, setMessage] = useState("");
    const [result, setResult] = useState<ManualSendResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    // 응답을 잃어버린 재시도에는 같은 번호표를 써서 중복 발송을 막습니다.
    const requestIdRef = useRef<string | null>(null);
    const requestPayloadRef = useRef<string | null>(null);

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

    const resetRequest = useCallback(() => {
        requestIdRef.current = null;
        requestPayloadRef.current = null;
        setResult(null);
        setError(null);
    }, []);

    function send(targetRecipients: string[] = recipients, retry = false) {
        if (!targetRecipients.length || !message.trim()) {
            setError("수신자와 메시지를 모두 입력해주세요.");
            return;
        }
        if (!confirm(`${targetRecipients.length}명에게 문자를 발송할까요?`)) return;

        const payloadKey = JSON.stringify([targetRecipients, message.trim()]);
        // 실제 실패 건 재발송은 새로운 발송이고, 응답 유실 재시도만 기존 ID를 이어 씁니다.
        if (retry || requestPayloadRef.current !== payloadKey || !requestIdRef.current) {
            requestIdRef.current = crypto.randomUUID();
            requestPayloadRef.current = payloadKey;
        }
        const requestId = requestIdRef.current;

        setError(null);
        setResult(null);
        startTransition(async () => {
            try {
                const response = await sendManualSms(targetRecipients, message.trim(), { requestId });
                setResult(response);
                // 서버가 결과를 확정했으므로 다음 발송부터는 새 요청 ID를 사용합니다.
                requestIdRef.current = null;
                requestPayloadRef.current = null;
                if (response.success > 0 && response.failed === 0 && response.uncertain === 0) setMessage("");
            } catch (caught) {
                // 응답 유실 가능성이 있어 ID를 유지합니다. 같은 내용 재시도 시 서버가 중복을 차단합니다.
                setError(caught instanceof Error ? caught.message : "문자를 발송하지 못했습니다.");
            }
        });
    }

    return (
        <section className="grid gap-5 lg:grid-cols-[1fr_1.15fr]">
            <div className="rounded-[6px] border border-[var(--doc-rule)] bg-[var(--doc-surface)] p-5">
                <h2 className="font-bold text-[var(--doc-ink)]">수신자 선택</h2>
                <div className="mt-4 grid grid-cols-3 gap-2">
                    {[
                        { id: "all" as const, label: "전체 직원" },
                        { id: "select" as const, label: "직원 선택" },
                        { id: "manual" as const, label: "직접 입력" },
                    ].map(option => (
                        <button key={option.id} type="button" onClick={() => { setMode(option.id); resetRequest(); }} className={`min-h-11 rounded-[3px] px-2 text-sm font-bold ${mode === option.id ? "bg-[var(--doc-ink)] text-white" : "bg-[var(--doc-grid-head)] text-[var(--doc-ink-2)] "}`}>{option.label}</button>
                    ))}
                </div>
                {mode === "all" && <p className="mt-4 rounded-[3px] bg-[var(--doc-grid-head)] p-4 text-sm text-[var(--doc-ink-2)]">연락처가 등록된 직원 <strong>{coaches.length}명</strong>에게 발송합니다.</p>}
                {mode === "select" && (
                    <div className="mt-4 max-h-72 space-y-1 overflow-auto">
                        {coaches.map(coach => (
                            <label key={coach.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-[3px] px-3 hover:bg-[var(--doc-grid-head)]">
                                <input
                                    type="checkbox"
                                    checked={selectedIds.has(coach.id)}
                                    onChange={() => setSelectedIds(current => {
                                        resetRequest();
                                        const next = new Set(current);
                                        if (next.has(coach.id)) next.delete(coach.id); else next.add(coach.id);
                                        return next;
                                    })}
                                    className="size-4"
                                />
                                <span className="font-bold text-[var(--doc-ink)]">{coach.name}</span>
                                <span className="ml-auto text-xs text-[var(--doc-ink-2)]">{coach.role}</span>
                            </label>
                        ))}
                    </div>
                )}
                {mode === "manual" && <textarea value={manualNumbers} onChange={event => { setManualNumbers(event.target.value); resetRequest(); }} rows={7} placeholder={"010-1234-5678\n010-9876-5432"} className="mt-4 w-full resize-none rounded-[3px] border border-[var(--doc-rule)] bg-[var(--doc-grid-head)] p-3 text-sm" />}
            </div>

            <div className="rounded-[6px] border border-[var(--doc-rule)] bg-[var(--doc-surface)] p-5">
                <h2 className="font-bold text-[var(--doc-ink)]">메시지 작성</h2>
                <textarea value={message} onChange={event => { setMessage(event.target.value); resetRequest(); }} rows={9} maxLength={1000} placeholder="보낼 메시지를 입력하세요." className="mt-4 w-full resize-none rounded-[3px] border border-[var(--doc-rule)] bg-[var(--doc-grid-head)] p-3 text-sm" />
                <div className="mt-2 flex justify-between text-xs text-[var(--doc-ink-2)]">
                    <span>발송할 때 [STIZ]가 자동으로 붙습니다.</span>
                    <strong>{bytes}바이트 · {bytes > 90 ? "LMS" : "SMS"}</strong>
                </div>
                {result && (
                    <div className="mt-4 space-y-3">
                        <p className="rounded-[3px] bg-[var(--doc-accent-soft)] p-3 text-sm font-bold text-[var(--doc-accent)]">
                            전체 {result.total}건 · 성공 {result.success}건 · 실패 {result.failed}건 · 확인 필요 {result.uncertain}건
                            {(result.duplicateCount > 0 || result.invalidCount > 0) && <span className="mt-1 block text-xs font-medium">중복 제외 {result.duplicateCount}건 · 잘못된 번호 제외 {result.invalidCount}건</span>}
                        </p>
                        {result.uncertain > 0 && (
                            <p role="alert" className="flex gap-2 rounded-[3px] border border-[var(--doc-warn)] bg-[var(--doc-grid-head)] p-3 text-sm font-bold text-[var(--doc-warn)]">
                                <span className="material-symbols-outlined text-[19px]">warning</span>
                                발송 여부를 확인할 수 없는 {result.uncertain}건은 재발송하면 안 됩니다. 발송 이력에서 먼저 확인해 주세요.
                            </p>
                        )}
                        {result.results.length > 0 && (
                            <ul className="max-h-40 space-y-1 overflow-auto rounded-[3px] border border-[var(--doc-rule)] p-2 text-xs">
                                {result.results.map((item, index) => (
                                    <li key={`${item.last4}-${index}`} className="flex items-center justify-between gap-3 rounded-[3px] px-2 py-1.5">
                                        <span className="text-[var(--doc-ink-2)]">휴대폰 끝자리 {item.last4}</span>
                                        <strong className={item.status === "FAILED" ? "text-[var(--doc-crit)]" : item.status === "UNCERTAIN" ? "text-[var(--doc-warn)] " : "text-[var(--doc-accent)] "}>
                                            {item.status === "SENT" ? "성공" : item.status === "FAILED" ? "실패" : item.status === "UNCERTAIN" ? "확인 필요" : "이미 처리됨"}
                                        </strong>
                                    </li>
                                ))}
                            </ul>
                        )}
                        {result.retryRecipients.length > 0 && (
                            <button type="button" onClick={() => send(result.retryRecipients, true)} disabled={pending} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-[3px] border border-[var(--doc-crit)] bg-[var(--doc-crit-soft)] font-bold text-[var(--doc-crit)] disabled:opacity-40">
                                <span className="material-symbols-outlined text-[19px]">refresh</span>
                                실패 {result.retryRecipients.length}건만 다시 발송
                            </button>
                        )}
                    </div>
                )}
                {error && <p className="mt-4 rounded-[3px] bg-[var(--doc-crit-soft)] p-3 text-sm font-bold text-[var(--doc-crit)]">{error}</p>}
                <button type="button" onClick={() => send()} disabled={pending || !recipients.length || !message.trim() || Boolean(result?.uncertain)} className="mt-5 flex min-h-11 w-full items-center justify-center gap-2 rounded-[3px] bg-[var(--doc-ink)] font-bold text-white disabled:opacity-40">
                    <span className="material-symbols-outlined text-[19px]">send</span>
                    {pending ? "발송 중..." : result?.uncertain ? "발송 이력 확인 후 새로 작성" : `${recipients.length}명에게 발송`}
                </button>
            </div>
        </section>
    );
}
