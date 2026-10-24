import { useEffect, useRef } from "react";
import { motion, useMotionValue, animate } from "framer-motion";

type SwipeCloseSheetProps = {
  open: boolean;
  onClose: () => void;
  /** 菜单：右滑关闭；进度：左滑关闭 */
  closeSwipe: "right" | "left";
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  "aria-label": string;
};

const SPRING = { type: "spring" as const, damping: 32, stiffness: 320 };

/** 全屏页：跟手滑动关闭，不和纵向滚动抢手势 */
export default function SwipeCloseSheet({
  open,
  onClose,
  closeSwipe,
  children,
  className,
  style,
  "aria-label": ariaLabel,
}: SwipeCloseSheetProps) {
  const x = useMotionValue(0);
  const sheetRef = useRef<HTMLDivElement>(null);
  const startRef = useRef<{ x: number; y: number; locked: null | "h" | "v" } | null>(null);
  const closingRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    closingRef.current = false;
    const from = closeSwipe === "right" ? -window.innerWidth : window.innerWidth;
    x.set(from);
    void animate(x, 0, SPRING);
  }, [open, closeSwipe, x]);

  const finishClose = (velocity = 0) => {
    if (closingRef.current) return;
    closingRef.current = true;
    const to = closeSwipe === "right" ? window.innerWidth : -window.innerWidth;
    void animate(x, to, { ...SPRING, velocity }).then(() => onClose());
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    startRef.current = { x: e.clientX, y: e.clientY, locked: null };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const start = startRef.current;
    if (!start || closingRef.current) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (!start.locked) {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      start.locked = Math.abs(dx) > Math.abs(dy) * 1.15 ? "h" : "v";
      if (start.locked === "h") {
        sheetRef.current?.setPointerCapture(e.pointerId);
      }
    }
    if (start.locked !== "h") return;
    if (closeSwipe === "right") {
      x.set(Math.max(0, dx));
    } else {
      x.set(Math.min(0, dx));
    }
  };

  const onPointerUp = () => {
    const start = startRef.current;
    startRef.current = null;
    if (!start || start.locked !== "h" || closingRef.current) return;
    const current = x.get();
    const threshold = Math.min(96, window.innerWidth * 0.22);
    const velocity = x.getVelocity();
    const passOffset = closeSwipe === "right" ? current > threshold : current < -threshold;
    const passFlick = closeSwipe === "right" ? velocity > 700 : velocity < -700;
    if (passOffset || passFlick) {
      finishClose(velocity);
    } else {
      void animate(x, 0, SPRING);
    }
  };

  if (!open) return null;

  return (
    <motion.div
      ref={sheetRef}
      className={className}
      style={{ x, touchAction: "pan-y", ...style }}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {children}
    </motion.div>
  );
}
