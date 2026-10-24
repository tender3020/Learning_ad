import { useEffect } from "react";

/**
 * 把 visualViewport 写成 CSS 变量，避免 App 里弹出键盘时
 * 页面被顶上去和状态栏重叠。
 */
export function useVisualViewportCss() {
  useEffect(() => {
    const root = document.documentElement;
    const vv = window.visualViewport;

    const apply = () => {
      const top = vv?.offsetTop ?? 0;
      const left = vv?.offsetLeft ?? 0;
      const width = vv?.width ?? window.innerWidth;
      const height = vv?.height ?? window.innerHeight;
      root.style.setProperty("--vv-top", `${Math.max(0, top)}px`);
      root.style.setProperty("--vv-left", `${Math.max(0, left)}px`);
      root.style.setProperty("--vv-width", `${width}px`);
      root.style.setProperty("--vv-height", `${height}px`);

      const keyboardOpen = height < window.innerHeight - 80 || top > 8;
      root.classList.toggle("keyboard-open", keyboardOpen);
    };

    apply();
    vv?.addEventListener("resize", apply);
    vv?.addEventListener("scroll", apply);
    window.addEventListener("resize", apply);
    return () => {
      vv?.removeEventListener("resize", apply);
      vv?.removeEventListener("scroll", apply);
      window.removeEventListener("resize", apply);
      root.classList.remove("keyboard-open");
    };
  }, []);
}
