"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { updateAcademySettings } from "@/app/actions/admin";
import { DEFAULT_PRIVACY_POLICY } from "@/lib/defaultPolicies";

function PolicyEditorLoadingFallback() {
  return (
    <div className="space-y-6">
      <div>
        <div className="h-8 w-56 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
        <div className="mt-2 h-4 w-96 max-w-full animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
      </div>
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="h-5 w-32 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
        <div className="mt-4 h-[520px] animate-pulse rounded-lg bg-gray-100 dark:bg-gray-700" />
        <div className="mt-4 flex justify-end gap-2">
          <div className="h-10 w-24 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-700" />
          <div className="h-10 w-24 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700" />
        </div>
      </div>
    </div>
  );
}

export default function PrivacyAdminClient({
  privacyPolicy: initialPrivacyPolicy,
}: {
  privacyPolicy?: string;
}) {
  const hasInitialData = initialPrivacyPolicy !== undefined;
  const [privacyPolicy, setPrivacyPolicy] = useState(initialPrivacyPolicy ?? DEFAULT_PRIVACY_POLICY);
  const [loading, setLoading] = useState(!hasInitialData);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const loadPrivacyPolicy = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/settings", { cache: "no-store" });
      if (!response.ok) throw new Error("Failed to load academy settings.");
      const data = (await response.json()) as { settings?: { privacyPolicy?: string | null } | null };
      setPrivacyPolicy(data.settings?.privacyPolicy?.trim() || DEFAULT_PRIVACY_POLICY);
    } catch (error) {
      console.error("Failed to load privacy policy:", error);
      setPrivacyPolicy(DEFAULT_PRIVACY_POLICY);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (hasInitialData) return;
    void loadPrivacyPolicy();
  }, [hasInitialData, loadPrivacyPolicy]);

  if (loading) {
    return <PolicyEditorLoadingFallback />;
  }

  function savePrivacyPolicy() {
    startTransition(async () => {
      try {
        await updateAcademySettings({ privacyPolicy });
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } catch (e: any) {
        alert(e.message || "저장 실패");
      }
    });
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          개인정보처리방침 관리
        </h1>
        <p className="text-gray-500 dark:text-gray-400">
          공개 페이지(/privacy)에 표시되는 개인정보 처리방침을 관리합니다.
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            개인정보 처리방침 내용
          </h2>
          <div className="flex items-center gap-3">
            {saved && <span className="text-xs text-green-600 font-medium">저장됨</span>}
            <button
              onClick={savePrivacyPolicy}
              disabled={pending}
              className="bg-brand-navy-900 text-white text-sm font-bold px-4 py-2 rounded-lg hover:bg-gray-800 transition disabled:opacity-40"
            >
              {pending ? "저장 중..." : "저장"}
            </button>
          </div>
        </div>
        <textarea
          value={privacyPolicy}
          onChange={(e) => {
            setPrivacyPolicy(e.target.value);
            setSaved(false);
          }}
          rows={22}
          placeholder={"제1조 (개인정보의 처리 목적)\n..."}
          className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-orange-500 dark:focus:ring-brand-neon-lime focus:border-brand-orange-500 dark:border-brand-neon-lime bg-gray-50 focus:bg-white dark:focus:bg-gray-700 dark:bg-gray-800 resize-y font-mono leading-relaxed"
        />
        <p className="text-xs text-gray-400 mt-2">
          "제1조 (...)"처럼 조항 제목을 줄 시작에 쓰면 공개 페이지에서 카드 단위로 나뉘어 표시됩니다.
        </p>
      </div>
    </div>
  );
}
