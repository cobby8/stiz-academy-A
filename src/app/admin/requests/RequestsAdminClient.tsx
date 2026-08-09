"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { updateRequestStatus, deleteParentRequest } from "@/app/actions/admin";

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
    ABSENCE: { label: "결석 신청", color: "bg-[var(--doc-crit-soft)] text-[var(--doc-crit)]" },
    SHUTTLE: { label: "셔틀 변경", color: "bg-[var(--doc-grid-head)] text-[var(--doc-ink-2)]" },
    EARLY_LEAVE: { label: "조퇴 요청", color: "bg-[var(--doc-grid-head)] text-[var(--doc-warn)]" },
    OTHER: { label: "기타", color: "bg-[var(--doc-grid-head)]  text-[var(--doc-ink-2)] " },
};

const STATUS_OPTIONS = [
    { value: "PENDING", label: "대기중", color: "bg-[var(--doc-grid-head)] text-[var(--doc-warn)]", iconName: "schedule" },
    { value: "CONFIRMED", label: "확인됨", color: "bg-[var(--doc-grid-head)] text-[var(--doc-ink-2)]", iconName: "check_circle" },
    { value: "COMPLETED", label: "처리완료", color: "bg-[var(--doc-accent-soft)] text-[var(--doc-accent)]", iconName: "check_circle" },
    { value: "REJECTED", label: "반려", color: "bg-[var(--doc-crit-soft)] text-[var(--doc-crit)]", iconName: "cancel" },
];

function SymbolIcon({
    name,
    size = 18,
    className = "",
}: {
    name: string;
    size?: number;
    className?: string;
}) {
    return (
        <span
            className={`material-symbols-outlined leading-none ${className}`}
            style={{ fontSize: `${size}px` }}
            aria-hidden="true"
        >
            {name}
        </span>
    );
}

type RequestData = {
    id: string;
    userId: string;
    studentId: string;
    type: string;
    title: string;
    content: string;
    date: Date | string | null;
    status: string;
    adminNote: string | null;
    createdAt: Date | string;
    updatedAt: Date | string;
    studentName: string;
    parentName: string;
    parentPhone: string | null;
};

type RequestsPayload = {
    requests: RequestData[];
    counts?: RequestCounts;
    pagination?: RequestPagination;
    statusFilter?: string;
};

type RequestCounts = {
    ALL: number;
    PENDING: number;
    CONFIRMED: number;
    COMPLETED: number;
    REJECTED: number;
};

type RequestPagination = {
    limit: number;
    offset: number;
    returned: number;
    total: number;
    hasMore: boolean;
    nextOffset: number | null;
    partial?: boolean;
};

const DEFAULT_REQUEST_COUNTS: RequestCounts = {
    ALL: 0,
    PENDING: 0,
    CONFIRMED: 0,
    COMPLETED: 0,
    REJECTED: 0,
};

