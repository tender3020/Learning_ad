import { useEffect, useLayoutEffect, useRef, useState } from "react";
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
  const exitVelocityRef = useRef(0);
  const animRef = useRef<ReturnType<typeof animate> | null>(null);
  const [shown, setShown] = useState(open);
  onCloseRef.current = onClose;

  if (open && !shown) setShown(true);

  const originX = () => (side === "left" ? -window.innerWidth : window.innerWidth);

  const stopAnim = () => {
    animRef.current?.stop();
    animRef.current = null;
  };

  const slideTo = (target: number, velocity = 0) => {
    stopAnim();
    const playback = animate(x, target, { ...SPRING, velocity });
    animRef.current = playback;
    return playback;
  };

  useLayoutEffect(() => {
    if (!shown) return;

    if (open) {
      closingRef.current = false;
      exitVelocityRef.current = 0;
      if (Math.abs(x.get()) < 8) x.set(originX());
      void slideTo(0);
      return stopAnim;
    }

    closingRef.current = true;
    const offscreen = originX();
    if (Math.abs(x.get() - offscreen) < 16) {
      setShown(false);
      return;
    }
    const velocity = exitVelocityRef.current;
    exitVelocityRef.current = 0;
    let finished = false;
    const finish = () => {
      if (finished || !closingRef.current) return;
      finished = true;
      stopAnim();
      setShown(false);
    };
    void slideTo(offscreen, velocity).then(finish);
    const unsub = x.on("change", (value) => {
      if (Math.abs(value - offscreen) < 24) finish();
    });
    return () => {
      unsub();
      stopAnim();
    };
  }, [open, shown, side, x]);

  useEffect(() => {
    const el = sheetRef.current;
    if (!shown || !open || !el) return;

    let start: Point | null = null;
    let locked: null | "h" | "v" = null;
    let suppressClick = false;
    let swipeFlagTimer = 0;

    const finishClose = (velocity = 0) => {
      if (closingRef.current) return;
      closingRef.current = true;
      exitVelocityRef.current = velocity;
      onCloseRef.current();
    };

    const snapBack = () => {
      void slideTo(0);
    };

    const markHorizontal = () => {
      el.dataset.swiping = "1";
      suppressClick = true;
    };

    const clearSwipeFlag = () => {
      window.clearTimeout(swipeFlagTimer);
      swipeFlagTimer = window.setTimeout(() => {
        delete el.dataset.swiping;
        suppressClick = false;
      }, 320);
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
        if (locked === "h") markHorizontal();
      }

      if (locked !== "h") return;
      if (e.cancelable) e.preventDefault();
      stopAnim();
      x.set(side === "left" ? Math.min(0, dx) : Math.max(0, dx));
    };

    const onEnd = (e: Event) => {
      if (!start) return;
      const wasLocked = locked;
      start = null;
      locked = null;
      if (wasLocked !== "h") return;
      if (e.cancelable) e.preventDefault();
      e.stopPropagation();
      if (closingRef.current) return;
      const current = x.get();
      const threshold = Math.min(72, window.innerWidth * 0.16);
      const velocity = x.getVelocity();
      const passOffset = side === "left" ? current < -threshold : current > threshold;
      const passFlick = side === "left" ? velocity < -500 : velocity > 500;
      if (passOffset || passFlick) finishClose(velocity);
      else {
        snapBack();
        clearSwipeFlag();
      }
    };

    const onClickCapture = (e: MouseEvent) => {
      if (!suppressClick) return;
      e.preventDefault();
      e.stopPropagation();
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
    el.addEventListener("click", onClickCapture, true);

    return () => {
      window.clearTimeout(swipeFlagTimer);
      delete el.dataset.swiping;
      el.removeEventListener("touchstart", touchStart, true);
      el.removeEventListener("touchmove", touchMove, true);
      el.removeEventListener("touchend", onEnd, true);
      el.removeEventListener("touchcancel", onEnd, true);
      el.removeEventListener("pointerdown", pointerStart, true);
      el.removeEventListener("pointermove", pointerMove, true);
      el.removeEventListener("pointerup", onEnd, true);
      el.removeEventListener("pointercancel", onEnd, true);
      el.removeEventListener("click", onClickCapture, true);
    };
  }, [open, shown, side, x]);

  if (!shown) return null;

  return (
    <motion.div
      ref={sheetRef}
      className={className}
      style={{
        x,
        overscrollBehaviorX: "none",
        pointerEvents: open ? undefined : "none",
        ...style,
      }}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
    >
      {children}
    </motion.div>
  );
}
