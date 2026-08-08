"use client";

import { useState } from "react";
import {
  buildKakaoExternalUrl,
  getInAppBrowserLabel,
  getInAppEscapeSteps,
  type InAppBrowserKind,
  type InstallPlatform,
} from "@/lib/pwa/installEnvironment";

/**
 * 아이폰 설치 안내용 공용 조각들.
 * 학부모 앱 / 선생님 앱 두 화면이 같은 안내를 쓰도록 여기 모아 둔다.
 * (3단계 안내 문구 자체는 화면마다 남겨 둔다 — 회귀 테스트가 각 화면에서 문구를 확인한다)
 */

/**
 * Safari 하단 툴바 그림.
 * "공유 버튼"이라는 말만으로는 못 찾으므로 위치를 짚어 주는 용도다.
 * 외부 이미지 대신 인라인 SVG를 쓰는 이유: 추가 요청·로딩 실패·CSP 문제가 없다.
 */
export function SafariShareIllustration() {
  return (
    <figure className="mt-4">
      <svg
        viewBox="0 0 320 96"
        className="h-auto w-full text-gray-400 dark:text-gray-500"
        role="img"
        aria-label="Safari 툴바 가운데에 있는 공유 버튼 위치 그림"
      >
        {/* 툴바 몸통 */}
        <rect x="6" y="20" width="308" height="60" rx="18" className="fill-gray-100 dark:fill-gray-800" />
        {/* 뒤로 / 앞으로 */}
        <path d="M50 40 L38 50 L50 60" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M96 40 L108 50 L96 60" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        {/* 강조 원 — 여기가 공유 버튼 */}
        <circle
          cx="160"
          cy="50"
          r="26"
          fill="var(--brand-accent-soft)"
          stroke="var(--brand-accent)"
          strokeWidth="3"
          strokeDasharray="6 5"
        />
        {/* 공유 아이콘: 위가 열린 상자 + 위로 향한 화살표 */}
        <path
          d="M148 48 V60 a4 4 0 0 0 4 4 h16 a4 4 0 0 0 4 -4 V48"
          fill="none"
          stroke="var(--brand-accent)"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <path
          d="M160 56 V36 M152 44 L160 36 L168 44"
          fill="none"
          stroke="var(--brand-accent)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* 나머지 툴바 아이콘 (모양만) */}
        <path d="M216 40 h20 v20 h-20 z" fill="none" stroke="currentColor" strokeWidth="4" strokeLinejoin="round" />
        <path d="M270 42 h22 M270 50 h22 M270 58 h22" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      </svg>
      <figcaption className="mt-2 text-center text-xs font-bold text-gray-500 dark:text-gray-400">
        화면 아래쪽(또는 위쪽) 가운데의 공유 버튼이에요.
      </figcaption>
    </figure>
  );
}

type CopyAddressButtonProps = {
  /** 어두운 카드 위에 놓을 때 대비를 바꾼다 */
  tone?: "light" | "dark";
};

/**
 * 최후의 수단 — 주소 복사.
 * 어떤 인앱 브라우저든 주소만 복사하면 Safari 주소창에 붙여넣어 열 수 있다.
 * 복사 실패를 조용히 넘기면 사용자는 계속 막히므로 성공/실패를 반드시 알린다.
 */
export function CopyAddressButton({ tone = "light" }: CopyAddressButtonProps) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");
  const [address, setAddress] = useState("");

  const copy = async () => {
    const url = window.location.href;
    setAddress(url);
    try {
      // clipboard API는 https(또는 localhost)에서만 동작한다. 실패하면 아래에서 직접 안내한다.
      await navigator.clipboard.writeText(url);
      setStatus("copied");
    } catch {
      setStatus("failed");
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={copy}
        className={
          tone === "dark"
            ? "flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-white/25 px-4 text-sm font-black text-white"
            : "flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-gray-300 bg-white px-4 text-sm font-black text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
        }
      >
        <span className="material-symbols-outlined text-lg" aria-hidden="true">content_copy</span>
        주소 복사하기
      </button>
      <p aria-live="polite" className="mt-2 text-center text-xs font-bold text-gray-500 dark:text-gray-400">
        {status === "copied" && "복사됐어요. Safari 주소창에 붙여넣어 주세요."}
        {status === "failed" && "복사가 막혔어요. 아래 주소를 길게 눌러 복사해 주세요."}
      </p>
      {status === "failed" && (
        <p className="mt-1 select-all break-all rounded-xl bg-gray-100 px-3 py-2 text-center text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-200">
          {address}
        </p>
      )}
    </div>
  );
}

type InAppBrowserEscapeCardProps = {
  inAppBrowser: InAppBrowserKind;
  platform: InstallPlatform;
};

/**
 * 인앱 브라우저(카카오톡 등)에서 열렸을 때 보여주는 탈출 안내.
 * 현장에서 가장 많이 막히는 지점이라 다른 안내보다 위에 둔다.
 */
export function InAppBrowserEscapeCard({ inAppBrowser, platform }: InAppBrowserEscapeCardProps) {
  const label = getInAppBrowserLabel(inAppBrowser);
  const steps = getInAppEscapeSteps(inAppBrowser, platform);
  const browserName = platform === "ios" ? "Safari" : "브라우저";

  const openExternal = () => {
    // 카카오톡만 외부 브라우저를 여는 스킴을 제공한다. 이동하면 기본 브라우저로 같은 주소가 열린다.
    window.location.href = buildKakaoExternalUrl(window.location.href);
  };

  return (
    <section
      className="mt-4 rounded-3xl border border-brand-orange-200 bg-orange-50 p-5 dark:border-brand-neon-lime/30 dark:bg-brand-neon-lime/10"
      aria-labelledby="inapp-escape-title"
    >
      <div className="flex items-start gap-3">
        <span
          className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white text-brand-orange-500 shadow-sm dark:bg-gray-900 dark:text-brand-neon-lime"
          aria-hidden="true"
        >
          <span className="material-symbols-outlined">open_in_browser</span>
        </span>
        <div>
          <h2 id="inapp-escape-title" className="font-black text-brand-navy-900 dark:text-white">
            {label}에서 열렸어요
          </h2>
          <p className="mt-1 text-sm leading-6 text-brand-navy-700 dark:text-gray-200">
            여기서는 홈 화면에 추가할 수 없어요. {browserName}로 열어주세요.
          </p>
        </div>
      </div>

      {inAppBrowser === "kakaotalk" ? (
        <button
          type="button"
          onClick={openExternal}
          className="mt-4 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--brand-accent)] px-5 font-black text-[var(--brand-accent-contrast)] shadow-md"
        >
          <span className="material-symbols-outlined" aria-hidden="true">open_in_new</span>
          {browserName}에서 열기
        </button>
      ) : null}

      {/* 스킴이 없는 앱은 메뉴로 빠져나가는 길을 알려준다. 카카오톡도 버튼이 막힐 때를 대비해 함께 보여준다. */}
      <ol className="mt-3 space-y-2" aria-label={`${label}에서 빠져나가는 방법`}>
        {steps.map((step, index) => (
          <li
            key={step}
            className="flex min-h-11 items-center gap-3 rounded-2xl bg-white px-3 py-2 dark:bg-gray-900"
          >
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-navy-900 text-xs font-black text-white dark:bg-brand-neon-lime dark:text-brand-navy-900">
              {index + 1}
            </span>
            <span className="text-sm font-bold text-gray-800 dark:text-gray-100">{step}</span>
          </li>
        ))}
      </ol>

      <div className="mt-3">
        <CopyAddressButton />
      </div>
    </section>
  );
}
