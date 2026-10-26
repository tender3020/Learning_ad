import { useCallback, useEffect, useState } from "react";
import {
  READING_FONT_LABELS,
  ensureReadingFont,
  isReadingFontId,
  needsWebFont,
  type ReadingFontFamily,
} from "@/lib/reading-fonts";

export type ReadingMode = "app" | "soft-dark" | "warm";
export type ReadingFontSize = "xs" | "sm" | "md" | "lg" | "xl";
export type ReadingLineHeight = "tight" | "normal" | "relaxed";
export type { ReadingFontFamily };
export { READING_FONT_LABELS };

export type ReadingPrefs = {
  mode: ReadingMode;
  fontSize: ReadingFontSize;
  lineHeight: ReadingLineHeight;
  fontFamily: ReadingFontFamily;
  focusMode: boolean;
};

const STORAGE_KEY = "yizhi-reading-prefs";

const DEFAULT_PREFS: ReadingPrefs = {
  mode: "app",
  fontSize: "md",
  lineHeight: "relaxed",
  fontFamily: "system",
  focusMode: true,
};

export const FONT_SIZES: ReadingFontSize[] = ["xs", "sm", "md", "lg", "xl"];

export const READING_MODE_LABELS: Record<ReadingMode, string> = {
  app: "跟随应用",
  "soft-dark": "柔和深色",
  warm: "暖色护眼",
};

export const READING_LEADING_LABELS: Record<ReadingLineHeight, string> = {
  tight: "紧凑",
  normal: "标准",
  relaxed: "宽松",
};

function loadPrefs(): ReadingPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<ReadingPrefs>;
    const fontSize = FONT_SIZES.includes(parsed.fontSize as ReadingFontSize)
      ? (parsed.fontSize as ReadingFontSize)
      : DEFAULT_PREFS.fontSize;
    const lineHeight =
      parsed.lineHeight === "tight" || parsed.lineHeight === "normal" || parsed.lineHeight === "relaxed"
        ? parsed.lineHeight
        : DEFAULT_PREFS.lineHeight;
    const fontFamily = isReadingFontId(parsed.fontFamily)
      ? parsed.fontFamily
      : DEFAULT_PREFS.fontFamily;
    return {
      mode: parsed.mode ?? DEFAULT_PREFS.mode,
      fontSize,
      lineHeight,
      fontFamily,
      focusMode: parsed.focusMode ?? DEFAULT_PREFS.focusMode,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

function savePrefs(prefs: ReadingPrefs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

export function useReadingPrefs() {
  const [prefs, setPrefsState] = useState<ReadingPrefs>(loadPrefs);
  const [fontLoading, setFontLoading] = useState<ReadingFontFamily | null>(null);

  useEffect(() => {
    savePrefs(prefs);
  }, [prefs]);

  useEffect(() => {
    if (!needsWebFont(prefs.fontFamily)) return;
    let cancelled = false;
    setFontLoading(prefs.fontFamily);
    void ensureReadingFont(prefs.fontFamily)
      .catch((error) => {
        console.warn("[reading-fonts]", error);
      })
      .finally(() => {
        if (!cancelled) setFontLoading(null);
      });
    return () => {
      cancelled = true;
    };
  }, [prefs.fontFamily]);

  const setPrefs = useCallback((patch: Partial<ReadingPrefs>) => {
    setPrefsState((prev) => ({ ...prev, ...patch }));
  }, []);

  const setFontFamily = useCallback(async (fontFamily: ReadingFontFamily) => {
    if (needsWebFont(fontFamily)) {
      setFontLoading(fontFamily);
      try {
        await ensureReadingFont(fontFamily);
      } catch (error) {
        setFontLoading(null);
        throw error instanceof Error ? error : new Error("字体下载失败");
      }
    }
    setPrefsState((prev) => ({ ...prev, fontFamily }));
    setFontLoading(null);
  }, []);

  return { prefs, setPrefs, setFontFamily, fontLoading };
}
