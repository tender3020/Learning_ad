import { Loader2, Square, Volume2 } from "lucide-react";
import type { TtsStatus } from "@/hooks/useTtsPlayer";

type TtsButtonProps = {
  id: string;
  text: string;
  status: TtsStatus;
  onPlay: (id: string, text: string) => void;
  size?: "sm" | "md";
  label?: string;
  className?: string;
};

export default function TtsButton({
  id,
  text,
  status,
  onPlay,
  size = "sm",
  label,
  className = "",
}: TtsButtonProps) {
  const iconSize = size === "md" ? 16 : 14;
  const isLoading = status === "loading";
  const isPlaying = status === "playing";

  return (
    <button
      type="button"
      onClick={() => onPlay(id, text)}
      disabled={isLoading || !text.trim()}
      title={isPlaying ? "停止朗读" : "语音朗读"}
      className={`inline-flex items-center gap-1.5 rounded-xl transition-colors disabled:opacity-40 ${
        isPlaying
          ? "bg-[rgba(110,86,207,0.2)] text-[#A78BFA] border border-[rgba(110,86,207,0.3)]"
          : isLoading
            ? "liquid-glass text-[#A78BFA]"
            : "liquid-glass text-[#8A8A8E] hover:text-[#F5F5F7]"
      } ${size === "md" ? "px-3 py-1.5 text-xs" : "px-3 py-1.5 md:px-4 md:py-2 text-xs md:text-sm font-medium"} ${className}`}
    >
      {isLoading ? (
        <Loader2 size={iconSize} className="animate-spin" />
      ) : isPlaying ? (
        <Square size={iconSize} />
      ) : (
        <Volume2 size={iconSize} />
      )}
      {label && <span>{isPlaying ? "停止" : label}</span>}
    </button>
  );
}
