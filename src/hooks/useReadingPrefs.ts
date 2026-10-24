import { useCallback, useEffect, useState } from "react";

export type ReadingMode = "app" | "soft-dark" | "warm";
export type ReadingFontSize = "xs" | "sm" | "md" | "lg" | "xl";
export type ReadingLineHeight = "tight" | "normal" | "relaxed";
export type ReadingFontFamily = "system" | "song" | "hei" | "kai" | "yuan";

export type ReadingPrefs = {
  mode: ReadingMode;
  fontSize: ReadingFontSize;
  lineHeight: ReadingLineHeight;
  fontFamily: ReadingFontFamily;
  focusMode: boolean;
};

const STORAGE_KEY = "yizhi-reading-prefs";

const DEFAULT_PREFS: ReadingPrefs = {
  mode: "soft-dark",
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

export const READING_FONT_LABELS: Record<ReadingFontFamily, string> = {
  system: "系统",
  song: "宋体",
  hei: "黑体",
  kai: "楷体",
  yuan: "圆体",
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
    const fontFamily = parsed.fontFamily && parsed.fontFamily in READING_FONT_LABELS
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

  useEffect(() => {
    savePrefs(prefs);
  }, [prefs]);

  const setPrefs = useCallback((patch: Partial<ReadingPrefs>) => {
    setPrefsState((prev) => ({ ...prev, ...patch }));
  }, []);

  return { prefs, setPrefs };
}
