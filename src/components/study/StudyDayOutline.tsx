import { type RefObject, useMemo } from "react";
import { CheckCircle, Play, Lock, ChevronLeft, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";

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
        className="p-2 rounded-lg hover:bg-[rgba(255,255,255,0.05)] disabled:opacity-30 transition-all"
        aria-label="上一日"
      >
        <ChevronLeft size={18} />
      </button>
      <span className="text-sm text-[#8A8A8E]">
        {currentDay} / {totalDays}
      </span>
      <button
        type="button"
        onClick={() => onSelectDay(currentDay + 1)}
        disabled={currentDay >= totalDays}
        className="p-2 rounded-lg hover:bg-[rgba(255,255,255,0.05)] disabled:opacity-30 transition-all"
        aria-label="下一日"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <polyline points="9 18 15 12 9 6" />
        </svg>
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

  return (
    <button
      ref={isActive ? activeItemRef : undefined}
      type="button"
      onClick={() => onSelectDay(item.dayNumber)}
      className={`w-full flex items-center gap-3 px-3 ${py} rounded-xl text-left transition-all ${
        isActive
          ? "bg-[rgba(110,86,207,0.15)] border border-[rgba(110,86,207,0.3)]"
          : "hover:bg-[rgba(255,255,255,0.03)] border border-transparent"
      }`}
    >
      <div
        className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
          isCompleted
            ? "bg-[rgba(52,199,89,0.2)]"
            : isActive
              ? "bg-[rgba(110,86,207,0.2)]"
              : "bg-[rgba(255,255,255,0.05)]"
        }`}
      >
        {isCompleted ? (
          <CheckCircle size={14} className="text-[#34C759]" />
        ) : isActive ? (
          <Play size={12} className="text-[#6E56CF]" />
        ) : (
          <Lock size={12} className="text-[#8A8A8E]" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p
          className={`text-sm font-medium truncate ${isActive ? "text-[#F5F5F7]" : "text-[#8A8A8E]"}`}
        >
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
          <div key={key} className="rounded-xl border border-[rgba(255,255,255,0.06)] overflow-hidden">
            <button
              type="button"
              onClick={() => togglePhase(key)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-left text-xs font-medium transition-colors ${
                containsActive
                  ? "bg-[rgba(110,86,207,0.12)] text-[#A78BFA]"
                  : "bg-[rgba(255,255,255,0.02)] text-[#8A8A8E] hover:text-[#F5F5F7]"
              }`}
            >
              {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
              <span className="truncate">{group.phaseName}</span>
              <span className="ml-auto text-[10px] opacity-70">{group.items.length} 天</span>
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
