import { type RefObject, useMemo, useState } from "react";
import { CheckCircle, Play, Lock, ChevronLeft, ChevronDown, ChevronRight } from "lucide-react";

export type OutlineDayItem = {
  dayNumber: number;
  title: string;
  phaseName?: string | null;
  phaseOrder?: number | null;
};

type StudyDayOutlineProps = {
  outline: OutlineDayItem[];
  currentDay: number;
  totalDays: number;
  onSelectDay: (day: number) => void;
  activeItemRef?: RefObject<HTMLButtonElement | null>;
  compact?: boolean;
};

export function StudyDayOutlineNav({
  currentDay,
  totalDays,
  onSelectDay,
}: Pick<StudyDayOutlineProps, "currentDay" | "totalDays" | "onSelectDay">) {
  return (
    <div className="flex items-center justify-between w-full">
      <button
        type="button"
        onClick={() => onSelectDay(currentDay - 1)}
        disabled={currentDay <= 1}
        className="p-2 rounded-lg hover-surface disabled:opacity-30 transition-all"
        aria-label="上一日"
      >
        <ChevronLeft size={18} />
      </button>
      <span className="type-body text-token-secondary">
        {currentDay} / {totalDays}
      </span>
      <button
        type="button"
        onClick={() => onSelectDay(currentDay + 1)}
        disabled={currentDay >= totalDays}
        className="p-2 rounded-lg hover-surface disabled:opacity-30 transition-all"
        aria-label="下一日"
      >
        <ChevronRight size={18} />
      </button>
    </div>
  );
}

function DayRow({
  item,
  currentDay,
  onSelectDay,
  activeItemRef,
  compact,
}: {
  item: OutlineDayItem;
  currentDay: number;
  onSelectDay: (day: number) => void;
  activeItemRef?: RefObject<HTMLButtonElement | null>;
  compact?: boolean;
}) {
  const py = compact ? "py-2.5" : "py-2.5";
  const isActive = item.dayNumber === currentDay;
  const isCompleted = item.dayNumber < currentDay;
  const phaseOrder = Math.min(Math.max(item.phaseOrder || 1, 1), 6);

  return (
    <button
      ref={isActive ? activeItemRef : undefined}
      type="button"
      onClick={() => onSelectDay(item.dayNumber)}
      className={`w-full flex items-center gap-3 px-3 ${py} rounded-xl text-left transition-all border border-transparent relative ${
        isActive ? "bg-token-brand-muted" : "hover-surface"
      }`}
    >
      {isActive && (
        <span
          className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full"
          style={{ backgroundColor: `var(--phase-${phaseOrder})` }}
        />
      )}
      <div
        className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
          isCompleted
            ? "bg-[color-mix(in_srgb,var(--color-success)_20%,transparent)]"
            : isActive
              ? "bg-token-brand-muted"
              : "bg-[var(--surface-hover)]"
        }`}
      >
        {isCompleted ? (
          <CheckCircle size={14} style={{ color: "var(--color-success)" }} />
        ) : isActive ? (
          <Play size={12} className="text-token-brand" />
        ) : (
          <Lock size={12} className="text-token-secondary" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`type-body font-medium truncate ${isActive ? "text-token-primary" : "text-token-secondary"}`}>
          D{item.dayNumber}: {item.title}
        </p>
      </div>
    </button>
  );
}

export default function StudyDayOutline({
  outline,
  currentDay,
  onSelectDay,
  activeItemRef,
  compact = false,
}: StudyDayOutlineProps) {
  const [collapsedPhases, setCollapsedPhases] = useState<Set<string>>(new Set());

  const groups = useMemo(() => {
    const map = new Map<string, { phaseName: string; phaseOrder: number; items: OutlineDayItem[] }>();
    for (const item of outline) {
      const phaseName = item.phaseName?.trim() || "学习阶段";
      const phaseOrder = item.phaseOrder ?? 0;
      const key = `${phaseOrder}-${phaseName}`;
      if (!map.has(key)) {
        map.set(key, { phaseName, phaseOrder, items: [] });
      }
      map.get(key)!.items.push(item);
    }
    return Array.from(map.values()).sort((a, b) => a.phaseOrder - b.phaseOrder);
  }, [outline]);

  const hasPhases = groups.length > 1 || (groups[0]?.phaseName !== "学习阶段");

  const togglePhase = (key: string) => {
    setCollapsedPhases((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  if (!hasPhases) {
    return (
      <div className="space-y-1 p-2">
        {outline.map((item) => (
          <DayRow
            key={item.dayNumber}
            item={item}
            currentDay={currentDay}
            onSelectDay={onSelectDay}
            activeItemRef={activeItemRef}
            compact={compact}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2 p-2">
      {groups.map((group) => {
        const key = `${group.phaseOrder}-${group.phaseName}`;
        const isCollapsed = collapsedPhases.has(key);
        const containsActive = group.items.some((i) => i.dayNumber === currentDay);

        return (
          <div key={key} className="rounded-xl border border-token-surface overflow-hidden">
            <button
              type="button"
              onClick={() => togglePhase(key)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-left type-caption font-medium transition-colors ${
                containsActive
                  ? "bg-token-brand-muted text-token-brand-light"
                  : "text-token-secondary hover:text-token-primary"
              }`}
            >
              {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
              <span className="truncate">{group.phaseName}</span>
              <span className="ml-auto type-caption opacity-70">{group.items.length} 天</span>
            </button>
            {!isCollapsed && (
              <div className="space-y-1 p-1 pt-0">
                {group.items.map((item) => (
                  <DayRow
                    key={item.dayNumber}
                    item={item}
                    currentDay={currentDay}
                    onSelectDay={onSelectDay}
                    activeItemRef={activeItemRef}
                    compact={compact}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
