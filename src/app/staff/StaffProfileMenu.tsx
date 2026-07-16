"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { logoutStaff } from "@/app/actions/auth";
import { prepareStaffNavigation } from "./staffNavigation";

const publicItems = [
  { href: "/", label: "홈페이지 보기", description: "학원 메인으로 이동", icon: "home" },
  { href: "/notices", label: "공지사항", description: "학원 소식 확인", icon: "campaign" },
  { href: "/programs", label: "프로그램", description: "수업 프로그램 확인", icon: "sports_basketball" },
  { href: "/schedule", label: "수업시간표", description: "전체 시간표 확인", icon: "calendar_month" },
  { href: "/gallery", label: "포토갤러리", description: "수업 사진 확인", icon: "photo_library" },
] as const;

const focusableSelector = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function StaffProfileMenu({ staffName }: { staffName: string }) {
  const pathname = usePathname();
  const isSessionInProgress = pathname.startsWith("/staff/sessions/");
  const [isOpen, setIsOpen] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!isOpen && !pendingHref) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.requestAnimationFrame(() => {
      dialogRef.current?.querySelector<HTMLElement>(focusableSelector)?.focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (leaving) return;
        setIsOpen(false);
        setPendingHref(null);
        setLeaveError("");
        window.requestAnimationFrame(() => triggerRef.current?.focus());
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;

      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(focusableSelector));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, pendingHref, leaving]);

  const closeAndRestoreFocus = () => {
    setIsOpen(false);
    setPendingHref(null);
    setLeaving(false);
    setLeaveError("");
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const leaveSession = async () => {
    if (!pendingHref || leaving) return;
    setLeaving(true);
    setLeaveError("");
    const result = await prepareStaffNavigation();
    if (!result.ok) {
      setLeaving(false);
      setLeaveError(result.message || "수업 기록을 저장하지 못해 이동을 중단했습니다.");
      return;
    }
    window.location.assign(pendingHref);
  };

  const requestPublicNavigation = (event: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (!isSessionInProgress) {
      setIsOpen(false);
      return;
    }
    event.preventDefault();
    setIsOpen(false);
    setPendingHref(href);
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls={isOpen ? "staff-profile-menu" : undefined}
        className="flex min-h-12 max-w-[11rem] items-center gap-2 rounded-full bg-gray-100 px-3 text-left transition-colors hover:bg-gray-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-accent)] dark:bg-gray-900 dark:hover:bg-gray-800"
      >
        <span className="material-symbols-outlined text-xl text-[var(--brand-accent)]" aria-hidden="true">account_circle</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold text-gray-700 dark:text-gray-200">{staffName} 선생님</span>
          <span className="block text-[0.65rem] font-bold text-gray-500 dark:text-gray-400">메뉴 열기</span>
        </span>
        <span className="material-symbols-outlined text-lg text-gray-500" aria-hidden="true">expand_more</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-3 sm:items-center" onMouseDown={(event) => event.target === event.currentTarget && closeAndRestoreFocus()}>
          <div ref={dialogRef} id="staff-profile-menu" role="dialog" aria-modal="true" aria-labelledby={titleId} className="max-h-[calc(100dvh-1.5rem)] w-full max-w-md overflow-y-auto rounded-3xl bg-white p-4 shadow-2xl dark:bg-gray-900">
            <div className="mb-3 flex min-h-12 items-center justify-between gap-3">
              <div>
                <h2 id={titleId} className="text-lg font-black text-gray-900 dark:text-white">선생님 메뉴</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">업무 앱과 홈페이지를 오갈 수 있어요.</p>
              </div>
              <button type="button" onClick={closeAndRestoreFocus} aria-label="선생님 메뉴 닫기" className="grid size-12 shrink-0 place-items-center rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700">
                <span className="material-symbols-outlined" aria-hidden="true">close</span>
              </button>
            </div>

            {isSessionInProgress && (
              <p className="mb-3 rounded-2xl bg-[color-mix(in_srgb,var(--brand-accent)_10%,transparent)] p-3 text-sm font-bold text-gray-700 dark:text-gray-200">
                수업이 진행 중입니다. 홈페이지 메뉴를 선택하면 이동 전에 한 번 더 확인합니다.
              </p>
            )}

            <nav aria-label="홈페이지 바로가기" className="grid gap-2">
              {publicItems.map((item) => (
                <Link key={item.href} href={item.href} onClick={(event) => requestPublicNavigation(event, item.href)} className="flex min-h-14 items-center gap-3 rounded-2xl border border-gray-200 px-3 py-2 text-gray-800 transition-colors hover:border-[var(--brand-accent)] hover:bg-[color-mix(in_srgb,var(--brand-accent)_7%,transparent)] dark:border-gray-700 dark:text-gray-100">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-gray-100 text-[var(--brand-accent)] dark:bg-gray-800" aria-hidden="true"><span className="material-symbols-outlined">{item.icon}</span></span>
                  <span className="min-w-0 flex-1"><span className="block text-sm font-black">{item.label}</span><span className="block text-xs text-gray-500 dark:text-gray-400">{item.description}</span></span>
                  <span className="material-symbols-outlined text-lg text-gray-400" aria-hidden="true">chevron_right</span>
                </Link>
              ))}
            </nav>

            <div className="mt-3 grid grid-cols-2 gap-2 border-t border-gray-200 pt-3 dark:border-gray-700">
              <Link href="/staff/install" onClick={(event) => requestPublicNavigation(event, "/staff/install")} className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-gray-100 text-sm font-bold text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700">
                <span className="material-symbols-outlined" aria-hidden="true">install_mobile</span>설치 안내
              </Link>
              {isSessionInProgress ? (
                <button type="button" disabled title="수업 종료 후 로그아웃할 수 있습니다" className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gray-100 text-sm font-bold text-gray-400 disabled:cursor-not-allowed dark:bg-gray-800 dark:text-gray-500">
                  <span className="material-symbols-outlined" aria-hidden="true">lock_clock</span>수업 종료 후 로그아웃
                </button>
              ) : (
                <form action={logoutStaff}>
                  <button type="submit" className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gray-100 text-sm font-bold text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700">
                    <span className="material-symbols-outlined" aria-hidden="true">logout</span>로그아웃
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {pendingHref && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-3 sm:items-center" onMouseDown={(event) => !leaving && event.target === event.currentTarget && closeAndRestoreFocus()}>
          <div ref={dialogRef} role="alertdialog" aria-modal="true" aria-labelledby={titleId} className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl dark:bg-gray-900">
            <span className="material-symbols-outlined mb-3 text-3xl text-[var(--brand-accent)]" aria-hidden="true">timer</span>
            <h2 id={titleId} className="text-lg font-black text-gray-900 dark:text-white">수업 중 홈페이지로 이동할까요?</h2>
            <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">이동하기 전에 작성한 수업 내용을 저장합니다. 저장이 완료되지 않으면 현재 화면에 머무릅니다.</p>
            {leaveError && <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700 dark:bg-red-950/40 dark:text-red-300">{leaveError}</p>}
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button type="button" disabled={leaving} onClick={closeAndRestoreFocus} className="min-h-12 rounded-2xl bg-gray-100 text-sm font-bold text-gray-700 hover:bg-gray-200 disabled:opacity-50 dark:bg-gray-800 dark:text-gray-200">계속 수업하기</button>
              <button type="button" disabled={leaving} aria-busy={leaving} onClick={() => void leaveSession()} className="min-h-12 rounded-2xl bg-[var(--brand-accent)] text-sm font-black text-[var(--brand-accent-contrast)] disabled:opacity-60">{leaving ? "저장 확인 중…" : "저장 후 이동"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
