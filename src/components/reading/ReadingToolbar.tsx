import { AnimatePresence, motion } from "framer-motion";
import { Focus, Type } from "lucide-react";
import {
  FONT_SIZES,
  READING_FONT_LABELS,
  READING_LEADING_LABELS,
  type ReadingFontFamily,
  type ReadingFontSize,
  type ReadingLineHeight,
  type ReadingMode,
} from "@/hooks/useReadingPrefs";

type ReadingToolbarProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: ReadingMode;
  fontSize: ReadingFontSize;
  lineHeight: ReadingLineHeight;
  fontFamily: ReadingFontFamily;
  focusMode: boolean;
  onChange: (patch: {
    mode?: ReadingMode;
    fontSize?: ReadingFontSize;
    lineHeight?: ReadingLineHeight;
    fontFamily?: ReadingFontFamily;
    focusMode?: boolean;
  }) => void;
};

const MODES: { id: ReadingMode; label: string; swatch: string }[] = [
  { id: "soft-dark", label: "深色", swatch: "#1A1A1E" },
  { id: "app", label: "浅色", swatch: "#FAFAFA" },
  { id: "warm", label: "护眼", swatch: "#F4EDE4" },
];

const LEADINGS: ReadingLineHeight[] = ["tight", "normal", "relaxed"];
const FONTS: ReadingFontFamily[] = ["system", "song", "hei", "kai", "yuan"];

export function ReadingSettingsButton({
  onClick,
  active,
}: {
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="阅读设置"
      className={`inline-flex items-center gap-1 px-2 py-1.5 rounded-xl type-caption font-medium transition-all ${
        active ? "bg-token-brand-muted text-token-primary" : "text-token-secondary hover:text-token-primary hover-surface"
      }`}
    >
      <Type size={14} />
      <span>Aa</span>
    </button>
  );
}

/** 微信读书式底部阅读设置：字号、行距、字体、背景 */
export default function ReadingToolbar({
  open,
  onOpenChange,
  mode,
  fontSize,
  lineHeight,
  fontFamily,
  focusMode,
  onChange,
}: ReadingToolbarProps) {
  const sizeIndex = FONT_SIZES.indexOf(fontSize);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            type="button"
            aria-label="关闭阅读设置"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="reading-settings-backdrop"
            onClick={() => onOpenChange(false)}
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 32, stiffness: 320 }}
            className="reading-settings-sheet"
            role="dialog"
            aria-label="阅读设置"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="reading-settings-sheet__handle" />

            <div className="reading-settings-row">
              <span className="reading-settings-label">A</span>
              <input
                type="range"
                min={0}
                max={FONT_SIZES.length - 1}
                step={1}
                value={sizeIndex < 0 ? 2 : sizeIndex}
                onChange={(e) => onChange({ fontSize: FONT_SIZES[Number(e.target.value)] })}
                className="reading-settings-slider"
                aria-label="字体大小"
              />
              <span className="reading-settings-label reading-settings-label--lg">A</span>
            </div>

            <div className="reading-settings-row">
              <span className="reading-settings-label">行距</span>
              <div className="reading-settings-seg">
                {LEADINGS.map((id) => (
                  <button
                    key={id}
                    type="button"
                    className={`reading-settings-seg__btn ${lineHeight === id ? "is-active" : ""}`}
                    onClick={() => onChange({ lineHeight: id })}
                  >
                    {READING_LEADING_LABELS[id]}
                  </button>
                ))}
              </div>
            </div>

            <div className="reading-settings-row reading-settings-row--wrap">
              <span className="reading-settings-label">字体</span>
              <div className="reading-settings-fonts">
                {FONTS.map((id) => (
                  <button
                    key={id}
                    type="button"
                    className={`reading-settings-font ${fontFamily === id ? "is-active" : ""} reading-font-${id}`}
                    onClick={() => onChange({ fontFamily: id })}
                  >
                    {READING_FONT_LABELS[id]}
                  </button>
                ))}
              </div>
            </div>

            <div className="reading-settings-row">
              <span className="reading-settings-label">背景</span>
              <div className="reading-settings-swatches">
                {MODES.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    title={item.label}
                    aria-label={item.label}
                    className={`reading-settings-swatch ${mode === item.id ? "is-active" : ""}`}
                    style={{ background: item.swatch }}
                    onClick={() => onChange({ mode: item.id })}
                  />
                ))}
              </div>
              <button
                type="button"
                className={`reading-settings-focus ${focusMode ? "is-active" : ""}`}
                onClick={() => onChange({ focusMode: !focusMode })}
              >
                <Focus size={14} />
                专注
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
