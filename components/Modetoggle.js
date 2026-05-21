"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ModeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const isDark = theme === "dark";

  return (
    <label className="inline-flex items-center cursor-pointer">
      <input
        type="checkbox"
        className="sr-only peer"
        checked={isDark}
        onChange={(e) => setTheme(e.target.checked ? "dark" : "light")}
      />

      <div
        className="relative w-7 h-4 bg-gray-300 rounded-full peer dark:bg-gray-200
      peer-checked:bg-black dark:peer-checked:bg-white
      after:content-[''] after:absolute after:top-0.5 after:left-0.5
      after:bg-white dark:after:bg-black
      after:h-3 after:w-3 after:rounded-full
      after:transition-all peer-checked:after:translate-x-full"
      ></div>
    </label>
  );
}
