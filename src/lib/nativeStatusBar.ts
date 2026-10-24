/**
 * App 套壳（Capacitor）环境下同步状态栏样式到当前网页主题。
 * 沉浸式（edge-to-edge）下状态栏透明、透出网页背景色，
 * 因此只需同步图标颜色：深色主题 → 白色图标，浅色主题 → 深色图标。
 * 浏览器环境无 Capacitor 注入，静默跳过。
 */

type NativeStatusBarPlugin = {
  setStyle(options: { style: "DARK" | "LIGHT" }): Promise<void>;
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

export function syncNativeStatusBarStyle(theme: "dark" | "light") {
  try {
    const statusBar = window.Capacitor?.Plugins?.StatusBar;
    if (!statusBar) return;
    void statusBar.setStyle({ style: theme === "light" ? "LIGHT" : "DARK" });
  } catch {
    // 非 App 环境或插件不可用，忽略
  }
}
