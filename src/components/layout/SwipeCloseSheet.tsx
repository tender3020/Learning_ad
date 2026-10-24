import { useEffect, useRef } from "react";
import { motion, useMotionValue, animate } from "framer-motion";

type SwipeCloseSheetProps = {
  open: boolean;
  onClose: () => void;
  /** 抽屉从哪边滑入：菜单 left，进度 right。关闭时往同一边滑回去。 */
  side: "left" | "right";
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  "aria-label": string;
};

const SPRING = { type: "spring" as const, damping: 32, stiffness: 320 };

type Point = { x: number; y: number };

function pointFromEvent(e: TouchEvent | PointerEvent): Point | null {
  if ("changedTouches" in e) {
    const t = e.touches[0] ?? e.changedTouches[0];
    return t ? { x: t.clientX, y: t.clientY } : null;
  }
  return { x: e.clientX, y: e.clientY };
}

/** 全屏抽屉跟手关闭。用捕获阶段的原生触摸，避免列表上下滑把手势吃掉。 */
export default function SwipeCloseSheet({
  open,
  onClose,
  side,
  children,
  className,
  style,
  "aria-label": ariaLabel,
}: SwipeCloseSheetProps) {
  const x = useMotionValue(0);
  const sheetRef = useRef<HTMLDivElement>(null);
  const closingRef = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const originX = () => (side === "left" ? -window.innerWidth : window.innerWidth);

  useEffect(() => {
    if (!open) return;
    closingRef.current = false;
    x.set(originX());
    void animate(x, 0, SPRING);
  }, [open, side, x]);

  useEffect(() => {
    const el = sheetRef.current;
    if (!open || !el) return;

    let start: Point | null = null;
    let locked: null | "h" | "v" = null;

    const finishClose = (velocity = 0) => {
      if (closingRef.current) return;
      closingRef.current = true;
      void animate(x, originX(), { ...SPRING, velocity }).then(() => onCloseRef.current());
    };

    const snapBack = () => {
      void animate(x, 0, SPRING);
    };

    const onStart = (e: TouchEvent | PointerEvent) => {
      if ("pointerType" in e && e.pointerType !== "mouse" && e.pointerType !== "touch" && e.pointerType !== "pen") {
        return;
      }
      if ("button" in e && e.button !== 0) return;
      const p = pointFromEvent(e);
      if (!p) return;
      start = p;
      locked = null;
    };

    const onMove = (e: TouchEvent | PointerEvent) => {
      if (!start || closingRef.current) return;
      const p = pointFromEvent(e);
      if (!p) return;
      const dx = p.x - start.x;
      const dy = p.y - start.y;

      if (!locked) {
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
        const towardClose = side === "left" ? dx < -2 : dx > 2;
        if (towardClose && Math.abs(dx) >= Math.abs(dy) * 0.85) {
          locked = "h";
        } else if (Math.abs(dy) > Math.abs(dx)) {
          locked = "v";
        } else if (towardClose) {
          locked = "h";
        } else {
          locked = "v";
        }
      }

      if (locked !== "h") return;
      if (e.cancelable) e.preventDefault();
      x.set(side === "left" ? Math.min(0, dx) : Math.max(0, dx));
    };

    const onEnd = () => {
      if (!start) return;
      const wasLocked = locked;
      start = null;
      locked = null;
      if (wasLocked !== "h" || closingRef.current) return;
      const current = x.get();
      const threshold = Math.min(72, window.innerWidth * 0.16);
      const velocity = x.getVelocity();
      const passOffset = side === "left" ? current < -threshold : current > threshold;
      const passFlick = side === "left" ? velocity < -500 : velocity > 500;
      if (passOffset || passFlick) finishClose(velocity);
      else snapBack();
    };

    const touchStart = (e: TouchEvent) => onStart(e);
    const touchMove = (e: TouchEvent) => onMove(e);
    const pointerStart = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      onStart(e);
    };
    const pointerMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      onMove(e);
    };

    el.addEventListener("touchstart", touchStart, { capture: true, passive: true });
    el.addEventListener("touchmove", touchMove, { capture: true, passive: false });
    el.addEventListener("touchend", onEnd, { capture: true });
    el.addEventListener("touchcancel", onEnd, { capture: true });
    el.addEventListener("pointerdown", pointerStart, { capture: true });
    el.addEventListener("pointermove", pointerMove, { capture: true });
    el.addEventListener("pointerup", onEnd, { capture: true });
    el.addEventListener("pointercancel", onEnd, { capture: true });

    return () => {
      el.removeEventListener("touchstart", touchStart, true);
      el.removeEventListener("touchmove", touchMove, true);
      el.removeEventListener("touchend", onEnd, true);
      el.removeEventListener("touchcancel", onEnd, true);
      el.removeEventListener("pointerdown", pointerStart, true);
      el.removeEventListener("pointermove", pointerMove, true);
      el.removeEventListener("pointerup", onEnd, true);
      el.removeEventListener("pointercancel", onEnd, true);
    };
  }, [open, side, x]);

  if (!open) return null;

  return (
    <motion.div
      ref={sheetRef}
      className={className}
      style={{ x, overscrollBehaviorX: "none", ...style }}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
    >
      {children}
    </motion.div>
  );
}
