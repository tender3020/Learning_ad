/**
 * App 套壳里关掉系统长按文本菜单（复制 / 全选 / 分享）。
 * 浏览器没有注入接口时静默跳过。
 */

declare global {
  interface Window {
    YizhiNative?: {
      setTextMenuEnabled?: (enabled: boolean) => void;
    };
  }
}

export function setNativeTextMenuEnabled(enabled: boolean) {
  try {
    window.YizhiNative?.setTextMenuEnabled?.(enabled);
  } catch {
    /* 浏览器或旧 APK */
  }
  if (!enabled) {
    try {
      window.getSelection()?.removeAllRanges();
    } catch {
      /* ignore */
    }
  }
}
