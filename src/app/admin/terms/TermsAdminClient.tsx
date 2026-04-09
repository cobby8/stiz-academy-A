"use client";

import { useState, useTransition } from "react";
import { updateAcademySettings } from "@/app/actions/admin";

// 이용약관 관리 독립 클라이언트 컴포넌트
// 기존 ProgramsAdminClient에서 분리하여 단독 페이지로 운영
export default function TermsAdminClient({
    termsOfService: initialTerms,
}: {
    termsOfService: string | null;
}) {
    const [terms, setTerms] = useState(initialTerms ?? "");
    const [saved, setSaved] = useState(false);
    const [pending, startTransition] = useTransition();

    // 이용약관 저장 핸들러
    function saveTerms() {
        startTransition(async () => {
            try {
                await updateAcademySettings({ termsOfService: terms });
                setSaved(true);
                setTimeout(() => setSaved(false), 2000);
            } catch (e: any) {
                alert(e.message || "저장 실패");
            }
        });
    }

    return (
        <div className="space-y-8">
            {/* 페이지 헤더 */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">이용약관 관리</h1>
                <p className="text-gray-500 dark:text-gray-400">프로그램 안내 페이지 하단 및 이용약관 독립 페이지(/terms)에 표시됩니다.</p>
            </div>

            {/* 이용약관 에디터 */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">이용약관 내용</h2>
                    <div className="flex items-center gap-3">
                        {saved && <span className="text-xs text-green-600 font-medium">저장됨</span>}
                        <button
                            onClick={saveTerms}
                            disabled={pending}
                            className="bg-brand-navy-900 text-white text-sm font-bold px-4 py-2 rounded-lg hover:bg-gray-800 transition disabled:opacity-40"
                        >
                            {pending ? "저장 중..." : "저장"}
                        </button>
                    </div>
                </div>
                <textarea
                    value={terms}
                    onChange={(e) => { setTerms(e.target.value); setSaved(false); }}
                    rows={16}
                    placeholder={`예시:\n제1조 (목적)\n본 약관은 STIZ 농구교실 다산점(이하 '학원')이 제공하는 교육 서비스 이용에 관한 기본적인 사항을 규정합니다.\n\n제2조 (수강료 및 환불)\n• 수강료는 매월 초에 납부합니다.\n• 개인 사정으로 인한 환불은 규정에 따릅니다.`}
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-orange-500 dark:focus:ring-brand-neon-lime focus:border-brand-orange-500 dark:border-brand-neon-lime bg-gray-50 focus:bg-white dark:focus:bg-gray-700 dark:bg-gray-800 resize-y font-mono leading-relaxed"
                />
                <p className="text-xs text-gray-400 mt-2">엔터키로 줄바꿈이 프론트에 그대로 적용됩니다.</p>
            </div>
        </div>
    );
}
