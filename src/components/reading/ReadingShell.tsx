import type { RefObject } from "react";
import type { ReadingFontSize, ReadingLineHeight, ReadingMode } from "@/hooks/useReadingPrefs";

type ReadingShellProps = {
  mode: ReadingMode;
  fontSize: ReadingFontSize;
  lineHeight: ReadingLineHeight;
  progressBarRef?: RefObject<HTMLDivElement | null>;
  breakReminder?: boolean;
  onDismissBreak?: () => void;
  children: React.ReactNode;
};

const MODE_CLASS: Record<ReadingMode, string> = {
  app: "reading-shell--app",
  "soft-dark": "reading-shell--soft-dark",
  warm: "reading-shell--warm",
};

const FONT_CLASS: Record<ReadingFontSize, string> = {
  sm: "reading-font-sm",
  md: "reading-font-md",
  lg: "reading-font-lg",
};

const LINE_HEIGHT_CLASS: Record<ReadingLineHeight, string> = {
  normal: "reading-leading-normal",
  relaxed: "reading-leading-relaxed",
};

export default function ReadingShell({
  mode,
  fontSize,
  lineHeight,
  progressBarRef,
  breakReminder = false,
  onDismissBreak,
  children,
}: ReadingShellProps) {
  return (
    <div
      className={`reading-shell ${MODE_CLASS[mode]} ${FONT_CLASS[fontSize]} ${LINE_HEIGHT_CLASS[lineHeight]}`}
    >
      <div className="reading-progress" aria-hidden="true">
        <div ref={progressBarRef} className="reading-progress__bar" style={{ width: "0%" }} />
      </div>

      {breakReminder && (
        <div className="reading-break-reminder">
          <span>已连续阅读约 30 分钟，休息一下眼睛吧</span>
          {onDismissBreak && (
            <button type="button" onClick={onDismissBreak} className="reading-break-reminder__btn">
              知道了
            </button>
          )}
        </div>
      )}

      <div className="reading-shell__inner">{children}</div>
    </div>
  );
}
