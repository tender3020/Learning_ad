import { type ReactNode } from "react";
import { Sparkles, Loader2, Clock, Layers } from "lucide-react";

export type TodayContentState = "empty" | "loading" | "streaming" | "ready" | "illustrating";

type TodayHeaderProps = {
  dayNumber: number;
  totalDays: number;
  phaseName?: string | null;
  phaseOrder?: number | null;
  title: string;
  goal?: string | null;
  estimatedMinutes?: number | null;
  state: TodayContentState;
  onGenerate?: () => void;
  isGenerating?: boolean;
  /** 移动端点击 D{n}/{total} 打开学习大纲 */
  onOpenOutline?: () => void;
  actions?: ReactNode;
};

const PHASE_BG: Record<number, string> = {
  1: "phase-bg-1",
  2: "phase-bg-2",
  3: "phase-bg-3",
  4: "phase-bg-4",
  5: "phase-bg-5",
  6: "phase-bg-6",
};

const STATE_LABEL: Record<TodayContentState, string> = {
  empty: "待生成",
  loading: "准备中",
  streaming: "AI 编写中",
  ready: "已完成",
  illustrating: "配图加载中",
};

export default function TodayHeader({
  dayNumber,
  totalDays,
  phaseName,
  phaseOrder,
  title,
  goal,
  estimatedMinutes,
  state,
  onGenerate,
  isGenerating,
  onOpenOutline,
  actions,
}: TodayHeaderProps) {
  const phaseClass = phaseOrder ? PHASE_BG[Math.min(phaseOrder, 6)] || "phase-bg-1" : "phase-bg-1";
  const compact = state === "ready" || state === "streaming" || state === "illustrating";

  return (
    <div className="today-header border-b border-token-surface flex-shrink-0">
      <div className={`px-3 md:px-6 ${compact ? "py-2" : "py-2.5 md:py-3"} flex flex-col gap-2`}>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              {onOpenOutline ? (
                <button
                  type="button"
                  onClick={onOpenOutline}
                  className="type-caption font-medium text-token-brand rounded-md px-1.5 py-0.5 -ml-1.5 max-md:active:bg-token-brand-muted desk:pointer-events-none desk:cursor-default"
                  aria-label={`第 ${dayNumber} 天，共 ${totalDays} 天，打开学习大纲`}
                >
                  D{dayNumber}/{totalDays}
                </button>
              ) : (
                <span className="type-caption font-medium text-token-brand">
                  D{dayNumber}/{totalDays}
                </span>
              )}
              {phaseName && (
                <span className={`inline-flex items-center gap-1 type-caption px-2 py-0.5 rounded-full ${phaseClass} text-token-primary`}>
                  <Layers size={12} />
                  {phaseName}
                </span>
              )}
              {!compact && (
                <span className="type-caption text-token-secondary">{STATE_LABEL[state]}</span>
              )}
              {compact && (
                <h1 className="type-title font-semibold text-token-primary truncate min-w-0">{title}</h1>
              )}
            </div>
            {!compact && (
              <>
                <h1 className="type-title md:text-lg font-semibold text-token-primary truncate mt-1">{title}</h1>
                {goal && (
                  <p className="type-caption text-token-secondary truncate mt-0.5">{goal}</p>
                )}
              </>
            )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {estimatedMinutes != null && estimatedMinutes > 0 && (
              <span className="hidden sm:inline-flex items-center gap-1 type-caption text-token-secondary">
                <Clock size={12} />
                ~{estimatedMinutes} 分钟
              </span>
            )}
            {(state === "empty" || state === "loading") && onGenerate && (
              <button
                type="button"
                onClick={onGenerate}
                disabled={isGenerating}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 md:px-4 md:py-2 rounded-xl type-body font-medium text-[var(--brand-foreground)] bg-token-brand hover:opacity-90 transition-opacity disabled:opacity-50 brand-glow"
              >
                {isGenerating ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Sparkles size={14} />
                )}
                生成今日课程
              </button>
            )}
            {actions}
          </div>
        </div>

        {state === "illustrating" && (
          <div className="type-caption text-token-brand-light flex items-center gap-2 px-2 py-1.5 rounded-lg bg-token-brand-muted">
            <Loader2 size={12} className="animate-spin" />
            配图正在后台生成，页面将自动刷新
          </div>
        )}
      </div>
    </div>
  );
}
