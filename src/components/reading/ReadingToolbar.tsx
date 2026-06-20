import {
  BookOpen,
  Focus,
  List,
  Minus,
  Plus,
  AlignJustify,
} from "lucide-react";
import {
  READING_MODE_LABELS,
  type ReadingFontSize,
  type ReadingLineHeight,
  type ReadingMode,
} from "@/hooks/useReadingPrefs";

type ReadingToolbarProps = {
  mode: ReadingMode;
  fontSize: ReadingFontSize;
  lineHeight: ReadingLineHeight;
  focusMode: boolean;
  onCycleMode: () => void;
  onDecreaseFont: () => void;
  onIncreaseFont: () => void;
  onToggleLineHeight: () => void;
  onToggleFocus: () => void;
  onOpenToc?: () => void;
  showTocButton?: boolean;
};

export default function ReadingToolbar({
  mode,
  fontSize,
  lineHeight,
  focusMode,
  onCycleMode,
  onDecreaseFont,
  onIncreaseFont,
  onToggleLineHeight,
  onToggleFocus,
  onOpenToc,
  showTocButton = false,
}: ReadingToolbarProps) {
  return (
    <div className="reading-toolbar">
      <button
        type="button"
        className="reading-toolbar__btn"
        onClick={onCycleMode}
        title="切换阅读模式"
      >
        <BookOpen size={14} />
        <span className="reading-toolbar__label">{READING_MODE_LABELS[mode]}</span>
      </button>

      <div className="reading-toolbar__group">
        <button
          type="button"
          className="reading-toolbar__btn reading-toolbar__btn--icon"
          onClick={onDecreaseFont}
          disabled={fontSize === "sm"}
          title="减小字号"
          aria-label="减小字号"
        >
          <Minus size={14} />
        </button>
        <span className="reading-toolbar__size">{fontSize === "sm" ? "小" : fontSize === "md" ? "中" : "大"}</span>
        <button
          type="button"
          className="reading-toolbar__btn reading-toolbar__btn--icon"
          onClick={onIncreaseFont}
          disabled={fontSize === "lg"}
          title="增大字号"
          aria-label="增大字号"
        >
          <Plus size={14} />
        </button>
      </div>

      <button
        type="button"
        className={`reading-toolbar__btn reading-toolbar__btn--icon ${lineHeight === "relaxed" ? "reading-toolbar__btn--active" : ""}`}
        onClick={onToggleLineHeight}
        title="切换行距"
        aria-label="切换行距"
      >
        <AlignJustify size={14} />
      </button>

      <button
        type="button"
        className={`reading-toolbar__btn reading-toolbar__btn--icon ${focusMode ? "reading-toolbar__btn--active" : ""}`}
        onClick={onToggleFocus}
        title="专注模式"
        aria-label="专注模式"
      >
        <Focus size={14} />
      </button>

      {showTocButton && onOpenToc && (
        <button
          type="button"
          className="reading-toolbar__btn reading-toolbar__btn--icon lg:hidden"
          onClick={onOpenToc}
          title="章节目录"
          aria-label="章节目录"
        >
          <List size={14} />
        </button>
      )}
    </div>
  );
}
