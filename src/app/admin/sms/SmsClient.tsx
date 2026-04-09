"use client";

import { useState, useEffect, useTransition } from "react";
import { getCoachPhones, sendManualSms } from "@/app/actions/admin";

// 코치 전화번호 정보 타입
interface CoachPhone {
    id: string;
    name: string;
    role: string;
    phone: string;
}

// 수신자 모드: 전체 코치 / 선택 코치 / 직접 입력
type RecipientMode = "all" | "select" | "manual";

export default function SmsClient() {
    const [pending, startTransition] = useTransition();
    // 코치 전화번호 목록 (서버에서 가져옴)
    const [coaches, setCoaches] = useState<CoachPhone[]>([]);
    const [loadingCoaches, setLoadingCoaches] = useState(true);

    // 수신자 모드
    const [mode, setMode] = useState<RecipientMode>("all");
    // 선택 모드에서 체크된 코치 ID 목록
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    // 직접 입력 모드에서 입력한 번호 (콤마/줄바꿈 구분)
    const [manualNumbers, setManualNumbers] = useState("");

    // 메시지 본문
    const [message, setMessage] = useState("");
    // 발송 결과
    const [result, setResult] = useState<{ total: number; success: number; failed: number } | null>(null);
    // 에러 메시지
    const [error, setError] = useState<string | null>(null);

    // 페이지 로드 시 코치 전화번호 목록 조회
    useEffect(() => {
        getCoachPhones()
            .then(setCoaches)
            .catch(() => {})
            .finally(() => setLoadingCoaches(false));
    }, []);

    // 체크박스 토글
    function toggleCoach(id: string) {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }

    // 전체 선택/해제
    function toggleAll() {
        if (selectedIds.size === coaches.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(coaches.map(c => c.id)));
        }
    }

    // 실제 발송할 전화번호 목록 계산
    function getRecipients(): string[] {
        if (mode === "all") {
            return coaches.map(c => c.phone);
        }
        if (mode === "select") {
            return coaches.filter(c => selectedIds.has(c.id)).map(c => c.phone);
        }
        // 직접 입력: 콤마, 줄바꿈, 세미콜론으로 분리 후 정리
        return manualNumbers
            .split(/[,;\n]+/)
            .map(n => n.trim().replace(/-/g, ""))
            .filter(n => n.length >= 10);
    }

    // 발송 버튼 클릭
    function handleSend() {
        const recipients = getRecipients();
        if (recipients.length === 0) {
            setError("수신자를 선택하거나 입력해주세요.");
            return;
        }
        if (!message.trim()) {
            setError("메시지를 입력해주세요.");
            return;
        }

        setError(null);
        setResult(null);

        // 확인 팝업
        if (!confirm(`${recipients.length}명에게 문자를 발송하시겠습니까?`)) return;

        startTransition(async () => {
            try {
                const res = await sendManualSms(recipients, message.trim());
                setResult(res);
                // 성공 시 메시지 초기화
                if (res.success > 0) setMessage("");
            } catch (e: any) {
                setError(e.message ?? "발송 실패");
            }
        });
    }

    const recipients = getRecipients();
    // 바이트 수 계산 (한글 2바이트, 영어/숫자 1바이트 기준 — "[STIZ] " 접두사 포함)
    const fullMsg = `[STIZ] ${message}`;
    const byteLength = new TextEncoder().encode(fullMsg).length;
    const isLms = byteLength > 90;

    const INPUT = "w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2.5 text-sm dark:text-white bg-gray-50 focus:bg-white dark:bg-gray-800 focus:ring-2 focus:ring-brand-orange-500 dark:focus:ring-brand-neon-lime focus:border-brand-orange-500 dark:border-brand-neon-lime transition";

    return (
        <div className="space-y-6 max-w-3xl">
            {/* 페이지 타이틀 */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">문자 발송</h1>
                <p className="text-gray-500 dark:text-gray-400 text-sm">코치진 또는 특정 번호로 SMS를 발송합니다.</p>
            </div>

            {/* 수신자 선택 */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 space-y-4">
                <h2 className="font-bold text-gray-800 dark:text-gray-100 text-base flex items-center gap-2">
                    <span className="material-symbols-outlined text-[20px]">group</span>
                    수신자 선택
                </h2>

                {/* 모드 선택 탭 */}
                <div className="flex gap-2">
                    {[
                        { key: "all" as const, label: "전체 코치", icon: "groups" },
                        { key: "select" as const, label: "코치 선택", icon: "person_search" },
                        { key: "manual" as const, label: "직접 입력", icon: "dialpad" },
                    ].map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setMode(tab.key)}
                            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                mode === tab.key
                                    ? "bg-brand-navy-900 text-white"
                                    : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200"
                            }`}
                        >
                            <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* 전체 코치 모드 */}
                {mode === "all" && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
                        <span className="material-symbols-outlined text-[16px] align-middle mr-1">info</span>
                        전화번호가 등록된 코치 <strong>{coaches.length}명</strong> 전원에게 발송합니다.
                        {coaches.length === 0 && !loadingCoaches && (
                            <span className="block mt-1 text-red-600">
                                전화번호가 등록된 코치가 없습니다. 코치 관리에서 전화번호를 먼저 등록해주세요.
                            </span>
                        )}
                    </div>
                )}

                {/* 코치 선택 모드 */}
                {mode === "select" && (
                    <div className="space-y-2">
                        {loadingCoaches ? (
                            <p className="text-gray-400 text-sm py-4 text-center">불러오는 중...</p>
                        ) : coaches.length === 0 ? (
                            <p className="text-gray-400 text-sm py-4 text-center">전화번호가 등록된 코치가 없습니다.</p>
                        ) : (
                            <>
                                {/* 전체 선택/해제 */}
                                <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 cursor-pointer pb-1 border-b border-gray-100 dark:border-gray-800">
                                    <input
                                        type="checkbox"
                                        checked={selectedIds.size === coaches.length}
                                        onChange={toggleAll}
                                        className="w-4 h-4 rounded border-gray-300 text-brand-orange-500 dark:text-brand-neon-lime focus:ring-brand-orange-500 dark:focus:ring-brand-neon-lime"
                                    />
                                    전체 선택 ({selectedIds.size}/{coaches.length})
                                </label>
                                {coaches.map(c => (
                                    <label
                                        key={c.id}
                                        className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 dark:bg-gray-900 cursor-pointer transition-colors"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.has(c.id)}
                                            onChange={() => toggleCoach(c.id)}
                                            className="w-4 h-4 rounded border-gray-300 text-brand-orange-500 dark:text-brand-neon-lime focus:ring-brand-orange-500 dark:focus:ring-brand-neon-lime"
                                        />
                                        <span className="font-medium text-gray-800 dark:text-gray-100 text-sm">{c.name}</span>
                                        <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded-full">{c.role}</span>
                                        <span className="text-xs text-gray-400 ml-auto">{c.phone}</span>
                                    </label>
                                ))}
                            </>
                        )}
                    </div>
                )}

                {/* 직접 입력 모드 */}
                {mode === "manual" && (
                    <div>
                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-200 mb-1">
                            수신 번호
                            <span className="text-gray-400 font-normal ml-1">(줄바꿈 또는 콤마로 구분)</span>
                        </label>
                        <textarea
                            value={manualNumbers}
                            onChange={e => setManualNumbers(e.target.value)}
                            placeholder={"010-1234-5678\n010-9876-5432\n또는 01012345678, 01098765432"}
                            rows={4}
                            className={INPUT + " resize-none"}
                        />
                        {recipients.length > 0 && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                인식된 번호: <strong>{recipients.length}개</strong>
                            </p>
                        )}
                    </div>
                )}
            </div>

            {/* 메시지 입력 */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 space-y-4">
                <h2 className="font-bold text-gray-800 dark:text-gray-100 text-base flex items-center gap-2">
                    <span className="material-symbols-outlined text-[20px]">sms</span>
                    메시지 작성
                </h2>

                <div>
                    <textarea
                        value={message}
                        onChange={e => setMessage(e.target.value)}
                        placeholder="보낼 메시지를 입력하세요..."
                        rows={5}
                        maxLength={1000}
                        className={INPUT + " resize-none"}
                    />
                    {/* 바이트 수 + SMS/LMS 표시 */}
                    <div className="flex justify-between mt-1.5">
                        <p className="text-xs text-gray-400">
                            발송 시 &quot;[STIZ] &quot; 접두사가 자동 추가됩니다
                        </p>
                        <p className={`text-xs font-medium ${isLms ? "text-orange-500" : "text-gray-500 dark:text-gray-400"}`}>
                            {byteLength}바이트 / {isLms ? "LMS" : "SMS"}
                        </p>
                    </div>
                </div>

                {/* 발송 결과 */}
                {result && (
                    <div className={`rounded-lg p-3 text-sm border ${
                        result.failed === 0
                            ? "bg-green-50 border-green-200 text-green-700"
                            : "bg-yellow-50 border-yellow-200 text-yellow-700"
                    }`}>
                        <span className="material-symbols-outlined text-[16px] align-middle mr-1">
                            {result.failed === 0 ? "check_circle" : "warning"}
                        </span>
                        발송 완료: 전체 {result.total}건 중 성공 {result.success}건
                        {result.failed > 0 && `, 실패 ${result.failed}건`}
                    </div>
                )}

                {/* 에러 표시 */}
                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">
                        {error}
                    </div>
                )}

                {/* 발송 버튼 */}
                <div className="flex justify-end">
                    <button
                        onClick={handleSend}
                        disabled={pending || recipients.length === 0 || !message.trim()}
                        className="bg-brand-navy-900 text-white px-6 py-2.5 rounded-lg font-bold hover:bg-gray-800 transition disabled:opacity-40 flex items-center gap-2"
                    >
                        <span className="material-symbols-outlined text-[18px]">send</span>
                        {pending ? "발송 중..." : `${recipients.length}명에게 발송`}
                    </button>
                </div>
            </div>
        </div>
    );
}
