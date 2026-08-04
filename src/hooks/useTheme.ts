import { useEffect, useState } from "react";

const THEME_KEY = "tactica11.theme";
type Theme = "dark" | "light";

function prefersLight() {
  return window.matchMedia?.("(prefers-color-scheme: light)").matches ?? false;
}

// Dark is the app's original, default look. The stored preference (if any)
// wins; otherwise fall back to the OS setting.
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "dark" || saved === "light") return saved;
    return prefersLight() ? "light" : "dark";
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const toggleTheme = () => {
    setTheme((t) => {
      const next = t === "dark" ? "light" : "dark";
      try {
        localStorage.setItem(THEME_KEY, next);
      } catch {
        // storage unavailable — theme just resets to the OS default next load
      }
      return next;
    });
  };

  return { theme, toggleTheme };
}
