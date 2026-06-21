import { type RefObject } from "react";
import { CheckCircle, Play, Lock, ChevronLeft } from "lucide-react";

export type OutlineDayItem = {
  dayNumber: number;
  title: string;
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

export default function StudyDayOutline({
  outline,
  currentDay,
  onSelectDay,
  activeItemRef,
  compact = false,
}: StudyDayOutlineProps) {
  const py = compact ? "py-2.5" : "py-2.5";

  return (
    <div className="space-y-1 p-2">
      {outline.map((item) => {
        const isActive = item.dayNumber === currentDay;
        const isCompleted = item.dayNumber < currentDay;
        return (
          <button
            key={item.dayNumber}
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
      })}
    </div>
  );
}
