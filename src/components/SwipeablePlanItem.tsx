import { useRef, useState, useCallback, useEffect } from "react";
import { Trash2, Play, BookOpen, CheckCircle2 } from "lucide-react";
import { TYPE_LABELS } from "@shared/typeEngine";

interface SwipeablePlanItemProps {
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
  onDelete: () => void;
  children?: React.ReactNode;
}

/**
 * SwipeablePlanItem - 左滑显示删除按钮的计划卡片
 *
 * 交互逻辑：
 * - 触摸/拖拽向左滑动超过 60px 时，卡片左移露出红色删除按钮
 * - 点击卡片其他区域或右滑收起
 * - 桌面端鼠标悬停时也可显示删除按钮（hover 状态）
 */
export default function SwipeablePlanItem({ plan, isCurrent, onSelect, onDelete, children }: SwipeablePlanItemProps) {
  const [offsetX, setOffsetX] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const startXRef = useRef(0);
  const currentXRef = useRef(0);
  const isDraggingRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const DELETE_WIDTH = 64; // 删除按钮宽度

  // 点击外部收起
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setOffsetX(0);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isOpen]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startXRef.current = e.touches[0].clientX;
    currentXRef.current = 0;
    isDraggingRef.current = false;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const touchX = e.touches[0].clientX;
    const delta = touchX - startXRef.current;
    currentXRef.current = delta;
    isDraggingRef.current = true;

    // 只响应左滑（负值），且不超过 DELETE_WIDTH
    if (delta < 0) {
      setOffsetX(Math.max(delta, -DELETE_WIDTH));
    } else {
      // 右滑时收起
      setOffsetX(0);
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    const delta = currentXRef.current;
    if (delta < -30) {
      // 左滑超过阈值，完全打开
      setOffsetX(-DELETE_WIDTH);
      setIsOpen(true);
    } else {
      // 否则收起
      setOffsetX(0);
      setIsOpen(false);
    }
  }, []);

  // 鼠标拖拽支持（桌面端也支持拖拽）
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    startXRef.current = e.clientX;
    currentXRef.current = 0;
    isDraggingRef.current = false;

    const handleMouseMove = (me: MouseEvent) => {
      const delta = me.clientX - startXRef.current;
      currentXRef.current = delta;
      isDraggingRef.current = true;
      if (delta < 0) {
        setOffsetX(Math.max(delta, -DELETE_WIDTH));
      } else {
        setOffsetX(0);
      }
    };

    const handleMouseUp = () => {
      const delta = currentXRef.current;
      if (delta < -30) {
        setOffsetX(-DELETE_WIDTH);
        setIsOpen(true);
      } else {
        setOffsetX(0);
        setIsOpen(false);
      }
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, []);

  // 点击卡片选择（仅在没有拖拽时）
  const handleCardClick = useCallback(() => {
    if (!isDraggingRef.current) {
      onSelect();
    }
  }, [onSelect]);

  const planProgress = plan.totalDays > 0 ? Math.round((plan.currentDay / plan.totalDays) * 100) : 0;

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden rounded-xl"
      style={{ touchAction: "pan-y" }}
    >
      {/* 背景层：删除按钮（默认隐藏在右侧） */}
      <div
        className="absolute right-0 top-0 bottom-0 flex items-center justify-center rounded-r-xl"
        style={{
          width: `${DELETE_WIDTH}px`,
          background: "rgba(255, 59, 48, 0.12)",
        }}
      >
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="flex flex-col items-center gap-1"
        >
          <Trash2 size={18} className="text-[#FF3B30]" />
          <span className="text-[9px] text-[#FF3B30] font-medium">删除</span>
        </button>
      </div>

      {/* 前景层：卡片内容（可滑动） */}
      <div
        className="relative z-10"
        style={{
          transform: `translateX(${offsetX}px)`,
          transition: offsetX === 0 || offsetX === -DELETE_WIDTH ? "transform 0.2s ease-out" : "none",
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onClick={handleCardClick}
      >
        <div
          className={`liquid-glass rounded-xl p-3 md:p-4 cursor-pointer transition-all ${
            isCurrent
              ? "border border-[rgba(110,86,207,0.3)]"
              : "border border-transparent hover:border-[rgba(255,255,255,0.08)]"
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-9 h-9 md:w-10 md:h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                isCurrent
                  ? "bg-[rgba(110,86,207,0.15)]"
                  : plan.status === "completed"
                    ? "bg-[rgba(52,199,89,0.1)]"
                    : "bg-[rgba(255,255,255,0.03)]"
              }`}
            >
              {isCurrent ? (
                <Play size={16} className="text-[#6E56CF]" />
              ) : plan.status === "completed" ? (
                <CheckCircle2 size={16} className="text-[#34C759]" />
              ) : (
                <BookOpen size={16} className="text-[#8A8A8E]" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p
                  className={`text-sm font-medium truncate ${
                    isCurrent ? "text-[#A78BFA]" : "text-[#F5F5F7]"
                  }`}
                >
                  {plan.goal}
                </p>
                {isCurrent && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[rgba(110,86,207,0.15)] text-[#A78BFA] flex-shrink-0">
                    当前
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <p className="text-[10px] md:text-xs text-[#8A8A8E]">
                  第 {plan.currentDay}/{plan.totalDays} 天 · {planProgress}%
                </p>
                {plan.learningType && (
                  <span
                    className="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
                    style={{
                      color: TYPE_LABELS[plan.learningType as keyof typeof TYPE_LABELS]?.color || "#8A8A8E",
                      background: `${TYPE_LABELS[plan.learningType as keyof typeof TYPE_LABELS]?.color || "#8A8A8E"}15`,
                    }}
                  >
                    {TYPE_LABELS[plan.learningType as keyof typeof TYPE_LABELS]?.name || plan.learningType}
                  </span>
                )}
              </div>
            </div>
          </div>
          {/* 进度条 */}
          <div className="mt-2 h-1 bg-[rgba(255,255,255,0.05)] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${planProgress}%`,
                background: isCurrent
                  ? "linear-gradient(90deg, #6E56CF, #A78BFA)"
                  : "#8A8A8E",
              }}
            />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
