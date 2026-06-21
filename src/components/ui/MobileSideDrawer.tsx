import { useEffect, useRef, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type MobileSideDrawerProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  side?: "left" | "right";
  variant?: "default" | "reading";
  className?: string;
  /** Hide drawer at this breakpoint and above (matches desktop layout) */
  hideFrom?: "md" | "lg";
  scrollRef?: React.RefObject<HTMLDivElement | null>;
};

export default function MobileSideDrawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  side = "left",
  variant = "default",
  className,
  hideFrom = "lg",
  scrollRef,
}: MobileSideDrawerProps) {
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const internalScrollRef = useRef<HTMLDivElement>(null);
  const contentRef = scrollRef ?? internalScrollRef;
  const hideClass = hideFrom === "md" ? "md:hidden" : "lg:hidden";

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeBtnRef.current?.focus();
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const slideFrom = side === "left" ? "-100%" : "100%";

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={cn(
              "mobile-side-drawer-backdrop",
              hideClass,
              variant === "reading" && "mobile-side-drawer-backdrop--reading",
            )}
            onClick={onClose}
            aria-hidden
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ x: slideFrom }}
            animate={{ x: 0 }}
            exit={{ x: slideFrom }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            className={cn(
              "mobile-side-drawer",
              hideClass,
              side === "right" && "mobile-side-drawer--right",
              variant === "reading" && "mobile-side-drawer--reading",
              className,
            )}
          >
            <div className="mobile-side-drawer__header">
              <div className="min-w-0 flex-1">
                <h2 className="mobile-side-drawer__title">{title}</h2>
                {subtitle && (
                  <p className="mobile-side-drawer__subtitle truncate">{subtitle}</p>
                )}
              </div>
              <button
                ref={closeBtnRef}
                type="button"
                className="mobile-side-drawer__close"
                onClick={onClose}
                aria-label="关闭"
              >
                <X size={18} />
              </button>
            </div>
            <div ref={contentRef} className="mobile-side-drawer__body">
              {children}
            </div>
            {footer && <div className="mobile-side-drawer__footer">{footer}</div>}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
