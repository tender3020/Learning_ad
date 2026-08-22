import { useCallback, useEffect, useRef, type RefObject } from "react";
import {
  clearReadingScrollPosition,
  getReadingScrollStorageKey,
  loadReadingScrollPosition,
  resolveReadingScrollTop,
  saveReadingScrollPosition,
} from "@/lib/readingScrollPosition";

type UseReadingScrollPersistenceOptions = {
  scrollRef: RefObject<HTMLElement | null>;
  planId: number | null | undefined;
  dayNumber: number;
  userId: number | undefined;
  content: string;
  contentVersion: string;
  enabled: boolean;
};

const SAVE_DEBOUNCE_MS = 280;

export function useReadingScrollPersistence({
  scrollRef,
  planId,
  dayNumber,
  userId,
  content,
  contentVersion,
  enabled,
}: UseReadingScrollPersistenceOptions) {
  const restoredKeyRef = useRef<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentVersionRef = useRef(contentVersion);
  contentVersionRef.current = contentVersion;

  const storageKey =
    planId != null
      ? getReadingScrollStorageKey(userId, planId, dayNumber)
      : null;

  const persistNow = useCallback(() => {
    if (!storageKey || !scrollRef.current || !content.trim()) return;
    const el = scrollRef.current;
    saveReadingScrollPosition(
      storageKey,
      el.scrollTop,
      el.scrollHeight,
      el.clientHeight,
      contentVersionRef.current,
    );
  }, [content, scrollRef, storageKey]);

  const clearSaved = useCallback(() => {
    if (!storageKey) return;
    clearReadingScrollPosition(storageKey);
    restoredKeyRef.current = null;
  }, [storageKey]);

  // 恢复上次阅读位置
  useEffect(() => {
    if (!enabled || !storageKey || !content.trim()) return;

    const restoreKey = `${storageKey}:${contentVersion}`;
    if (restoredKeyRef.current === restoreKey) return;

    const saved = loadReadingScrollPosition(storageKey);
    if (!saved || saved.contentVersion !== contentVersion || saved.scrollRatio <= 0) {
      restoredKeyRef.current = restoreKey;
      return;
    }

    const apply = () => {
      const el = scrollRef.current;
      if (!el) return;
      el.scrollTop = resolveReadingScrollTop(el, saved);
    };

    requestAnimationFrame(() => {
      requestAnimationFrame(apply);
    });
    const retryShort = window.setTimeout(apply, 150);
    const retryLong = window.setTimeout(apply, 700);

    restoredKeyRef.current = restoreKey;
    return () => {
      window.clearTimeout(retryShort);
      window.clearTimeout(retryLong);
    };
  }, [enabled, storageKey, content, contentVersion, scrollRef]);

  // 滚动时防抖保存
  useEffect(() => {
    if (!enabled || !storageKey) return;
    const el = scrollRef.current;
    if (!el) return;

    const onScroll = () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        persistNow();
      }, SAVE_DEBOUNCE_MS);
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [enabled, storageKey, scrollRef, persistNow]);

  // 离开页面 / 切后台时立即保存
  useEffect(() => {
    if (!enabled || !storageKey) return;

    const saveOnHide = () => persistNow();
    window.addEventListener("pagehide", saveOnHide);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") saveOnHide();
    });

    return () => {
      window.removeEventListener("pagehide", saveOnHide);
      persistNow();
    };
  }, [enabled, storageKey, persistNow]);

  // 切换天数前保存当前位置
  useEffect(() => {
    return () => {
      persistNow();
    };
  }, [dayNumber, planId, persistNow]);

  return { clearSaved, persistNow };
}
