import { useRef } from "react";
import { Play, BookOpen, CheckCircle2, Pin, Check } from "lucide-react";
import { TYPE_LABELS } from "@shared/typeEngine";
import { setNativeTextMenuEnabled } from "@/lib/nativeTextMenu";

interface PlanItemProps {
  plan: {
    id: number;
    goal: string;
    currentDay: number;
    totalDays: number;
    status: string;
    learningType?: string;
  };
  isCurrent: boolean;
  onSelect: () => void;
  onLongPress: (pos: { x: number; y: number }) => void;
  isPinned?: boolean;
  selectMode?: boolean;
  selected?: boolean;
}

/** 计划卡片：点击切换，长按打开 多选 / 置顶 / 删除 */
export default function PlanItem({
  plan,
  isCurrent,
  onSelect,
  onLongPress,
  isPinned,
  selectMode,
  selected,
}: PlanItemProps) {
  const timerRef = useRef<number | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const longPressed = useRef(false);
  const moved = useRef(false);

  const clearTimer = () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const resetGesture = () => {
    clearTimer();
    startRef.current = null;
    moved.current = false;
  };

  const fireLongPress = (x: number, y: number) => {
    longPressed.current = true;
    setNativeTextMenuEnabled(false);
    onLongPress({ x, y });
  };

  const onPointerDown = (e: React.PointerEvent) => {
    longPressed.current = false;
    moved.current = false;
    startRef.current = { x: e.clientX, y: e.clientY };
    if (selectMode) return;
    setNativeTextMenuEnabled(false);
    timerRef.current = window.setTimeout(() => {
      const start = startRef.current;
      fireLongPress(start?.x ?? e.clientX, start?.y ?? e.clientY);
    }, 480);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const start = startRef.current;
    if (!start) return;
    if (Math.abs(e.clientX - start.x) > 8 || Math.abs(e.clientY - start.y) > 8) {
      moved.current = true;
      clearTimer();
    }
  };

  const onPointerUp = () => {
    const wasLong = longPressed.current;
    const didMove = moved.current;
    const hadStart = !!startRef.current;
    resetGesture();
    if (!wasLong) setNativeTextMenuEnabled(true);
    // 滑动关闭/列表滚动时手指会落到另一张卡片上，不能当成点击
    if (hadStart && !wasLong && !didMove) onSelect();
  };

  const planProgress = plan.totalDays > 0 ? Math.round((plan.currentDay / plan.totalDays) * 100) : 0;

  return (
    <button
      type="button"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        const wasLong = longPressed.current;
        resetGesture();
        if (!wasLong) setNativeTextMenuEnabled(true);
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        if (selectMode) return;
        fireLongPress(e.clientX, e.clientY);
      }}
      onSelectStart={(e) => e.preventDefault()}
      className={`plan-item-card w-full text-left liquid-glass rounded-xl p-3 md:p-4 transition-all select-none ${
        isCurrent
          ? "border border-[color-mix(in_srgb,var(--brand-primary)_35%,transparent)]"
          : "border border-transparent hover:border-token-surface"
      }`}
      style={{ touchAction: "manipulation" }}
    >
      <div className="flex items-center gap-3">
        {selectMode ? (
          <span
            className="w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0"
            style={{
              borderColor: selected ? "var(--brand-primary)" : "var(--surface-border-strong)",
              backgroundColor: selected ? "var(--brand-primary)" : "transparent",
            }}
          >
            {selected && <Check size={12} className="text-[var(--brand-foreground)]" />}
          </span>
        ) : (
          <div
            className={`w-9 h-9 md:w-10 md:h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
              isCurrent
                ? "bg-token-brand-muted"
                : plan.status === "completed"
                  ? "bg-[color-mix(in_srgb,var(--color-success)_12%,transparent)]"
                  : "bg-[var(--surface-hover)]"
            }`}
          >
            {isCurrent ? (
              <Play size={16} className="text-token-brand" />
            ) : plan.status === "completed" ? (
              <CheckCircle2 size={16} style={{ color: "var(--color-success)" }} />
            ) : (
              <BookOpen size={16} className="text-token-secondary" />
            )}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className={`text-sm font-medium truncate ${isCurrent ? "text-token-brand-light" : "text-token-primary"}`}>
              {plan.goal}
            </p>
            {isPinned && <Pin size={12} className="text-token-secondary flex-shrink-0" />}
            {isCurrent && (
              <span className="type-caption px-1.5 py-0.5 rounded-full bg-token-brand-muted text-token-brand-light flex-shrink-0">
                当前
              </span>
            )}
          </div>
          <p className="type-caption text-token-secondary">
            第 {plan.currentDay}/{plan.totalDays} 天 · {planProgress}%
            {plan.learningType && TYPE_LABELS[plan.learningType as keyof typeof TYPE_LABELS]
              ? ` · ${TYPE_LABELS[plan.learningType as keyof typeof TYPE_LABELS].name}`
              : ""}
          </p>
        </div>
      </div>
      <div className="mt-2 h-1 rounded-full overflow-hidden" style={{ backgroundColor: "var(--surface-border)" }}>
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${planProgress}%`,
            background: isCurrent
              ? "linear-gradient(90deg, var(--brand-primary), var(--brand-secondary))"
              : "#8A8A8E",
          }}
        />
      </div>
    </button>
  );
}
