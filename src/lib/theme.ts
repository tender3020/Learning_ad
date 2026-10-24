import { useEffect } from "react";
import { syncNativeStatusBarStyle } from "@/lib/nativeStatusBar";

export type ThemePref = "dark" | "light" | "system";
export type ResolvedTheme = "dark" | "light";

export const THEME_LABELS: Record<ThemePref, string> = {
  dark: "深色模式",
  light: "浅色模式",
  system: "跟随系统",
};

export function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function resolveTheme(pref: ThemePref): ResolvedTheme {
  return pref === "system" ? getSystemTheme() : pref;
}

export function applyResolvedTheme(theme: ResolvedTheme) {
  if (theme === "light") {
    document.documentElement.classList.add("theme-light");
  } else {
    document.documentElement.classList.remove("theme-light");
  }
  syncNativeStatusBarStyle(theme);
}

export function applyThemePref(pref: ThemePref) {
  applyResolvedTheme(resolveTheme(pref));
}

export function readThemePref(): ThemePref {
  try {
    const raw = localStorage.getItem("yizhi_settings");
    if (raw) {
      const theme = JSON.parse(raw)?.theme;
      if (theme === "light" || theme === "dark" || theme === "system") return theme;
    }
  } catch {
    // ignore
  }
  return "dark";
}

/** 启动时应用主题，并在系统外观变化时同步（仅「跟随系统」） */
export function useThemeSync() {
  useEffect(() => {
    const apply = () => applyThemePref(readThemePref());
    apply();
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const onScheme = () => {
      if (readThemePref() === "system") apply();
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === "yizhi_settings") apply();
    };
    mq.addEventListener("change", onScheme);
    window.addEventListener("storage", onStorage);
    return () => {
      mq.removeEventListener("change", onScheme);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
}