function RequestsLoadingFallback() {
    return (
        <div className="mx-auto max-w-4xl space-y-6">
            <div>
                <div className="h-8 w-56 rounded bg-[var(--doc-grid-head)]" />
                <div className="mt-2 h-4 w-96 max-w-full rounded bg-[var(--doc-grid-head)]" />
            </div>
            <div className="flex flex-wrap gap-2">
                {Array.from({ length: 4 }).map((_, index) => (
                    <div
                        key={index}
                        className="h-10 w-24 rounded-[3px] bg-[var(--doc-grid-head)]"
                    />
                ))}
            </div>
            <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, index) => (
                    <div
                        key={index}
                        className="overflow-hidden rounded-[6px] border border-[var(--doc-rule)] bg-[var(--doc-surface)]"
                    >
                        <div className="flex items-center gap-3 px-5 py-4">
                            <div className="h-9 w-9 flex-shrink-0 rounded-[3px] bg-[var(--doc-grid-head)]" />
                            <div className="min-w-0 flex-1 space-y-2">
                                <div className="flex gap-2">
                                    <div className="h-5 w-20 rounded-[3px] bg-[var(--doc-grid-head)]" />
                                    <div className="h-5 w-48 max-w-full rounded bg-[var(--doc-grid-head)]" />
                                </div>
                                <div className="h-4 w-64 max-w-full rounded bg-[var(--doc-grid-head)]" />
                            </div>
                            <div className="h-5 w-5 rounded bg-[var(--doc-grid-head)]" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function RequestsErrorState({ onRetry }: { onRetry: () => void }) {
    return (
        <div className="mx-auto max-w-4xl rounded-[6px] border border-[var(--doc-crit)] bg-[var(--doc-crit-soft)] p-6 text-center">
            <p className="text-sm font-bold text-[var(--doc-crit)]">요청 목록을 불러오지 못했습니다.</p>
            <button
                type="button"
                onClick={onRetry}
                className="mt-4 rounded-[3px] bg-[var(--doc-crit)] px-4 py-2 text-sm font-bold text-white hover:bg-[var(--doc-crit)]"
            >
                다시 불러오기
            </button>
        </div>
    );
}

export default function RequestsAdminClient({
    requests: initialRequests,
    counts: initialCounts,
    pagination: initialPagination,
    statusFilter: initialStatusFilter = "ALL",
}: {
    requests?: RequestData[];
    counts?: RequestCounts;
    pagination?: RequestPagination;
    statusFilter?: string;
}) {
    const hasInitialData = initialRequests !== undefined;
    const [requests, setRequests] = useState<RequestData[]>(initialRequests ?? []);
    const [counts, setCounts] = useState<RequestCounts>(initialCounts ?? DEFAULT_REQUEST_COUNTS);
    const [pagination, setPagination] = useState<RequestPagination | undefined>(initialPagination);
    const [loading, setLoading] = useState(!hasInitialData);
    const [loadingMore, setLoadingMore] = useState(false);
    const [loadError, setLoadError] = useState(false);
    const [filter, setFilter] = useState<string>(initialStatusFilter);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});
    const [isPending, startTransition] = useTransition();
    const requestedInitialLoad = useRef(false);

    const loadRequests = useCallback(async ({
        status = filter,
        offset = 0,
        append = false,
    }: {
        status?: string;
        offset?: number;
        append?: boolean;
    } = {}) => {
        if (append) {
            setLoadingMore(true);
        } else {
            setLoading(true);
        }
        setLoadError(false);
        try {
            const params = new URLSearchParams({
                limit: String(pagination?.limit ?? 30),
                offset: String(offset),
            });
            if (status && status !== "ALL") {
                params.set("status", status);
            }
            const response = await fetch(`/api/admin/requests?${params.toString()}`, { cache: "no-store" });
            if (!response.ok) {
                throw new Error("Failed to load requests.");
            }
            const data = (await response.json()) as RequestsPayload;
            setRequests((current) => {
                if (!append) return data.requests;
                const seen = new Set(current.map((request) => request.id));
                return [...current, ...data.requests.filter((request) => !seen.has(request.id))];
            });
            if (data.counts) setCounts(data.counts);
            if (data.pagination) setPagination(data.pagination);
        } catch (error) {
            console.error("Failed to load requests:", error);
            setLoadError(true);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, [filter, pagination?.limit]);

    useEffect(() => {
        if (hasInitialData || requestedInitialLoad.current) return;
        requestedInitialLoad.current = true;
        void loadRequests();
    }, [hasInitialData, loadRequests]);

    if (loading && requests.length === 0) {
        return <RequestsLoadingFallback />;
    }

    if (loadError && requests.length === 0) {
        return <RequestsErrorState onRetry={loadRequests} />;
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div>
                {/* 설명문구 제거: 제목 + 아래 유형 배지로 이미 자명 */}
                <h1 className="text-2xl font-bold text-[var(--doc-ink)]">학부모 요청 관리</h1>
            </div>

            {/* 필터 탭 */}
            <div className="flex gap-2 flex-wrap">
                {[
                    { value: "ALL", label: "전체" },
                    { value: "PENDING", label: "대기중" },
                    { value: "CONFIRMED", label: "확인됨" },
                    { value: "COMPLETED", label: "처리완료" },
                ].map(f => (
                    <button key={f.value}
                        onClick={() => {
                            setFilter(f.value);
                            void loadRequests({ status: f.value, offset: 0 });
                        }}
                        className={`px-4 py-2 rounded-[3px] text-sm font-bold transition ${
 filter === f.value
 ? "bg-[var(--doc-accent)] dark:text-[var(--doc-ink)] text-white"
 : "bg-[var(--doc-surface)] border border-[var(--doc-rule)] text-[var(--doc-ink-2)] hover:border-[var(--doc-accent)] "
 }`}
                    >
                        {f.label}
                        <span className="ml-1 opacity-70">({counts[f.value as keyof typeof counts] ?? 0})</span>
                    </button>
                ))}
            </div>

            {/* 요청 목록 */}
            {requests.length === 0 ? (
                <div className="bg-[var(--doc-surface)] rounded-[6px] border border-[var(--doc-rule)] transition-colors duration-300 p-12 text-center text-[var(--doc-ink-3)]">
                    <SymbolIcon name="forum" size={48} className="mx-auto mb-3 text-[var(--doc-ink-3)]" />
                    <p className="font-medium">요청이 없습니다</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {requests.map(req => {
                        const typeInfo = TYPE_LABELS[req.type] || TYPE_LABELS.OTHER;
                        const statusInfo = STATUS_OPTIONS.find(s => s.value === req.status) || STATUS_OPTIONS[0];
                        const isExpanded = expandedId === req.id;

                        return (
                            <div key={req.id} className={`bg-[var(--doc-surface)] rounded-[6px] border overflow-hidden transition ${
 req.status === "PENDING" ? "border-[var(--doc-warn)]" : "border-[var(--doc-rule)] "
 }`}>
                                {/* 요약 헤더 (클릭하면 펼침) */}
                                <button
                                    onClick={() => setExpandedId(isExpanded ? null : req.id)}
                                    className="w-full px-5 py-4 flex items-center gap-3 text-left hover:bg-[var(--doc-grid-head)] transition"
                                >
                                    {/* 상태 아이콘 */}
                                    <div className={`p-2 rounded-[3px] flex-shrink-0 ${statusInfo.color}`}>
                                        <SymbolIcon name={statusInfo.iconName} size={16} />
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className={`text-xs font-bold px-2 py-0.5 rounded-[3px] ${typeInfo.color}`}>
                                                {typeInfo.label}
                                            </span>
                                            <span className="font-bold text-sm text-[var(--doc-ink)] truncate">{req.title}</span>
                                        </div>
                                        <p className="text-xs text-[var(--doc-ink-2)] mt-0.5">
                                            {req.parentName} ({req.studentName}) &middot; {new Date(req.createdAt).toLocaleDateString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                                        </p>
                                    </div>

                                    <SymbolIcon
                                        name={isExpanded ? "expand_less" : "expand_more"}
                                        size={18}
                                        className="text-[var(--doc-ink-3)]"
                                    />
                                </button>

                                {/* 상세 (펼침) */}
                                {isExpanded && (
                                    <div className="px-5 pb-5 border-t border-[var(--doc-rule)] space-y-4">
                                        {/* 요청 내용 */}
                                        <div className="pt-3">
                                            <p className="text-sm text-[var(--doc-ink)] whitespace-pre-wrap">{req.content}</p>
                                            {req.date && (
                                                <p className="text-xs text-[var(--doc-ink-2)] mt-2">
                                                    해당 날짜: <span className="font-bold">{new Date(req.date).toLocaleDateString("ko-KR")}</span>
                                                </p>
                                            )}
                                            {req.parentPhone && (
                                                <p className="text-xs text-[var(--doc-ink-2)] mt-1">
                                                    연락처: <a href={`tel:${req.parentPhone}`} className="text-[var(--doc-accent)] font-bold">{req.parentPhone}</a>
                                                </p>
                                            )}
                                        </div>

                                        {/* 관리자 메모 */}
                                        <div>
                                            <label className="text-xs font-medium text-[var(--doc-ink-2)] mb-1 block">관리자 메모/답변</label>
                                            <textarea
                                                value={adminNotes[req.id] ?? req.adminNote ?? ""}
                                                onChange={e => setAdminNotes(prev => ({ ...prev, [req.id]: e.target.value }))}
                                                placeholder="학부모에게 전달할 답변을 작성하세요"
                                                rows={2}
                                                className="w-full border border-[var(--doc-rule)] rounded-[3px] px-3 py-2 text-sm resize-none"
                                            />
                                        </div>

                                        {/* 상태 변경 버튼 */}
                                        <div className="flex gap-2 flex-wrap">
                                            {STATUS_OPTIONS.filter(s => s.value !== req.status).map(s => {
                                                return (
                                                    <button key={s.value}
                                                        disabled={isPending}
                                                        onClick={() => startTransition(async () => {
                                                            await updateRequestStatus(req.id, s.value, adminNotes[req.id] ?? req.adminNote ?? undefined);
                                                            await loadRequests({ status: filter, offset: 0 });
                                                        })}
                                                        className={`flex items-center gap-1.5 px-3 py-2 rounded-[3px] text-xs font-bold border transition hover: ${s.color}`}
                                                    >
                                                        <SymbolIcon name={s.iconName} size={14} /> {s.label}
                                                    </button>
                                                );
                                            })}
                                            <button
                                                disabled={isPending}
                                                onClick={() => {
                                                    if (confirm("이 요청을 삭제하시겠습니까?")) {
                                                        startTransition(async () => {
                                                            await deleteParentRequest(req.id);
                                                            setExpandedId(null);
                                                            await loadRequests({ status: filter, offset: 0 });
                                                        });
                                                    }
                                                }}
                                                className="ml-auto text-xs text-[var(--doc-crit)] hover:text-[var(--doc-crit)] transition"
                                            >
                                                삭제
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                    {pagination?.hasMore && (
                        <div className="pt-2 text-center">
                            <button
                                type="button"
                                disabled={loadingMore}
                                onClick={() => void loadRequests({
                                    status: filter,
                                    offset: pagination.nextOffset ?? requests.length,
                                    append: true,
                                })}
                                className="rounded-[3px] border border-[var(--doc-rule)] bg-[var(--doc-surface)] px-5 py-2 text-sm font-bold text-[var(--doc-ink-2)] transition hover:border-[var(--doc-accent)] disabled:opacity-60"
                            >
                                {loadingMore ? "불러오는 중..." : `더 보기 (${requests.length}/${pagination.total})`}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
