"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { defaultPathForRole, normalizeAppRole, type AppRole } from "@/lib/auth-routes";
import { createClient } from "@/lib/supabase/client";

const DESKTOP_ACCOUNT_CLASS = [
  "hidden md:inline-flex items-center rounded-xl border border-gray-200 px-3 py-2 text-sm font-bold",
  "text-gray-700 transition-colors hover:border-brand-orange-300 hover:bg-brand-orange-50 hover:text-brand-orange-600",
  "dark:border-gray-700 dark:text-gray-200 dark:hover:border-brand-neon-lime/40 dark:hover:bg-brand-neon-lime/10 dark:hover:text-brand-neon-lime",
].join(" ");

const DESKTOP_LOGOUT_CLASS = [
  "inline-flex items-center rounded-xl border border-gray-200 px-3 py-2 text-sm font-bold",
  "text-gray-600 transition-colors hover:border-gray-300 hover:bg-gray-50 hover:text-gray-900",
  "dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white",
].join(" ");

function useAccountState() {
  const [appRole, setAppRole] = useState<AppRole | null>(null);

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getUser().then(({ data: { user } }) => {
      setAppRole(user ? normalizeAppRole(user.user_metadata?.role) : null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setAppRole(session?.user ? normalizeAppRole(session.user.user_metadata?.role) : null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const accountHref = appRole ? defaultPathForRole(appRole) : "/login";
  const accountLabel =
    appRole === "ADMIN" || appRole === "VICE_ADMIN"
      ? "관리자"
      : appRole === "INSTRUCTOR"
        ? "사진 올리기"
        : appRole === "PARENT"
          ? "마이페이지"
          : "로그인";

  return { accountHref, accountLabel, isLoggedIn: appRole !== null };
}

export function DesktopAccountControls() {
  const { accountHref, accountLabel, isLoggedIn } = useAccountState();

  return (
    <>
      <Link href={accountHref} className={DESKTOP_ACCOUNT_CLASS}>
        {accountLabel}
      </Link>

      {isLoggedIn && (
        <form action={logout} className="hidden md:block">
          <button type="submit" className={DESKTOP_LOGOUT_CLASS}>
            로그아웃
          </button>
        </form>
      )}
    </>
  );
}

export function MobileAccountControls({ onNavigate }: { onNavigate?: () => void }) {
  const { accountHref, accountLabel, isLoggedIn } = useAccountState();

  return (
    <div className="grid grid-cols-2 gap-2 mb-3">
      <Link
        href={accountHref}
        onClick={onNavigate}
        className="flex min-h-11 items-center justify-center rounded-xl border border-brand-orange-200 bg-white text-sm font-bold text-brand-orange-600 transition-colors hover:bg-brand-orange-50 dark:border-brand-neon-lime/30 dark:bg-gray-900 dark:text-brand-neon-lime"
      >
        {accountLabel}
      </Link>
      {isLoggedIn ? (
        <form action={logout}>
          <button
            type="submit"
            className="flex min-h-11 w-full items-center justify-center rounded-xl border border-gray-200 bg-white text-sm font-bold text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
          >
            로그아웃
          </button>
        </form>
      ) : (
        <Link
          href="/staff/quick-post"
          onClick={onNavigate}
          className="flex min-h-11 items-center justify-center rounded-xl border border-gray-200 bg-white text-sm font-bold text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
        >
          사진 올리기
        </Link>
      )}
    </div>
  );
}
