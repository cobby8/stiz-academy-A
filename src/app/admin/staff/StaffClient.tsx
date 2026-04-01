"use client";

/**
 * 스태프 관리 클라이언트 컴포넌트
 * - ADMIN/VICE_ADMIN/INSTRUCTOR 유저 목록 표시
 * - 역할 변경 드롭다운 (ADMIN만 가능 — requireOwner)
 * - 신규 스태프 추가 모달 (전화번호 인증 필수)
 * - INSTRUCTOR일 때 Coach 연결 드롭다운
 */

import { useState, useTransition } from "react";
import {
    createStaffUser,
    updateUserRole,
    linkCoachToUser,
} from "@/app/actions/admin";

// ── 타입 정의 ─────────────────────────────────────────────────────
interface StaffUser {
    id: string;
    email: string;
    name: string;
    phone: string | null;
    role: string;
    createdAt: string;
    coachId: string | null;
    coachName: string | null;
}

interface CoachItem {
    id: string;
    name: string;
    role: string;
    userId: string | null;
}

// 역할별 한국어 라벨 + 색상
const ROLE_CONFIG: Record<string, { label: string; color: string }> = {
    ADMIN: { label: "원장", color: "bg-red-100 text-red-800" },
    VICE_ADMIN: { label: "부원장", color: "bg-orange-100 text-orange-800" },
    INSTRUCTOR: { label: "코치/강사", color: "bg-blue-100 text-blue-800" },
    PARENT: { label: "학부모", color: "bg-gray-100 text-gray-600" },
};

/**
 * 전화번호 자동 포맷팅 함수
 * 숫자만 추출 후 000-0000-0000 형태로 변환
 * 예: "01012345678" → "010-1234-5678"
 */
function formatPhone(raw: string): string {
    // 숫자만 남김
    const digits = raw.replace(/\D/g, "");
    // 11자리 초과 방지
    const trimmed = digits.slice(0, 11);

    if (trimmed.length <= 3) return trimmed;
    if (trimmed.length <= 7) return `${trimmed.slice(0, 3)}-${trimmed.slice(3)}`;
    return `${trimmed.slice(0, 3)}-${trimmed.slice(3, 7)}-${trimmed.slice(7)}`;
}

