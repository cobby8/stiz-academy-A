"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateAcademySettings } from "@/app/actions/admin";

interface ApplyAdminClientProps {
    initialSettings: {
        trialTitle: string;
        trialContent: string | null;
        trialFormUrl: string | null;
        enrollTitle: string;
        enrollContent: string | null;
        enrollFormUrl: string | null;
    };
}

const INPUT = "w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-brand-orange-500 focus:border-brand-orange-500 transition";
const TEXTAREA = INPUT + " resize-none";

function SectionCard({
    badge,
    badgeColor,
    title,
    children,
}: {
    badge: string;
    badgeColor: string;
    title: string;
    children: React.ReactNode;
}) {
    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className={`px-6 py-4 border-b border-gray-100 flex items-center gap-3`}>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${badgeColor}`}>{badge}</span>
                <h2 className="text-base font-bold text-gray-800">{title}</h2>
            </div>
            <div className="p-6 space-y-4">{children}</div>
        </div>
    );
}

export default function ApplyAdminClient({ initialSettings }: ApplyAdminClientProps) {
    const router = useRouter();

    const [trialTitle, setTrialTitle] = useState(initialSettings.trialTitle);
    const [trialContent, setTrialContent] = useState(initialSettings.trialContent || "");
    const [trialFormUrl, setTrialFormUrl] = useState(initialSettings.trialFormUrl || "");

    const [enrollTitle, setEnrollTitle] = useState(initialSettings.enrollTitle);
    const [enrollContent, setEnrollContent] = useState(initialSettings.enrollContent || "");
    const [enrollFormUrl, setEnrollFormUrl] = useState(initialSettings.enrollFormUrl || "");

    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleSave() {
        setSaving(true);
        setSaved(false);
        setError(null);
        try {
            await updateAcademySettings({
                trialTitle: trialTitle.trim() || "체험수업 안내",
                trialContent: trialContent.trim() || undefined,
                trialFormUrl: trialFormUrl.trim() || undefined,
                enrollTitle: enrollTitle.trim() || "수강신청 안내",
                enrollContent: enrollContent.trim() || undefined,
                enrollFormUrl: enrollFormUrl.trim() || undefined,
            });
            setSaved(true);
            router.refresh();
            setTimeout(() => setSaved(false), 3000);
        } catch (e: any) {
            setError(e.message ?? "저장 실패");
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="space-y-8">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-1">체험/수강신청 관리</h1>
                    <p className="text-gray-500 text-sm">체험수업·수강신청 안내 내용 및 구글폼 URL을 설정합니다.</p>
                </div>
                <a
                    href="/apply"
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 text-sm text-brand-navy-900 border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 transition"
                >
                    신청 페이지 미리보기 ↗
                </a>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-4">
                    {error}
                </div>
            )}

            {/* 체험수업 */}
            <SectionCard badge="체험수업" badgeColor="bg-orange-100 text-brand-orange-600 border border-orange-200" title="체험수업 안내 설정">
                <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">섹션 제목</label>
                    <input
                        type="text"
                        value={trialTitle}
                        onChange={(e) => setTrialTitle(e.target.value)}
                        className={INPUT}
                        placeholder="체험수업 안내"
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                        안내 내용
                        <span className="text-gray-400 font-normal ml-1">(체험수업 절차, 혜택, 대상 등 자유롭게 작성)</span>
                    </label>
                    <textarea
                        value={trialContent}
                        onChange={(e) => setTrialContent(e.target.value)}
                        rows={6}
                        className={TEXTAREA}
                        placeholder={"예:\n- 체험수업 1회 1만원\n- 초등학생~중학생 누구나 신청 가능\n- 체험 후 수강 결정하셔도 됩니다"}
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                        구글폼 URL
                        <span className="text-gray-400 font-normal ml-1">(체험수업 신청용 구글폼 주소를 입력하면 버튼 활성화)</span>
                    </label>
                    <input
                        type="url"
                        value={trialFormUrl}
                        onChange={(e) => setTrialFormUrl(e.target.value)}
                        className={INPUT}
                        placeholder="https://docs.google.com/forms/d/e/..."
                    />
                    {trialFormUrl && (
                        <p className="text-xs text-green-600 mt-1.5">✓ 구글폼 URL 등록됨 — 신청 버튼이 활성화됩니다.</p>
                    )}
                    {!trialFormUrl && (
                        <p className="text-xs text-gray-400 mt-1.5">URL 미입력 시 신청 버튼이 "준비 중" 상태로 표시됩니다.</p>
                    )}
                </div>
            </SectionCard>

            {/* 수강신청 */}
            <SectionCard badge="수강신청" badgeColor="bg-blue-50 text-blue-700 border border-blue-200" title="수강신청 안내 설정">
                <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">섹션 제목</label>
                    <input
                        type="text"
                        value={enrollTitle}
                        onChange={(e) => setEnrollTitle(e.target.value)}
                        className={INPUT}
                        placeholder="수강신청 안내"
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                        안내 내용
                        <span className="text-gray-400 font-normal ml-1">(수강신청 방법, 준비물, 수강료 납부 방법 등)</span>
                    </label>
                    <textarea
                        value={enrollContent}
                        onChange={(e) => setEnrollContent(e.target.value)}
                        rows={6}
                        className={TEXTAREA}
                        placeholder={"예:\n- 신청서 작성 후 원장님 확인\n- 수강료는 매월 1일 납부\n- 문의: 010-0000-0000"}
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                        구글폼 URL
                        <span className="text-gray-400 font-normal ml-1">(수강신청용 구글폼 주소를 입력하면 버튼 활성화)</span>
                    </label>
                    <input
                        type="url"
                        value={enrollFormUrl}
                        onChange={(e) => setEnrollFormUrl(e.target.value)}
                        className={INPUT}
                        placeholder="https://docs.google.com/forms/d/e/..."
                    />
                    {enrollFormUrl && (
                        <p className="text-xs text-green-600 mt-1.5">✓ 구글폼 URL 등록됨 — 신청 버튼이 활성화됩니다.</p>
                    )}
                    {!enrollFormUrl && (
                        <p className="text-xs text-gray-400 mt-1.5">URL 미입력 시 신청 버튼이 "준비 중" 상태로 표시됩니다.</p>
                    )}
                </div>
            </SectionCard>

            {/* 구글폼 연동 안내 */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
                <h3 className="text-sm font-bold text-blue-800 mb-2">📋 구글폼 연동 방법</h3>
                <ol className="text-sm text-blue-700 space-y-1.5 list-decimal list-inside">
                    <li>Google Forms에서 신청서를 만들고 응답을 구글 스프레드시트에 연결합니다.</li>
                    <li>폼 공유 링크 (<code className="bg-blue-100 px-1 rounded text-xs">https://docs.google.com/forms/d/e/.../viewform</code>)를 위 URL 입력란에 붙여넣습니다.</li>
                    <li>저장 후 신청 페이지에서 버튼을 클릭하면 폼이 팝업으로 열립니다.</li>
                    <li>방문자가 폼을 제출하면 연결된 구글 스프레드시트에 자동으로 기록됩니다.</li>
                </ol>
            </div>

            <div className="flex justify-end gap-3">
                {saved && (
                    <span className="text-sm text-green-600 font-medium self-center">✓ 저장되었습니다</span>
                )}
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-brand-orange-500 hover:bg-orange-600 text-white font-bold px-8 py-3 rounded-xl transition disabled:opacity-40 shadow-sm"
                >
                    {saving ? "저장 중..." : "저장하기"}
                </button>
            </div>
        </div>
    );
}
