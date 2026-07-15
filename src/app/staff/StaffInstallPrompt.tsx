"use client";
import { useEffect, useState } from "react";
type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

export default function StaffInstallPrompt() {
  const [event, setEvent] = useState<InstallEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    const timer = window.setTimeout(() => {
      setHidden(sessionStorage.getItem("staff-install-dismissed") === "1");
      setIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    }, 0);
    const onPrompt = (promptEvent: Event) => {
      promptEvent.preventDefault();
      setEvent(promptEvent as InstallEvent);
      setHidden(false);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt", onPrompt);
    };
  }, []);

  if (hidden || (!event && !ios)) return null;

  const dismiss = () => {
    sessionStorage.setItem("staff-install-dismissed", "1");
    setHidden(true);
  };

  return <aside className="mx-auto mt-3 max-w-lg px-4" aria-label="앱 설치 안내">
    <div className="relative overflow-hidden rounded-2xl bg-brand-navy-900 p-4 text-white shadow-lg">
      <button type="button" onClick={dismiss} className="absolute right-2 top-2 grid size-11 place-items-center rounded-full text-white/70 hover:bg-white/10" aria-label="설치 안내 닫기">
        <span className="material-symbols-outlined" aria-hidden="true">close</span>
      </button>
      <div className="flex gap-3 pr-9">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[var(--brand-accent)] text-[var(--brand-accent-contrast)]">
          <span className="material-symbols-outlined" aria-hidden="true">install_mobile</span>
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-black">홈 화면에 선생님 앱 설치</p>
          <p className="mt-1 text-sm leading-5 text-white/70">{ios ? "Safari 공유 버튼을 누른 뒤 ‘홈 화면에 추가’를 선택하세요." : "한 번 설치하면 수업 현장에서 앱처럼 바로 열 수 있어요."}</p>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        {event && <button type="button" onClick={async () => { await event.prompt(); if ((await event.userChoice).outcome === "accepted") setHidden(true); }} className="min-h-11 flex-1 rounded-xl bg-[var(--brand-accent)] px-4 font-black text-[var(--brand-accent-contrast)]">지금 설치</button>}
        <button type="button" onClick={dismiss} className="min-h-11 rounded-xl border border-white/20 px-4 font-bold text-white hover:bg-white/10">나중에</button>
      </div>
    </div>
  </aside>;
}
