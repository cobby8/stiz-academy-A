"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { updateAcademySettings } from "@/app/actions/admin";

type ApplySettings = {
    trialTitle: string;
    trialContent: string | null;
    trialFormUrl: string | null;
    enrollTitle: string;
    enrollContent: string | null;
    enrollFormUrl: string | null;
    uniformFormUrl: string | null;
    useBuiltInTrialForm: boolean;
    useBuiltInEnrollForm: boolean;
};

interface ApplySettingsTabProps {
    initialSettings?: ApplySettings;
}

const DEFAULT_SETTINGS: ApplySettings = {
    trialTitle: "체험수업 안내",
    trialContent: null,
    trialFormUrl: null,
    enrollTitle: "수강신청 안내",
    enrollContent: null,
    enrollFormUrl: null,
    uniformFormUrl: null,
    useBuiltInTrialForm: false,
    useBuiltInEnrollForm: false,
};

const INPUT = "w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2.5 text-sm dark:text-white bg-gray-50 focus:bg-white dark:focus:bg-gray-700 dark:bg-gray-800 focus:ring-2 focus:ring-brand-orange-500 dark:focus:ring-brand-neon-lime focus:border-brand-orange-500 dark:border-brand-neon-lime transition";
const TEXTAREA = INPUT + " resize-none";

