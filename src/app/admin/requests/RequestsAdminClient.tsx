"use client";

import { useState, useTransition } from "react";
import { Clock, CheckCircle2, XCircle, MessageSquare, Filter, ChevronDown, ChevronUp } from "lucide-react";
import { updateRequestStatus, deleteParentRequest } from "@/app/actions/admin";

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
    ABSENCE: { label: "결석 신청", color: "bg-red-100 text-red-700" },
    SHUTTLE: { label: "셔틀 변경", color: "bg-blue-100 text-blue-700" },
    EARLY_LEAVE: { label: "조퇴 요청", color: "bg-yellow-100 text-yellow-700" },
    OTHER: { label: "기타", color: "bg-gray-100 text-gray-700" },
};

const STATUS_OPTIONS = [
    { value: "PENDING", label: "대기중", color: "bg-yellow-100 text-yellow-700", icon: Clock },
    { value: "CONFIRMED", label: "확인됨", color: "bg-blue-100 text-blue-700", icon: CheckCircle2 },
    { value: "COMPLETED", label: "처리완료", color: "bg-green-100 text-green-700", icon: CheckCircle2 },
    { value: "REJECTED", label: "반려", color: "bg-red-100 text-red-700", icon: XCircle },
];

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

export default function RequestsAdminClient({ requests }: { requests: RequestData[] }) {
    const [filter, setFilter] = useState<string>("ALL");
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});
    const [isPending, startTransition] = useTransition();

    // 필터 적용
    const filtered = filter === "ALL" ? requests : requests.filter(r => r.status === filter);

    // 상태별 카운트
    const counts = {
        ALL: requests.length,
        PENDING: requests.filter(r => r.status === "PENDING").length,
        CONFIRMED: requests.filter(r => r.status === "CONFIRMED").length,
        COMPLETED: requests.filter(r => r.status === "COMPLETED").length,
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div>
                <h1 className="text-2xl font-extrabold text-gray-900 mb-1">학부모 요청 관리</h1>
                <p className="text-gray-500 text-sm">학부모가 접수한 결석, 셔틀 변경 등의 요청을 관리합니다.</p>
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
                        onClick={() => setFilter(f.value)}
                        className={`px-4 py-2 rounded-xl text-sm font-bold transition ${
                            filter === f.value
                                ? "bg-brand-orange-500 text-white"
                                : "bg-white border border-gray-200 text-gray-600 hover:border-brand-orange-300"
                        }`}
                    >
                        {f.label}
                        <span className="ml-1 opacity-70">({counts[f.value as keyof typeof counts] ?? 0})</span>
                    </button>
                ))}
            </div>

            {/* 요청 목록 */}
            {filtered.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-gray-400 shadow-sm">
                    <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p className="font-medium">요청이 없습니다</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filtered.map(req => {
                        const typeInfo = TYPE_LABELS[req.type] || TYPE_LABELS.OTHER;
                        const statusInfo = STATUS_OPTIONS.find(s => s.value === req.status) || STATUS_OPTIONS[0];
                        const StatusIcon = statusInfo.icon;
                        const isExpanded = expandedId === req.id;

                        return (
                            <div key={req.id} className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition ${
                                req.status === "PENDING" ? "border-yellow-200" : "border-gray-100"
                            }`}>
                                {/* 요약 헤더 (클릭하면 펼침) */}
                                <button
                                    onClick={() => setExpandedId(isExpanded ? null : req.id)}
                                    className="w-full px-5 py-4 flex items-center gap-3 text-left hover:bg-gray-50 transition"
                                >
                                    {/* 상태 아이콘 */}
                                    <div className={`p-2 rounded-full flex-shrink-0 ${statusInfo.color}`}>
                                        <StatusIcon size={16} />
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${typeInfo.color}`}>
                                                {typeInfo.label}
                                            </span>
                                            <span className="font-bold text-sm text-gray-900 truncate">{req.title}</span>
                                        </div>
                                        <p className="text-xs text-gray-500 mt-0.5">
                                            {req.parentName} ({req.studentName}) &middot; {new Date(req.createdAt).toLocaleDateString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                                        </p>
                                    </div>

                                    {isExpanded ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
                                </button>

                                {/* 상세 (펼침) */}
                                {isExpanded && (
                                    <div className="px-5 pb-5 border-t border-gray-50 space-y-4">
                                        {/* 요청 내용 */}
                                        <div className="pt-3">
                                            <p className="text-sm text-gray-800 whitespace-pre-wrap">{req.content}</p>
                                            {req.date && (
                                                <p className="text-xs text-gray-500 mt-2">
                                                    해당 날짜: <span className="font-bold">{new Date(req.date).toLocaleDateString("ko-KR")}</span>
                                                </p>
                                            )}
                                            {req.parentPhone && (
                                                <p className="text-xs text-gray-500 mt-1">
                                                    연락처: <a href={`tel:${req.parentPhone}`} className="text-brand-orange-500 font-bold">{req.parentPhone}</a>
                                                </p>
                                            )}
                                        </div>

                                        {/* 관리자 메모 */}
                                        <div>
                                            <label className="text-xs font-medium text-gray-500 mb-1 block">관리자 메모/답변</label>
                                            <textarea
                                                value={adminNotes[req.id] ?? req.adminNote ?? ""}
                                                onChange={e => setAdminNotes(prev => ({ ...prev, [req.id]: e.target.value }))}
                                                placeholder="학부모에게 전달할 답변을 작성하세요"
                                                rows={2}
                                                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none"
                                            />
                                        </div>

                                        {/* 상태 변경 버튼 */}
                                        <div className="flex gap-2 flex-wrap">
                                            {STATUS_OPTIONS.filter(s => s.value !== req.status).map(s => {
                                                const Icon = s.icon;
                                                return (
                                                    <button key={s.value}
                                                        disabled={isPending}
                                                        onClick={() => startTransition(() =>
                                                            updateRequestStatus(req.id, s.value, adminNotes[req.id] ?? req.adminNote ?? undefined)
                                                        )}
                                                        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition hover:shadow-sm ${s.color}`}
                                                    >
                                                        <Icon size={14} /> {s.label}
                                                    </button>
                                                );
                                            })}
                                            <button
                                                disabled={isPending}
                                                onClick={() => {
                                                    if (confirm("이 요청을 삭제하시겠습니까?")) {
                                                        startTransition(() => deleteParentRequest(req.id));
                                                    }
                                                }}
                                                className="ml-auto text-xs text-red-400 hover:text-red-600 transition"
                                            >
                                                삭제
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
