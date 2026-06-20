import { useCallback, useEffect, useState } from "react";

export type ReadingMode = "app" | "soft-dark" | "warm";
export type ReadingFontSize = "sm" | "md" | "lg";
export type ReadingLineHeight = "normal" | "relaxed";

export type ReadingPrefs = {
  mode: ReadingMode;
  fontSize: ReadingFontSize;
  lineHeight: ReadingLineHeight;
  focusMode: boolean;
};

const STORAGE_KEY = "yizhi-reading-prefs";

const DEFAULT_PREFS: ReadingPrefs = {
  mode: "soft-dark",
  fontSize: "md",
  lineHeight: "relaxed",
  focusMode: false,
};

function loadPrefs(): ReadingPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<ReadingPrefs>;
    return {
      mode: parsed.mode ?? DEFAULT_PREFS.mode,
      fontSize: parsed.fontSize ?? DEFAULT_PREFS.fontSize,
      lineHeight: parsed.lineHeight ?? DEFAULT_PREFS.lineHeight,
      focusMode: parsed.focusMode ?? DEFAULT_PREFS.focusMode,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

function savePrefs(prefs: ReadingPrefs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

const MODE_CYCLE: ReadingMode[] = ["app", "soft-dark", "warm"];

const FONT_SIZES: ReadingFontSize[] = ["sm", "md", "lg"];

export function useReadingPrefs() {
  const [prefs, setPrefsState] = useState<ReadingPrefs>(loadPrefs);

  useEffect(() => {
    savePrefs(prefs);
  }, [prefs]);

  const setPrefs = useCallback((patch: Partial<ReadingPrefs>) => {
    setPrefsState((prev) => ({ ...prev, ...patch }));
  }, []);

  const cycleMode = useCallback(() => {
    setPrefsState((prev) => {
      const idx = MODE_CYCLE.indexOf(prev.mode);
      const next = MODE_CYCLE[(idx + 1) % MODE_CYCLE.length];
      return { ...prev, mode: next };
    });
  }, []);

  const increaseFontSize = useCallback(() => {
    setPrefsState((prev) => {
      const idx = FONT_SIZES.indexOf(prev.fontSize);
      if (idx >= FONT_SIZES.length - 1) return prev;
      return { ...prev, fontSize: FONT_SIZES[idx + 1] };
    });
  }, []);

  const decreaseFontSize = useCallback(() => {
    setPrefsState((prev) => {
      const idx = FONT_SIZES.indexOf(prev.fontSize);
      if (idx <= 0) return prev;
      return { ...prev, fontSize: FONT_SIZES[idx - 1] };
    });
  }, []);

  const toggleLineHeight = useCallback(() => {
    setPrefsState((prev) => ({
      ...prev,
      lineHeight: prev.lineHeight === "normal" ? "relaxed" : "normal",
    }));
  }, []);

  const toggleFocusMode = useCallback(() => {
    setPrefsState((prev) => ({ ...prev, focusMode: !prev.focusMode }));
  }, []);

  return {
    prefs,
    setPrefs,
    cycleMode,
    increaseFontSize,
    decreaseFontSize,
    toggleLineHeight,
    toggleFocusMode,
  };
}

export const READING_MODE_LABELS: Record<ReadingMode, string> = {
  app: "跟随应用",
  "soft-dark": "柔和深色",
  warm: "暖色护眼",
};
