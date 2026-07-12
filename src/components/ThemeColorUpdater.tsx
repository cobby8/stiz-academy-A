"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";

const LIGHT_THEME_COLOR = "#f97316";
const DARK_THEME_COLOR = "#ccff00";

export default function ThemeColorUpdater() {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const themeColor = resolvedTheme === "dark" ? DARK_THEME_COLOR : LIGHT_THEME_COLOR;
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');

    if (meta) {
      meta.content = themeColor;
      return;
    }

    const nextMeta = document.createElement("meta");
    nextMeta.name = "theme-color";
    nextMeta.content = themeColor;
    document.head.append(nextMeta);
  }, [resolvedTheme]);

  return null;
}
