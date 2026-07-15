"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type NavigatorWithStandalone = Navigator & { standalone?: boolean };

type DeviceState = "checking" | "installed" | "ios-safari" | "ios-browser" | "android" | "other";

export default function StaffAppInstallClient() {
  const [deviceState, setDeviceState] = useState<DeviceState>("checking");
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [isInstalling, setIsInstalling] = useState(false);

  useEffect(() => {
    const navigatorWithStandalone = navigator as NavigatorWithStandalone;
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      navigatorWithStandalone.standalone === true;

    if (isStandalone) {
      setDeviceState("installed");
    } else {
      const userAgent = navigator.userAgent;
      const isIpadOs = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
      const isIos = /iphone|ipad|ipod/i.test(userAgent) || isIpadOs;
      const isSafari = /safari/i.test(userAgent) && !/crios|fxios|edgios|opios/i.test(userAgent);
      const isAndroid = /android/i.test(userAgent);

      if (isIos) setDeviceState(isSafari ? "ios-safari" : "ios-browser");
      else if (isAndroid) setDeviceState("android");
      else setDeviceState("other");
    }

    const handleInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
      setDeviceState("android");
    };

    const handleInstalled = () => {
      setInstallPrompt(null);
      setDeviceState("installed");
    };

    window.addEventListener("beforeinstallprompt", handleInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  const install = async () => {
    if (!installPrompt) return;
    setIsInstalling(true);
    try {
      await installPrompt.prompt();
      await installPrompt.userChoice;
      // 실제 설치 완료 표시는 appinstalled 이벤트에서만 전환합니다.
      // 사용자 수락은 설치 요청 승인일 뿐, 설치 완료를 보장하지 않습니다.
      setInstallPrompt(null);
    } finally {
      setIsInstalling(false);
    }
  };

  const isInstalled = deviceState === "installed";

  return (
    <main className="min-h-screen bg-surface-warm px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] dark:bg-gray-950">
      <div className="mx-auto max-w-lg">
        <header className="flex min-h-11 items-center gap-2 text-brand-navy-900 dark:text-white">
          <span className="grid size-10 place-items-center rounded-xl bg-[var(--brand-accent)] text-[var(--brand-accent-contrast)]" aria-hidden="true">
            <span className="material-symbols-outlined">sports_soccer</span>
          </span>
          <div>
            <p className="text-lg font-black leading-tight">STIZ</p>
            <p className="text-xs font-bold text-gray-500 dark:text-gray-400">선생님 앱</p>
          </div>
        </header>

        <section className="mt-7 overflow-hidden rounded-[2rem] bg-brand-navy-900 px-5 py-7 text-white shadow-xl">
          <div className="mx-auto grid size-20 place-items-center rounded-[1.5rem] bg-[var(--brand-accent)] text-[var(--brand-accent-contrast)] shadow-lg">
            <span className="material-symbols-outlined text-4xl" aria-hidden="true">
              {isInstalled ? "check_circle" : "install_mobile"}
            </span>
          </div>
          <div className="mt-5 text-center">
            <p className="text-sm font-bold text-white/65">수업 관리를 더 빠르게</p>
            <h1 className="mt-1 text-balance text-3xl font-black leading-tight">
              {isInstalled ? "선생님 앱이 준비됐어요" : "STIZ 선생님 앱 설치"}
            </h1>
            <p className="mx-auto mt-3 max-w-sm text-balance text-sm leading-6 text-white/75">
              출결 확인, 수업 사진, 특이사항 기록과 청구 처리를 홈 화면에서 바로 시작하세요.
            </p>
          </div>

          <div className="mt-6">
            {installPrompt && !isInstalled ? (
              <button
                type="button"
                onClick={install}
                disabled={isInstalling}
                className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--brand-accent)] px-5 font-black text-[var(--brand-accent-contrast)] shadow-md disabled:cursor-wait disabled:opacity-70"
              >
                <span className="material-symbols-outlined" aria-hidden="true">download</span>
                {isInstalling ? "설치 준비 중..." : "지금 앱 설치하기"}
              </button>
            ) : (
              <Link
                href="/staff"
                className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--brand-accent)] px-5 font-black text-[var(--brand-accent-contrast)] shadow-md"
              >
                <span className="material-symbols-outlined" aria-hidden="true">open_in_new</span>
                선생님 앱 열기
              </Link>
            )}
          </div>
        </section>

        {!isInstalled && deviceState !== "checking" && (
          <section className="mt-4 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900" aria-labelledby="install-guide-title">
            <div className="flex items-start gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[var(--brand-accent-soft)] text-[var(--brand-accent)]" aria-hidden="true">
                <span className="material-symbols-outlined">touch_app</span>
              </span>
              <div>
                <h2 id="install-guide-title" className="font-black text-gray-900 dark:text-white">
                  {deviceState === "ios-browser" ? "Safari에서 열어주세요" : "홈 화면에 설치하는 방법"}
                </h2>
                <p className="mt-1 text-sm leading-6 text-gray-600 dark:text-gray-300">
                  {deviceState === "ios-safari" && "아래쪽 공유 버튼을 누른 뒤 ‘홈 화면에 추가’를 선택하세요."}
                  {deviceState === "ios-browser" && "iPhone에서는 이 페이지를 Safari로 열어야 홈 화면에 추가할 수 있어요."}
                  {deviceState === "android" && !installPrompt && "브라우저 메뉴에서 ‘앱 설치’ 또는 ‘홈 화면에 추가’를 선택하세요."}
                  {deviceState === "other" && "휴대폰에서 이 링크를 열면 기기에 맞는 설치 방법을 바로 안내해 드려요."}
                </p>
              </div>
            </div>

            {deviceState === "ios-safari" && (
              <ol className="mt-5 space-y-3" aria-label="iPhone 설치 순서">
                {[
                  ["ios_share", "Safari의 공유 버튼 누르기"],
                  ["add_box", "‘홈 화면에 추가’ 선택하기"],
                  ["add", "오른쪽 위 ‘추가’ 누르기"],
                ].map(([icon, label], index) => (
                  <li key={label} className="flex min-h-11 items-center gap-3 rounded-2xl bg-gray-50 px-3 py-2 dark:bg-gray-800">
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-navy-900 text-sm font-black text-white">{index + 1}</span>
                    <span className="material-symbols-outlined text-[var(--brand-accent)]" aria-hidden="true">{icon}</span>
                    <span className="text-sm font-bold text-gray-800 dark:text-gray-100">{label}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        )}

        <section className="mt-4 grid grid-cols-3 gap-2" aria-label="교사용 앱 주요 기능">
          {[
            ["how_to_reg", "출결 확인"],
            ["photo_camera", "수업 사진"],
            ["receipt_long", "청구 처리"],
          ].map(([icon, label]) => (
            <div key={label} className="rounded-2xl bg-white px-2 py-4 text-center shadow-sm dark:bg-gray-900">
              <span className="material-symbols-outlined text-2xl text-[var(--brand-accent)]" aria-hidden="true">{icon}</span>
              <p className="mt-2 text-xs font-bold text-gray-700 dark:text-gray-200">{label}</p>
            </div>
          ))}
        </section>

        <p className="mt-6 text-center text-xs leading-5 text-gray-500 dark:text-gray-400">
          설치하지 않아도 웹에서 바로 사용할 수 있습니다.
        </p>
      </div>
    </main>
  );
}
