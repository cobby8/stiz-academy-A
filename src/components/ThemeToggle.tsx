"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import FontFreeIcon from "./ui/FontFreeIcon";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="w-9 h-9" />;
  }

  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="p-2 rounded-lg hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-800 transition-colors flex items-center justify-center text-gray-700 dark:text-gray-300"
      aria-label="Toggle theme"
    >
      <FontFreeIcon name={theme === "dark" ? "light_mode" : "dark_mode"} size={22} />
    </button>
  );
}
