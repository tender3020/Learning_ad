export type SavedReadingScroll = {
  scrollTop: number;
  scrollRatio: number;
  contentVersion: string;
  savedAt: number;
};

const STORAGE_PREFIX = "yizhi_reading_scroll";

export function getReadingScrollStorageKey(
  userId: number | undefined,
  planId: number,
  dayNumber: number,
): string {
  return `${STORAGE_PREFIX}:${userId ?? 0}:${planId}:${dayNumber}`;
}

export function loadReadingScrollPosition(key: string): SavedReadingScroll | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SavedReadingScroll>;
    if (typeof parsed.scrollTop !== "number" || typeof parsed.scrollRatio !== "number") {
      return null;
    }
    return {
      scrollTop: parsed.scrollTop,
      scrollRatio: Math.min(1, Math.max(0, parsed.scrollRatio)),
      contentVersion: String(parsed.contentVersion ?? ""),
      savedAt: typeof parsed.savedAt === "number" ? parsed.savedAt : 0,
    };
  } catch {
    return null;
  }
}

export function saveReadingScrollPosition(
  key: string,
  scrollTop: number,
  scrollHeight: number,
  clientHeight: number,
  contentVersion: string,
): void {
  const maxScroll = scrollHeight - clientHeight;
  if (maxScroll <= 0) return;

  const payload: SavedReadingScroll = {
    scrollTop,
    scrollRatio: scrollTop / maxScroll,
    contentVersion,
    savedAt: Date.now(),
  };

  try {
    localStorage.setItem(key, JSON.stringify(payload));
  } catch {
    // quota exceeded etc.
  }
}

export function clearReadingScrollPosition(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export function resolveReadingScrollTop(
  el: HTMLElement,
  saved: SavedReadingScroll,
): number {
  const maxScroll = el.scrollHeight - el.clientHeight;
  if (maxScroll <= 0) return 0;
  const fromRatio = Math.round(saved.scrollRatio * maxScroll);
  return Math.min(maxScroll, Math.max(0, fromRatio));
}
