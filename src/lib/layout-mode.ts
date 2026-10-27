/** 真·桌面：够宽且够高。手机横屏往往宽>768 但高度不足，应继续走 App 布局。 */
export const YIZHI_DESK_QUERY = "(min-width: 768px) and (min-height: 640px)";

export function applyYizhiDeskClass() {
  if (typeof window === "undefined") return;
  document.documentElement.classList.toggle(
    "yizhi-desk",
    window.matchMedia(YIZHI_DESK_QUERY).matches,
  );
}

export function watchYizhiDeskClass() {
  applyYizhiDeskClass();
  const mq = window.matchMedia(YIZHI_DESK_QUERY);
  const onChange = () => applyYizhiDeskClass();
  mq.addEventListener("change", onChange);
  window.addEventListener("orientationchange", onChange);
  window.addEventListener("resize", onChange);
  return () => {
    mq.removeEventListener("change", onChange);
    window.removeEventListener("orientationchange", onChange);
    window.removeEventListener("resize", onChange);
  };
}