export default function StaffClient({
    staffUsers,
    coaches,
}: {
    staffUsers: StaffUser[];
    coaches: CoachItem[];
}) {
    // 신규 스태프 추가 모달 상태
    const [showAddModal, setShowAddModal] = useState(false);
    // 에러/성공 메시지
    const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
    // 서버 액션 pending 상태
    const [isPending, startTransition] = useTransition();

    // ── 역할 변경 핸들러 ─────────────────────────────────────────────
    function handleRoleChange(userId: string, newRole: string) {
        if (!confirm(`역할을 "${ROLE_CONFIG[newRole]?.label || newRole}"(으)로 변경하시겠습니까?`)) return;

        startTransition(async () => {
            try {
                await updateUserRole(userId, newRole as any);
                setMessage({ text: "역할이 변경되었습니다.", ok: true });
            } catch (e: any) {
                setMessage({ text: e.message || "역할 변경 실패", ok: false });
            }
        });
    }

    // ── 코치 연결 핸들러 ─────────────────────────────────────────────
    function handleCoachLink(userId: string, coachId: string) {
        const value = coachId || null; // 빈 문자열이면 null (연결 해제)
        startTransition(async () => {
            try {
                await linkCoachToUser(userId, value);
                setMessage({ text: value ? "코치가 연결되었습니다." : "코치 연결이 해제되었습니다.", ok: true });
            } catch (e: any) {
                setMessage({ text: e.message || "코치 연결 실패", ok: false });
            }
        });
    }

    return (
        <div className="space-y-6">
            {/* 페이지 헤더 */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">스태프 관리</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        관리자, 부원장, 코치/강사 계정을 관리합니다. (원장만 변경 가능)
                    </p>
                </div>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-brand-navy-900 text-white rounded-lg hover:bg-brand-navy-800 transition-colors font-medium text-sm"
                >
                    <span className="material-symbols-outlined text-[20px]">person_add</span>
                    스태프 추가
                </button>
            </div>

            {/* 상태 메시지 */}
            {message && (
                <div className={`px-4 py-3 rounded-lg text-sm font-medium ${message.ok ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                    {message.text}
                </div>
            )}

            {/* 스태프 목록 테이블 */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                            <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">이름</th>
                            <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">전화번호</th>
                            <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">역할</th>
                            <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">코치 연결</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {staffUsers.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="px-6 py-12 text-center text-gray-400 text-sm">
                                    등록된 스태프가 없습니다.
                                </td>
                            </tr>
                        ) : (
                            staffUsers.map((user) => {
                                const rc = ROLE_CONFIG[user.role] || ROLE_CONFIG.PARENT;
                                // INSTRUCTOR일 때만 Coach 드롭다운 표시
                                const isInstructor = user.role === "INSTRUCTOR";

                                return (
                                    <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                                        {/* 이름 + 이니셜 아바타 */}
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm ${user.role === "ADMIN" ? "bg-red-500" : user.role === "VICE_ADMIN" ? "bg-orange-500" : "bg-blue-500"}`}>
                                                    {user.name.charAt(0)}
                                                </div>
                                                <span className="font-medium text-gray-900">{user.name}</span>
                                            </div>
                                        </td>
                                        {/* 전화번호 */}
                                        <td className="px-6 py-4 text-sm text-gray-600">
                                            {user.phone ? formatPhone(user.phone) : "-"}
                                        </td>
                                        {/* 역할 드롭다운 */}
                                        <td className="px-6 py-4">
                                            <select
                                                value={user.role}
                                                onChange={(e) => handleRoleChange(user.id, e.target.value)}
                                                disabled={isPending}
                                                className={`text-xs font-semibold px-3 py-1.5 rounded-full border-0 cursor-pointer ${rc.color} focus:ring-2 focus:ring-brand-navy-500`}
                                            >
                                                <option value="ADMIN">원장</option>
                                                <option value="VICE_ADMIN">부원장</option>
                                                <option value="INSTRUCTOR">코치/강사</option>
                                                <option value="PARENT">학부모</option>
                                            </select>
                                        </td>
                                        {/* Coach 연결 드롭다운 — INSTRUCTOR일 때만 */}
                                        <td className="px-6 py-4">
                                            {isInstructor ? (
                                                <select
                                                    value={user.coachId || ""}
                                                    onChange={(e) => handleCoachLink(user.id, e.target.value)}
                                                    disabled={isPending}
                                                    className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-brand-navy-500 focus:border-brand-navy-500"
                                                >
                                                    <option value="">-- 미연결 --</option>
                                                    {coaches.map((c) => {
                                                        // 이미 다른 유저에게 연결된 코치는 비활성 표시
                                                        const linkedToOther = c.userId && c.userId !== user.id;
                                                        return (
                                                            <option
                                                                key={c.id}
                                                                value={c.id}
                                                                disabled={!!linkedToOther}
                                                            >
                                                                {c.name} ({c.role}){linkedToOther ? " [연결됨]" : ""}
                                                            </option>
                                                        );
                                                    })}
                                                </select>
                                            ) : (
                                                <span className="text-xs text-gray-400">-</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* 역할별 권한 안내 카드 */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[20px]">info</span>
                    역할별 권한 안내
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 bg-red-50 rounded-lg border border-red-100">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="inline-block w-3 h-3 rounded-full bg-red-500" />
                            <span className="font-semibold text-red-800">원장 (ADMIN)</span>
                        </div>
                        <ul className="text-xs text-red-700 space-y-1">
                            <li>- 모든 관리 기능 사용 가능</li>
                            <li>- 스태프 추가/역할 변경 가능</li>
                            <li>- 시스템 설정 변경 가능</li>
                        </ul>
                    </div>
                    <div className="p-4 bg-orange-50 rounded-lg border border-orange-100">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="inline-block w-3 h-3 rounded-full bg-orange-500" />
                            <span className="font-semibold text-orange-800">부원장 (VICE_ADMIN)</span>
                        </div>
                        <ul className="text-xs text-orange-700 space-y-1">
                            <li>- 원장과 동일한 관리 권한</li>
                            <li>- 스태프 관리 불가 (역할 변경 등)</li>
                            <li>- 관리자 알림 수신</li>
                        </ul>
                    </div>
                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="inline-block w-3 h-3 rounded-full bg-blue-500" />
                            <span className="font-semibold text-blue-800">코치/강사 (INSTRUCTOR)</span>
                        </div>
                        <ul className="text-xs text-blue-700 space-y-1">
                            <li>- 출결/리포트 작성 가능</li>
                            <li>- Coach 프로필과 연결 시 시간표 배정</li>
                            <li>- 담당 반 SMS 수신</li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* 신규 스태프 추가 모달 */}
            {showAddModal && (
                <AddStaffModal
                    onClose={() => setShowAddModal(false)}
                    onSuccess={() => {
                        setShowAddModal(false);
                        setMessage({ text: "스태프가 추가되었습니다.", ok: true });
                    }}
                    onError={(msg) => setMessage({ text: msg, ok: false })}
                />
            )}
        </div>
    );
}

// ── 신규 스태프 추가 모달 (전화번호 인증 포함) ─────────────────────────
function AddStaffModal({
    onClose,
    onSuccess,
    onError,
}: {
    onClose: () => void;
    onSuccess: () => void;
    onError: (msg: string) => void;
}) {
    // 폼 상태 — email 제거, phone 필수
    const [form, setForm] = useState({
        name: "",
        phone: "",
        role: "INSTRUCTOR" as "ADMIN" | "VICE_ADMIN" | "INSTRUCTOR",
    });

    // 인증 단계: "input" → "sent" → "verified"
    const [verifyStep, setVerifyStep] = useState<"input" | "sent" | "verified">("input");
    // 인증번호 입력값
    const [verifyCode, setVerifyCode] = useState("");
    // 인증 관련 메시지
    const [verifyMsg, setVerifyMsg] = useState<{ text: string; ok: boolean } | null>(null);
    // 인증번호 발송/검증 중 로딩
    const [verifyLoading, setVerifyLoading] = useState(false);

    const [isPending, startTransition] = useTransition();

    // ── 전화번호 입력 핸들러 (자동 포맷팅) ──────────────────────────
    function handlePhoneChange(raw: string) {
        const formatted = formatPhone(raw);
        setForm({ ...form, phone: formatted });
        // 전화번호가 바뀌면 인증 초기화
        if (verifyStep !== "input") {
            setVerifyStep("input");
            setVerifyCode("");
            setVerifyMsg(null);
        }
    }

    // ── 인증번호 발송 ─────────────────────────────────────────────
    async function handleSendCode() {
        const digits = form.phone.replace(/-/g, "");
        if (digits.length < 10) {
            setVerifyMsg({ text: "올바른 전화번호를 입력해주세요.", ok: false });
            return;
        }

        setVerifyLoading(true);
        setVerifyMsg(null);

        try {
            const res = await fetch("/api/admin/verify-phone", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ phone: digits }),
            });
            const data = await res.json();

            if (res.ok) {
                setVerifyStep("sent");
                setVerifyMsg({ text: "인증번호가 발송되었습니다. (5분 내 입력)", ok: true });
            } else {
                setVerifyMsg({ text: data.error || "발송 실패", ok: false });
            }
        } catch {
            setVerifyMsg({ text: "인증번호 발송 중 오류가 발생했습니다.", ok: false });
        } finally {
            setVerifyLoading(false);
        }
    }

    // ── 인증번호 검증 ─────────────────────────────────────────────
    async function handleVerifyCode() {
        if (!verifyCode.trim()) return;

        const digits = form.phone.replace(/-/g, "");
        setVerifyLoading(true);
        setVerifyMsg(null);

        try {
            const res = await fetch("/api/admin/verify-phone", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ phone: digits, code: verifyCode.trim() }),
            });
            const data = await res.json();

            if (res.ok && data.verified) {
                setVerifyStep("verified");
                setVerifyMsg({ text: "전화번호가 인증되었습니다.", ok: true });
            } else {
                setVerifyMsg({ text: data.error || "인증 실패", ok: false });
            }
        } catch {
            setVerifyMsg({ text: "인증번호 확인 중 오류가 발생했습니다.", ok: false });
        } finally {
            setVerifyLoading(false);
        }
    }

    // ── 스태프 등록 제출 ─────────────────────────────────────────
    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        // 인증 완료되지 않으면 제출 불가
        if (verifyStep !== "verified") return;
        if (!form.name) return;

        startTransition(async () => {
            try {
                await createStaffUser({
                    name: form.name.trim(),
                    phone: form.phone.trim(),
                    role: form.role,
                });
                onSuccess();
            } catch (e: any) {
                onError(e.message || "스태프 추가 실패");
            }
        });
    }

    // 전화번호 11자리 입력 완료 여부 (포맷 포함 13자: 000-0000-0000)
    const phoneComplete = form.phone.replace(/-/g, "").length >= 10;

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
                {/* 모달 헤더 */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                    <h2 className="text-lg font-bold text-gray-900">신규 스태프 추가</h2>
                    <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                {/* 폼 */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* 이름 */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">이름 *</label>
                        <input
                            type="text"
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            required
                            placeholder="홍길동"
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-navy-500 focus:border-brand-navy-500"
                        />
                    </div>

                    {/* 전화번호 + 인증번호 발송 버튼 */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">전화번호 *</label>
                        <div className="flex gap-2">
                            <input
                                type="tel"
                                value={form.phone}
                                onChange={(e) => handlePhoneChange(e.target.value)}
                                placeholder="010-1234-5678"
                                required
                                disabled={verifyStep === "verified"}
                                className={`flex-1 px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-brand-navy-500 focus:border-brand-navy-500 ${
                                    verifyStep === "verified"
                                        ? "border-green-300 bg-green-50 text-green-800"
                                        : "border-gray-300"
                                }`}
                            />
                            {/* 인증 상태에 따라 버튼 변경 */}
                            {verifyStep === "verified" ? (
                                <span className="flex items-center gap-1 px-3 py-2.5 text-sm font-medium text-green-700 bg-green-100 rounded-lg">
                                    <span className="material-symbols-outlined text-[18px]">check_circle</span>
                                    인증됨
                                </span>
                            ) : (
                                <button
                                    type="button"
                                    onClick={handleSendCode}
                                    disabled={!phoneComplete || verifyLoading}
                                    className="px-4 py-2.5 text-sm font-medium text-white bg-brand-navy-900 rounded-lg hover:bg-brand-navy-800 transition-colors disabled:opacity-50 whitespace-nowrap"
                                >
                                    {verifyLoading && verifyStep === "input"
                                        ? "발송 중..."
                                        : verifyStep === "sent"
                                        ? "재발송"
                                        : "인증번호 발송"}
                                </button>
                            )}
                        </div>
                    </div>

                    {/* 인증번호 입력 (발송 후 표시) */}
                    {verifyStep === "sent" && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">인증번호</label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={verifyCode}
                                    onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                                    placeholder="6자리 숫자"
                                    maxLength={6}
                                    className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-center tracking-[0.3em] font-mono focus:ring-2 focus:ring-brand-navy-500 focus:border-brand-navy-500"
                                />
                                <button
                                    type="button"
                                    onClick={handleVerifyCode}
                                    disabled={verifyCode.length < 6 || verifyLoading}
                                    className="px-4 py-2.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 whitespace-nowrap"
                                >
                                    {verifyLoading ? "확인 중..." : "확인"}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* 인증 상태 메시지 */}
                    {verifyMsg && (
                        <div className={`px-3 py-2 rounded-lg text-xs font-medium ${
                            verifyMsg.ok
                                ? "bg-green-50 text-green-700 border border-green-200"
                                : "bg-red-50 text-red-700 border border-red-200"
                        }`}>
                            {verifyMsg.text}
                        </div>
                    )}

                    {/* 역할 */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">역할 *</label>
                        <select
                            value={form.role}
                            onChange={(e) => setForm({ ...form, role: e.target.value as any })}
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-navy-500 focus:border-brand-navy-500"
                        >
                            <option value="INSTRUCTOR">코치/강사</option>
                            <option value="VICE_ADMIN">부원장</option>
                            <option value="ADMIN">원장</option>
                        </select>
                    </div>

                    {/* 버튼 */}
                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                        >
                            취소
                        </button>
                        <button
                            type="submit"
                            disabled={isPending || verifyStep !== "verified" || !form.name}
                            className="px-4 py-2.5 text-sm font-medium text-white bg-brand-navy-900 rounded-lg hover:bg-brand-navy-800 transition-colors disabled:opacity-50"
                        >
                            {isPending ? "추가 중..." : "추가"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