export default function ApplySettingsTab({ initialSettings }: ApplySettingsTabProps) {
    const settings = initialSettings ?? DEFAULT_SETTINGS;
    const [trialTitle, setTrialTitle] = useState(settings.trialTitle);
    const [trialContent, setTrialContent] = useState(settings.trialContent || "");
    const [trialFormUrl, setTrialFormUrl] = useState(settings.trialFormUrl || "");
    const [enrollTitle, setEnrollTitle] = useState(settings.enrollTitle);
    const [enrollContent, setEnrollContent] = useState(settings.enrollContent || "");
    const [enrollFormUrl, setEnrollFormUrl] = useState(settings.enrollFormUrl || "");
    const [uniformFormUrl, setUniformFormUrl] = useState(settings.uniformFormUrl || "");
    const [useBuiltInTrialForm, setUseBuiltInTrialForm] = useState(settings.useBuiltInTrialForm);
    const [useBuiltInEnrollForm, setUseBuiltInEnrollForm] = useState(settings.useBuiltInEnrollForm);
    const [loading, setLoading] = useState(!initialSettings);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const applySettings = useCallback((nextSettings: ApplySettings) => {
        setTrialTitle(nextSettings.trialTitle);
        setTrialContent(nextSettings.trialContent || "");
        setTrialFormUrl(nextSettings.trialFormUrl || "");
        setEnrollTitle(nextSettings.enrollTitle);
        setEnrollContent(nextSettings.enrollContent || "");
        setEnrollFormUrl(nextSettings.enrollFormUrl || "");
        setUniformFormUrl(nextSettings.uniformFormUrl || "");
        setUseBuiltInTrialForm(nextSettings.useBuiltInTrialForm);
        setUseBuiltInEnrollForm(nextSettings.useBuiltInEnrollForm);
    }, []);

    const loadSettings = useCallback(async () => {
        setLoading(true);
        setLoadError(null);

        try {
            const response = await fetch("/api/admin/apply/settings", { cache: "no-store" });
            if (!response.ok) {
                throw new Error("Failed to load apply settings.");
            }
            const data = (await response.json()) as { settings: ApplySettings };
            applySettings(data.settings);
        } catch (loadSettingsError) {
            console.error("Failed to load apply settings:", loadSettingsError);
            setLoadError("신청 안내 설정을 불러오지 못했습니다.");
        } finally {
            setLoading(false);
        }
    }, [applySettings]);

    useEffect(() => {
        if (initialSettings) return;
        void loadSettings();
    }, [initialSettings, loadSettings]);

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
                uniformFormUrl: uniformFormUrl.trim() || undefined,
                useBuiltInTrialForm,
                useBuiltInEnrollForm,
            });
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch (saveError: any) {
            setError(saveError.message ?? "저장 실패");
        } finally {
            setSaving(false);
        }
    }

    if (loading) {
        return (
            <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
                신청 안내 설정을 불러오는 중...
            </div>
        );
    }

    if (loadError) {
        return (
            <div className="rounded-xl border border-red-100 bg-white p-6 text-center dark:border-red-900/40 dark:bg-gray-800">
                <p className="text-sm font-semibold text-red-700 dark:text-red-200">{loadError}</p>
                <button
                    type="button"
                    onClick={loadSettings}
                    className="mt-3 rounded-lg bg-brand-orange-500 px-4 py-2 text-sm font-bold text-white hover:bg-brand-orange-600 dark:bg-brand-neon-lime dark:text-brand-navy-900"
                >
                    다시 시도
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-4">
                    {error}
                </div>
            )}

            <SettingsCard badge="체험수업" badgeColor="bg-orange-100 text-brand-orange-600 dark:text-brand-neon-lime border border-orange-200" title="체험수업 안내 설정">
                <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-200 mb-1">섹션 제목</label>
                    <input
                        type="text"
                        value={trialTitle}
                        onChange={(event) => setTrialTitle(event.target.value)}
                        className={INPUT}
                        placeholder="체험수업 안내"
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-200 mb-1">
                        안내 내용 <span className="text-gray-400 font-normal ml-1">(체험수업 절차, 혜택, 대상 등)</span>
                    </label>
                    <textarea
                        value={trialContent}
                        onChange={(event) => setTrialContent(event.target.value)}
                        rows={6}
                        className={TEXTAREA}
                        placeholder={"예:\n- 체험수업 1회 1만원\n- 초등학생~중학생 누구나 신청 가능"}
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-200 mb-1">
                        구글폼 URL <span className="text-gray-400 font-normal ml-1">(기존 구글폼 백업용, 현재는 자체 폼 사용)</span>
                    </label>
                    <input
                        type="url"
                        value={trialFormUrl}
                        onChange={(event) => setTrialFormUrl(event.target.value)}
                        className={INPUT}
                        placeholder="https://docs.google.com/forms/d/e/..."
                    />
                </div>
            </SettingsCard>

            <SettingsCard badge="수강신청" badgeColor="bg-blue-50 text-blue-700 border border-blue-200" title="수강신청 안내 설정">
                <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-200 mb-1">섹션 제목</label>
                    <input
                        type="text"
                        value={enrollTitle}
                        onChange={(event) => setEnrollTitle(event.target.value)}
                        className={INPUT}
                        placeholder="수강신청 안내"
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-200 mb-1">
                        안내 내용 <span className="text-gray-400 font-normal ml-1">(수강신청 방법, 준비물, 수강료 납부 방법 등)</span>
                    </label>
                    <textarea
                        value={enrollContent}
                        onChange={(event) => setEnrollContent(event.target.value)}
                        rows={6}
                        className={TEXTAREA}
                        placeholder={"예:\n- 신청서 작성 후 원장님 확인\n- 수강료는 매월 1일 납부"}
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-200 mb-1">
                        구글폼 URL <span className="text-gray-400 font-normal ml-1">(기존 구글폼 백업용, 현재는 자체 폼 사용)</span>
                    </label>
                    <input
                        type="url"
                        value={enrollFormUrl}
                        onChange={(event) => setEnrollFormUrl(event.target.value)}
                        className={INPUT}
                        placeholder="https://docs.google.com/forms/d/e/..."
                    />
                </div>
            </SettingsCard>

            <SettingsCard badge="유니폼" badgeColor="bg-green-50 text-green-700 border border-green-200" title="유니폼 신청 설정">
                <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-200 mb-1">
                        구글폼 URL <span className="text-gray-400 font-normal ml-1">(유니폼 신청용 구글폼)</span>
                    </label>
                    <input
                        type="url"
                        value={uniformFormUrl}
                        onChange={(event) => setUniformFormUrl(event.target.value)}
                        className={INPUT}
                        placeholder="https://docs.google.com/forms/d/e/..."
                    />
                </div>
            </SettingsCard>

            <div className="flex justify-end gap-3">
                {saved && <span className="text-sm text-green-600 font-medium self-center">저장 완료</span>}
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-brand-orange-500 dark:bg-brand-neon-lime dark:text-brand-navy-900 hover:bg-orange-600 text-white font-bold px-8 py-3 rounded-xl transition disabled:opacity-40 shadow-sm"
                >
                    {saving ? "저장 중..." : "저장하기"}
                </button>
            </div>
        </div>
    );
}

function SettingsCard({
    badge,
    badgeColor,
    title,
    children,
}: {
    badge: string;
    badgeColor: string;
    title: string;
    children: ReactNode;
}) {
    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center gap-3">
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${badgeColor}`}>{badge}</span>
                <h2 className="text-base font-bold text-gray-800 dark:text-gray-100">{title}</h2>
            </div>
            <div className="p-6 space-y-4">{children}</div>
        </div>
    );
}
