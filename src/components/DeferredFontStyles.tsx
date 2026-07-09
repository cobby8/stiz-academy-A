"use client";

import { useEffect } from "react";

const MATERIAL_SYMBOLS_URL =
    "https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0";
const PRETENDARD_URL =
    "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css";

type IdleWindow = Window &
    typeof globalThis & {
        requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number;
        cancelIdleCallback?: (handle: number) => void;
    };

function appendStylesheet(id: string, href: string, onLoad?: () => void) {
    if (document.getElementById(id)) {
        onLoad?.();
        return;
    }

    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = href;
    link.onload = () => onLoad?.();
    document.head.appendChild(link);
}

export default function DeferredFontStyles() {
    useEffect(() => {
        let iconObserver: MutationObserver | null = null;

        const loadIcons = () => {
            appendStylesheet("material-symbols-css", MATERIAL_SYMBOLS_URL, () => {
                document.documentElement.classList.add("material-symbols-ready");
            });
        };

        const loadIconsIfPresent = () => {
            if (!document.querySelector(".material-symbols-outlined")) return false;
            loadIcons();
            return true;
        };

        const watchForIconUse = () => {
            if (loadIconsIfPresent()) return;
            iconObserver = new MutationObserver(() => {
                if (!loadIconsIfPresent()) return;
                iconObserver?.disconnect();
                iconObserver = null;
            });
            iconObserver.observe(document.body, { childList: true, subtree: true });
        };

        const loadPretendard = () => {
            appendStylesheet("pretendard-css", PRETENDARD_URL);
        };

        const idleWindow = window as IdleWindow;
        const iconFrame = window.requestAnimationFrame(watchForIconUse);
        const idleId = idleWindow.requestIdleCallback
            ? idleWindow.requestIdleCallback(loadPretendard, { timeout: 2500 })
            : window.setTimeout(loadPretendard, 1500);

        return () => {
            window.cancelAnimationFrame(iconFrame);
            iconObserver?.disconnect();
            if (idleWindow.cancelIdleCallback) {
                idleWindow.cancelIdleCallback(idleId);
            } else {
                window.clearTimeout(idleId);
            }
        };
    }, []);

    return null;
}
