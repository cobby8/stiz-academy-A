"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type AdminQuickAction = {
    key: string;
    label: string;
    icon: string;
    tone?: "default" | "primary" | "danger";
    disabled?: boolean;
    onSelect: () => void | Promise<void>;
};

type AdminQuickActionMenuProps = {
    label: string;
    actions: AdminQuickAction[];
    icon?: string;
    className?: string;
};

type MenuPosition = {
    top: number;
    left: number;
};

const MENU_WIDTH = 168;
const MENU_MARGIN = 12;

function getActionClass(tone: AdminQuickAction["tone"]) {
    const base =
        "flex h-9 w-full items-center justify-between gap-2 rounded-[3px] px-3 text-left text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-50";

    if (tone === "primary") {
        return `${base} bg-brand-neon-lime text-[var(--doc-ink)]  hover:brightness-95`;
    }

    if (tone === "danger") {
        return `${base} bg-[var(--doc-crit-soft)] text-[var(--doc-crit)] hover:bg-[var(--doc-crit-soft)]   `;
    }

    return `${base} bg-[var(--doc-surface)] text-[var(--doc-ink)]    hover:bg-[var(--doc-grid-head)]  dark: `;
}

export default function AdminQuickActionMenu({
    label,
    actions,
    icon = "flash_on",
    className = "",
}: AdminQuickActionMenuProps) {
    const [open, setOpen] = useState(false);
    const [position, setPosition] = useState<MenuPosition | null>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    const placeMenu = useCallback(() => {
        const button = buttonRef.current;
        if (!button) return;

        const rect = button.getBoundingClientRect();
        const menuHeight = Math.max(64, actions.length * 44 + 16);
        const preferredLeft = rect.left - MENU_WIDTH - 10;
        const fallbackRight = rect.right + 10;
        const maxLeft = window.innerWidth - MENU_WIDTH - MENU_MARGIN;
        const left = preferredLeft >= MENU_MARGIN
            ? Math.min(preferredLeft, maxLeft)
            : Math.min(Math.max(fallbackRight, MENU_MARGIN), maxLeft);
        const top = Math.min(
            Math.max(rect.top + rect.height / 2, MENU_MARGIN + menuHeight / 2),
            window.innerHeight - MENU_MARGIN - menuHeight / 2,
        );

        setPosition({
            top,
            left: Math.max(MENU_MARGIN, left),
        });
    }, [actions.length]);

    useEffect(() => {
        if (!open) return;

        placeMenu();

        function handlePointerDown(event: PointerEvent) {
            const target = event.target;
            if (!(target instanceof Node)) return;
            if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return;
            setOpen(false);
        }

        function handleKeyDown(event: KeyboardEvent) {
            if (event.key === "Escape") {
                setOpen(false);
            }
        }

        window.addEventListener("resize", placeMenu);
        window.addEventListener("scroll", placeMenu, true);
        document.addEventListener("pointerdown", handlePointerDown);
        document.addEventListener("keydown", handleKeyDown);

        return () => {
            window.removeEventListener("resize", placeMenu);
            window.removeEventListener("scroll", placeMenu, true);
            document.removeEventListener("pointerdown", handlePointerDown);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [open, placeMenu]);

    return (
        <div className={`relative inline-flex justify-center ${className}`}>
            <button
                ref={buttonRef}
                type="button"
                aria-label={label}
                title={label}
                aria-expanded={open}
                onClick={() => {
                    if (!open) placeMenu();
                    setOpen((current) => !current);
                }}
                className="inline-flex h-9 w-9 items-center justify-center rounded-[3px] bg-[var(--doc-crit)] text-white transition hover:bg-[var(--doc-crit)] dark:text-[var(--doc-ink)] dark:hover:brightness-95"
            >
                <span className="material-symbols-outlined text-[20px]">{icon}</span>
            </button>

            {open && (
                <div
                    ref={menuRef}
                    style={{
                        top: position?.top ?? 0,
                        left: position?.left ?? 0,
                    }}
                    className="fixed z-[90] flex w-[168px] -translate-y-1/2 flex-col gap-2 rounded-[6px] border border-[var(--doc-rule)] bg-[var(--doc-surface)] p-2"
                >
                    {actions.map((action) => (
                        <button
                            key={action.key}
                            type="button"
                            disabled={action.disabled}
                            onClick={() => {
                                if (action.disabled) return;
                                setOpen(false);
                                void action.onSelect();
                            }}
                            className={getActionClass(action.tone)}
                        >
                            <span className="truncate">{action.label}</span>
                            <span className="material-symbols-outlined text-[18px]">{action.icon}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
