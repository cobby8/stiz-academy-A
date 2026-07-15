"use client";

import { type RefObject, useEffect } from "react";

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

let bodyLockCount = 0;
let originalBodyOverflow: string | null = null;

function lockBodyScroll() {
  if (bodyLockCount === 0) {
    originalBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  bodyLockCount += 1;
}

function unlockBodyScroll() {
  // StrictMode의 effect 정리나 예외적인 중복 정리에서도 음수가 되지 않게 방어합니다.
  bodyLockCount = Math.max(0, bodyLockCount - 1);
  if (bodyLockCount === 0 && originalBodyOverflow !== null) {
    document.body.style.overflow = originalBodyOverflow;
    originalBodyOverflow = null;
  }
}

export function useStaffDialog(
  open: boolean,
  containerRef: RefObject<HTMLElement | null>,
  onClose: () => void,
  escapeEnabled = true,
  keyboardEnabled = true,
) {
  useEffect(() => {
    if (!open) return;
    let bodyLockActive = true;
    lockBodyScroll();
    return () => {
      if (bodyLockActive) {
        bodyLockActive = false;
        unlockBodyScroll();
      }
    };
  }, [open]);

  useEffect(() => {
    if (!open || !keyboardEnabled) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const frame = requestAnimationFrame(() => {
      containerRef.current?.querySelector<HTMLElement>("[data-dialog-initial-focus]")?.focus();
    });
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && escapeEnabled) {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(containerRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
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
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus();
    };
  }, [containerRef, escapeEnabled, keyboardEnabled, onClose, open]);
}
