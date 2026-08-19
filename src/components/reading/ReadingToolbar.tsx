import { useState } from "react";
import {
  BookOpen,
  Focus,
  List,
  Minus,
  Plus,
  AlignJustify,
  Type,
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
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <div className="reading-toolbar">
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

      <div className="reading-toolbar__more ml-auto">
        <button
          type="button"
          className={`reading-toolbar__btn ${moreOpen ? "reading-toolbar__btn--active" : ""}`}
          onClick={() => setMoreOpen((v) => !v)}
          title="阅读设置"
          aria-expanded={moreOpen}
        >
          <Type size={14} />
          <span className="reading-toolbar__label">Aa</span>
        </button>
        {moreOpen && (
          <div className="reading-toolbar__menu" role="menu">
            <button type="button" className="reading-toolbar__btn w-full justify-start" onClick={onCycleMode}>
              <BookOpen size={14} />
              {READING_MODE_LABELS[mode]}
            </button>
            <button
              type="button"
              className={`reading-toolbar__btn w-full justify-start ${lineHeight === "relaxed" ? "reading-toolbar__btn--active" : ""}`}
              onClick={onToggleLineHeight}
            >
              <AlignJustify size={14} />
              {lineHeight === "relaxed" ? "宽松行距" : "标准行距"}
            </button>
            <button
              type="button"
              className={`reading-toolbar__btn w-full justify-start ${focusMode ? "reading-toolbar__btn--active" : ""}`}
              onClick={onToggleFocus}
            >
              <Focus size={14} />
              专注模式
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
