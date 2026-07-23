"use client";

import { usePathname, useRouter } from "next/navigation";
import FontFreeIcon from "@/components/ui/FontFreeIcon";

type AppBackButtonProps = {
  fallbackHref?: string;
  className?: string;
  size?: "sm" | "md";
  variant?: "header" | "floating";
  ariaLabel?: string;
};

function canGoBackWithinApp() {
  if (typeof window === "undefined") return false;

  const historyIndex = Number(window.history.state?.idx ?? 0);
  if (historyIndex > 0) return true;

  try {
    return Boolean(document.referrer) && new URL(document.referrer).origin === window.location.origin;
  } catch {
    return false;
  }
}

export default function AppBackButton({
  fallbackHref = "/",
  className = "",
  size = "md",
  variant = "header",
  ariaLabel = "이전 화면으로 돌아가기",
}: AppBackButtonProps) {
  const router = useRouter();
  const pathname = usePathname() || "/";
  const sizeClass = size === "sm" ? "h-9 w-9 rounded-lg" : "h-10 w-10 rounded-xl";
  const variantClass =
    variant === "floating"
      ? "border-gray-200 bg-white/95 text-gray-800 shadow-lg backdrop-blur hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-900/95 dark:text-gray-100 dark:hover:bg-gray-800"
      : "border-gray-200 bg-white text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800";

  const handleClick = () => {
    if (canGoBackWithinApp()) {
      router.back();
      return;
    }

    router.push(fallbackHref === pathname ? "/" : fallbackHref);
  };

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      title={ariaLabel}
      onClick={handleClick}
      className={[
        "inline-flex shrink-0 items-center justify-center border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-accent)]",
        sizeClass,
        variantClass,
        className,
      ].join(" ")}
    >
      <FontFreeIcon name="arrow_back" size={size === "sm" ? 18 : 20} />
    </button>
  );
}
