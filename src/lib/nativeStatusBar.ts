/**
 * App 套壳（Capacitor）环境下同步状态栏样式到当前网页主题。
 * 沉浸式（edge-to-edge）下状态栏透明、透出网页背景色，
 * 因此只需同步图标颜色：深色主题 → 白色图标，浅色主题 → 深色图标。
 * 浏览器环境无 Capacitor 注入，静默跳过。
 */

type NativeStatusBarPlugin = {
  setStyle(options: { style: "DARK" | "LIGHT" }): Promise<void>;
  hide(): Promise<void>;
  show(): Promise<void>;
};

declare global {
  interface Window {
    Capacitor?: {
      Plugins?: {
        StatusBar?: NativeStatusBarPlugin;
      };
    };
  }
}

function getStatusBar(): NativeStatusBarPlugin | undefined {
  try {
    return window.Capacitor?.Plugins?.StatusBar;
  } catch {
    return undefined;
  }
}

export function syncNativeStatusBarStyle(theme: "dark" | "light") {
  const statusBar = getStatusBar();
  if (!statusBar) return;
  void statusBar.setStyle({ style: theme === "light" ? "LIGHT" : "DARK" });
}

/** 沉浸式阅读时隐藏系统状态栏（时间/电量）；退出后恢复。浏览器环境静默跳过。 */
export function setNativeStatusBarVisible(visible: boolean) {
  const statusBar = getStatusBar();
  if (!statusBar) return;
  if (visible) {
    void statusBar.show();
  } else {
    void statusBar.hide();
  }
}
