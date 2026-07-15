"use client";

import { useEffect, useState } from "react";

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type NavigatorWithStandalone = Navigator & { standalone?: boolean };

const DISMISS_KEY = "staff-install-dismissed-at";
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

export default function StaffInstallPrompt() {
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);
  const [isIos, setIsIos] = useState(false);
  const [isHidden, setIsHidden] = useState(true);

  useEffect(() => {
    const navigatorWithStandalone = navigator as NavigatorWithStandalone;
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      navigatorWithStandalone.standalone === true;

    if (isStandalone) return;

    const iosDevice = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const timer = window.setTimeout(() => {
      const dismissedAt = Number(localStorage.getItem(DISMISS_KEY));
      const isRecentlyDismissed =
        Number.isFinite(dismissedAt) && Date.now() - dismissedAt < DISMISS_DURATION_MS;
      setIsIos(iosDevice);
      setIsHidden(isRecentlyDismissed);
    }, 0);

    const handleInstallPrompt = (promptEvent: Event) => {
      promptEvent.preventDefault();
      setInstallEvent(promptEvent as InstallEvent);
      setIsHidden(false);
    };

    const handleInstalled = () => {
      localStorage.removeItem(DISMISS_KEY);
      setIsHidden(true);
      setInstallEvent(null);
    };

    window.addEventListener("beforeinstallprompt", handleInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  if (isHidden || (!installEvent && !isIos)) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setIsHidden(true);
  };

  const install = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === "accepted") setIsHidden(true);
    setInstallEvent(null);
  };

  return (
    <aside className="mx-auto mt-3 max-w-lg px-4" aria-label="교사용 앱 설치 안내">
      <div className="relative overflow-hidden rounded-2xl bg-brand-navy-900 p-4 text-white shadow-lg">
        <button
          type="button"
          onClick={dismiss}
          className="absolute right-2 top-2 grid size-11 place-items-center rounded-full text-white/70 hover:bg-white/10"
          aria-label="설치 안내 닫기"
        >
          <span className="material-symbols-outlined" aria-hidden="true">close</span>
        </button>
        <div className="flex gap-3 pr-9">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[var(--brand-accent)] text-[var(--brand-accent-contrast)]">
            <span className="material-symbols-outlined" aria-hidden="true">install_mobile</span>
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-black">STIZ 선생님 앱으로 설치</p>
            <p className="mt-1 text-sm leading-5 text-white/70">
              {isIos
                ? "브라우저의 공유 메뉴를 연 뒤 ‘홈 화면에 추가’를 선택하세요."
                : "설치하면 휴대폰 홈 화면에서 오늘 수업으로 바로 들어올 수 있어요."}
            </p>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          {installEvent && (
            <button
              type="button"
              onClick={install}
              className="min-h-11 flex-1 rounded-xl bg-[var(--brand-accent)] px-4 font-black text-[var(--brand-accent-contrast)]"
            >
              지금 설치
            </button>
          )}
          <button
            type="button"
            onClick={dismiss}
            className="min-h-11 rounded-xl border border-white/20 px-4 font-bold text-white hover:bg-white/10"
          >
            나중에
          </button>
        </div>
      </div>
    </aside>
  );
}
