import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

type Theme = "light" | "dark" | "system";
export type AccentColor = "blue" | "indigo" | "violet" | "cyan" | "emerald" | "amber" | "rose" | "black";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  accentColor: AccentColor;
  setAccentColor: (color: AccentColor) => void;
  resolvedTheme: "light" | "dark";
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const accentOklch: Record<AccentColor, { light: string; dark: string }> = {
  blue:    { light: "oklch(0.55 0.24 265)", dark: "oklch(0.65 0.24 265)" },
  indigo:  { light: "oklch(0.50 0.24 285)", dark: "oklch(0.60 0.24 285)" },
  violet:  { light: "oklch(0.52 0.24 300)", dark: "oklch(0.62 0.24 300)" },
  cyan:    { light: "oklch(0.60 0.16 200)", dark: "oklch(0.70 0.16 200)" },
  emerald: { light: "oklch(0.55 0.18 160)", dark: "oklch(0.65 0.18 160)" },
  amber:   { light: "oklch(0.65 0.18 85)",  dark: "oklch(0.75 0.18 85)" },
  rose:    { light: "oklch(0.55 0.22 15)",  dark: "oklch(0.65 0.22 15)" },
  black:   { light: "oklch(0.20 0 0)",     dark: "oklch(0.85 0 0)" },
};

function applyAccentColor(color: AccentColor, isDark: boolean) {
  const root = document.documentElement;
  const oklch = isDark ? accentOklch[color].dark : accentOklch[color].light;
  const fg = isDark ? "oklch(0.15 0.02 265)" : "oklch(0.99 0 0)";
  root.style.setProperty("--primary", oklch);
  root.style.setProperty("--primary-foreground", fg);
  root.style.setProperty("--ring", oklch);
  root.style.setProperty("--sidebar-primary", oklch);
  root.style.setProperty("--sidebar-primary-foreground", fg);
}

function applyTheme(theme: Theme): "light" | "dark" {
  const root = document.documentElement;
  if (theme === "system") {
    const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    root.classList.toggle("dark", isDark);
    return isDark ? "dark" : "light";
  }
  root.classList.toggle("dark", theme === "dark");
  return theme;
}

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  return (localStorage.getItem("theme") as Theme) || "dark";
}

function getInitialAccent(): AccentColor {
  if (typeof window === "undefined") return "blue";
  return (localStorage.getItem("accent-color") as AccentColor) || "blue";
}

function getResolvedTheme(theme: Theme): "light" | "dark" {
  if (typeof window === "undefined") return "dark";
  if (theme === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return theme;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);
  const [accentColor, setAccentColorState] = useState<AccentColor>(getInitialAccent);
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">(() => getResolvedTheme(getInitialTheme()));

  // Sync accent color on mount and listen for system theme changes
  useEffect(() => {
    const savedAccent = (localStorage.getItem("accent-color") as AccentColor) || "blue";
    applyAccentColor(savedAccent, resolvedTheme === "dark");

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      if (localStorage.getItem("theme") === "system") {
        const r = applyTheme("system");
        setResolvedTheme(r);
        const accent = (localStorage.getItem("accent-color") as AccentColor) || "blue";
        applyAccentColor(accent, r === "dark");
      }
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    localStorage.setItem("theme", t);
    const resolved = applyTheme(t);
    setResolvedTheme(resolved);
    applyAccentColor(accentColor, resolved === "dark");
  }, [accentColor]);

  const setAccentColor = useCallback((c: AccentColor) => {
    setAccentColorState(c);
    localStorage.setItem("accent-color", c);
    applyAccentColor(c, document.documentElement.classList.contains("dark"));
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, accentColor, setAccentColor, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
