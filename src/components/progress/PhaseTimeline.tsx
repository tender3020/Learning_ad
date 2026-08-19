type OutlinePhaseItem = {
  dayNumber: number;
  title: string;
  phaseName?: string | null;
  phaseOrder?: number | null;
};

type PhaseTimelineProps = {
  outline: OutlinePhaseItem[];
  currentDay: number;
};

const PHASE_DOT: Record<number, string> = {
  1: "var(--phase-1)",
  2: "var(--phase-2)",
  3: "var(--phase-3)",
  4: "var(--phase-4)",
  5: "var(--phase-5)",
  6: "var(--phase-6)",
};

export default function PhaseTimeline({ outline, currentDay }: PhaseTimelineProps) {
  const groups = outline.reduce<
    Array<{ phaseName: string; phaseOrder: number; startDay: number; endDay: number; days: OutlinePhaseItem[] }>
  >((acc, item) => {
    const phaseName = item.phaseName?.trim() || "学习阶段";
    const phaseOrder = item.phaseOrder ?? 0;
    const existing = acc.find((g) => g.phaseName === phaseName && g.phaseOrder === phaseOrder);
    if (existing) {
      existing.days.push(item);
      existing.endDay = Math.max(existing.endDay, item.dayNumber);
    } else {
      acc.push({
        phaseName,
        phaseOrder,
        startDay: item.dayNumber,
        endDay: item.dayNumber,
        days: [item],
      });
    }
    return acc;
  }, []).sort((a, b) => a.phaseOrder - b.phaseOrder);

  if (groups.length === 0) return null;

  return (
    <div className="phase-timeline overflow-x-auto pb-2">
      <div className="flex gap-3 min-w-max px-1">
        {groups.map((group) => {
          const isCurrent = currentDay >= group.startDay && currentDay <= group.endDay;
          const isPast = currentDay > group.endDay;
          const dotColor = PHASE_DOT[Math.min(group.phaseOrder || 1, 6)] || PHASE_DOT[1];

          return (
            <div
              key={`${group.phaseOrder}-${group.phaseName}`}
              className={`flex-shrink-0 w-40 md:w-48 p-3 rounded-xl border transition-all ${
                isCurrent
                  ? "border-[var(--brand-primary)] bg-token-brand-muted"
                  : "border-token-surface surface-elevated"
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: dotColor }}
                />
                <p className="text-xs font-medium text-token-primary truncate">{group.phaseName}</p>
              </div>
              <p className="type-caption text-token-secondary mb-1">
                第 {group.startDay}–{group.endDay} 天 · {group.days.length} 课
              </p>
              <p className="type-caption text-token-secondary truncate">
                {isPast ? "已完成" : isCurrent ? "进行中" : "未开始"}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
